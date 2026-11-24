import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildHtml, ROOT, STORE } from './build-html.mjs';
import { loadDocument } from './latex-parse.mjs';
import { GUIDE_URLS } from './guide-links.mjs';

// The kit is units shown as apps: index.html offers them, c<n>.html shows one step at a time.
buildHtml();
const doc = loadDocument(ROOT, { lang: 'ar' });
const units = [];
for (const b of doc.blocks) {
  if (b.type === 'chapter') units.push([]);
  if (b.type === 'quick' || b.type === 'slide') units.at(-1).push(b);
}
const names = ['index.html', ...units.map((_, i) => `c${i + 1}.html`)];
const pages = Object.fromEntries(names.map((n) => [n, fs.readFileSync(path.join(ROOT, 'site/ar', n), 'utf8')]));
const cardsOf = (html) => html.split(/<article class="quick-card[ "]/).slice(1).map((c) => c.slice(0, c.indexOf('</article>')));

test('the site is the units home and one flow page per unit, in Arabic only', () => {
  assert.deepEqual(fs.readdirSync(path.join(ROOT, 'site/ar')).sort(), [...names].sort());
  for (const html of Object.values(pages)) {
    assert.match(html, /<html lang="ar" dir="rtl"/);
    assert.ok(html.includes(STORE));
    assert.doesNotMatch(html, /class="lang-btn"/);
  }
  assert.equal((pages['index.html'].match(/data-flow-example=/g) || []).length, units.length);
  assert.match(pages['index.html'], /الوحدة 1/);
  units.forEach((u, i) => assert.equal(cardsOf(pages[`c${i + 1}.html`]).length, u.length));
});

test('every slide is one idea: a phase, a one-line message, a visual and a short takeaway', () => {
  for (const u of units) {
    assert.ok(u.length >= 6 && u.length <= 12, `a unit has ${u.length} slides`);
    for (const q of u) {
      assert.equal(q.type, 'slide', `${q.title}: introductions use concept slides`);
      assert.ok(q.phase && q.lead && q.take, `${q.title}: incomplete`);
      assert.ok(q.parts.length >= 1 && q.parts.length <= 6, `${q.title}: ${q.parts.length} visual parts`);
      assert.ok(q.lead.length <= 200 && q.take.length <= 200, `${q.title}: message or takeaway too long`);
    }
  }
  const c1 = pages['c1.html'];
  assert.match(c1, /class="quick-card slide-card"/);
  for (const part of ['slide-cards', 'slide-chain', 'slide-compare', 'slide-metrics', 'slide-quote', 'slide-take']) assert.ok(c1.includes(`class="${part}`), part);
  // RTL: no bidi-mirrored ‹ › glyphs; direction comes from drawn chevrons.
  assert.doesNotMatch(c1, /[‹›]/);
});

test('«تعمّق أكثر» links point at real pages of known guides', () => {
  const links = units.flat().flatMap((q) => q.links);
  assert.ok(links.length >= 5);
  const sites = { main: 'main/site', builder: 'main/site', inspection: 'inspection/site', correspondence: 'correspondence/site', sop: 'sop/site' };
  for (const l of links) {
    assert.ok(l.guide in GUIDE_URLS || l.guide === 'builder', `unknown guide ${l.guide}`);
    const file = path.join(ROOT, '..', sites[l.guide], l.page);
    assert.ok(fs.existsSync(file), `${l.guide}/${l.page} does not exist`);
  }
  assert.match(pages['c1.html'], /class="quick-card-foot quick-links"><small>تعمّق أكثر<\/small><a class="quick-more" href="https:\/\/[^"]+" target="_blank" rel="noopener"/);
});
