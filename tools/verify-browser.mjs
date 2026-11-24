// Browser check of the training kit: the units home, one step per screen, the dialogs, the «تعمّق أكثر» links,
// navigation and phones. Edge + playwright-core (borrowed from a sibling guide). Screenshots go to review/screenshots.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildHtml, ROOT } from './build-html.mjs';
import { createServer } from './serve-html.mjs';
let chromium;
for (const from of ['./package.json', '../../inspection/tools/package.json', '../../main/tools/package.json']) {
  try { ({ chromium } = createRequire(new URL(from, import.meta.url))('playwright-core')); break; } catch {}
}
buildHtml();
const server = createServer();
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/ar`;
const out = path.join(ROOT, 'review/screenshots');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const errors = [];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const width of [1440, 390]) for (const theme of ['dark', 'light']) {
    const mobile = width === 390;
    const ctx = await browser.newContext({ viewport: { width, height: mobile ? 844 : 900 }, colorScheme: theme, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: mobile ? 2 : 1 });
    await ctx.addInitScript((t) => { try { localStorage.setItem('kos-guide-theme', t); } catch {} }, theme);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => { if (r.status() >= 400 && !/fonts\.g/.test(r.url())) errors.push(`${r.status()} ${r.url()}`); });
    const tag = `${width}-${theme}`;
    const fits = async (label) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow ${label} ${tag}`);

    await page.goto(`${base}/index.html`);
    await page.waitForTimeout(600);
    assert.match(await page.textContent('.flow-example'), /الوحدة 1/);
    await fits('home');
    await page.screenshot({ path: path.join(out, `home-${tag}.png`), fullPage: !mobile });

    const go = async (to) => {
      for (let k = 0; k < 12 && (await page.textContent('[data-quick-count]')) !== `${to}/10`; k++) await page.click('.quick-next');
      await page.waitForTimeout(700);
      assert.equal(await page.textContent('[data-quick-count]'), `${to}/10`);
    };
    const shot = (name) => page.screenshot({ path: path.join(out, `${name}-${tag}.png`), fullPage: !mobile });
    // Chevrons must point the way the page reads: left in Arabic (x of the tip < x of the centre).
    const pointsLeft = (sel) => page.$eval(sel, (el) => {
      const m = new DOMMatrix(getComputedStyle(el, '::after').transform);
      // The chevron is a box's top-right corner, direction (1, -1); after the transform its x is m.a - m.c.
      return m.a - m.c < 0;
    });

    await page.click('.flow-example');
    await page.waitForSelector('[data-quick-ready]');
    assert.equal(await page.textContent('[data-quick-count]'), '1/10');
    await page.waitForTimeout(700);
    assert.equal(await page.$$eval('.quick-card:not([hidden]) .slide-tile', (t) => t.length), 4);
    await fits('slide 1');
    await shot('slide1-cards');
    // Slide 2: quote and a chain that reads right to left.
    await go(2);
    assert.ok(await page.isVisible('.quick-card:not([hidden]) .slide-quote'));
    if (!mobile) assert.ok(await pointsLeft('.quick-card:not([hidden]) .slide-chain li + li'), 'chain chevron points left in Arabic');
    await fits('slide 2');
    await shot('slide2-chain');
    // Step 5 lists four «تعمّق أكثر» links to the main guide.
    await go(5);
    const links = await page.$$eval('.quick-card:not([hidden]) .quick-links a', (as) => as.map((a) => [a.textContent.trim(), a.getAttribute('href'), a.target]));
    assert.equal(links.length, 4);
    for (const [, href, target] of links) { assert.match(href, /^http:\/\/127\.0\.0\.1:4321\/ar\/c\d\.html$/); assert.equal(target, '_blank'); }
    await fits('step 5');
    await page.evaluate(() => document.querySelector('.quick-card:not([hidden]) .quick-links').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `step5-links-${tag}.png`), fullPage: !mobile });
    // Slide 6: before/after, «before» on the reading start side.
    await go(6);
    const [before, after] = await page.$$eval('.quick-card:not([hidden]) .slide-side', (s) => s.map((e) => e.getBoundingClientRect()));
    if (mobile) assert.ok(before.top < after.top, 'before above after on phones');
    else assert.ok(before.left > after.left, 'before on the right in Arabic');
    if (!mobile) assert.ok(await pointsLeft('.quick-card:not([hidden]) .slide-vs'), 'before→after arrow points left in Arabic');
    await fits('slide 6');
    await shot('slide6-compare');
    // Slide 8: before/after numbers.
    await go(8);
    assert.equal(await page.$$eval('.quick-card:not([hidden]) .slide-metric', (m) => m.length), 4);
    await fits('slide 8');
    await shot('slide8-metrics');
    // Last step leads to the next unit.
    await go(10);
    assert.ok(await page.isVisible('.quick-finish'));
    assert.match(await page.textContent('.quick-finish'), /الوحدة التالية/);
    // Units 2–6: every slide fits the screen and shows a visual; the last unit leads home.
    for (const [unit, n] of [[2, 9], [3, 10], [4, 11], [5, 9], [6, 9]]) {
      await page.goto(`${base}/c${unit}.html`);
      await page.waitForSelector('[data-quick-ready]');
      for (let k = 1; k <= n; k++) {
        if (k > 1) await page.click('.quick-next');
        await page.waitForTimeout(450);
        assert.equal(await page.textContent('[data-quick-count]'), `${k}/${n}`);
        assert.ok(await page.$('.quick-card:not([hidden]) .slide-body > *'), `unit ${unit} slide ${k} has a visual`);
        await fits(`unit ${unit} slide ${k}`);
        if ([1, 2, 7].includes(k) || (unit === 5 && k === 8)) await shot(`u${unit}-s${k}`);
      }
      assert.match(await page.textContent('.quick-finish'), unit === 6 ? /أنهيت الوحدة/ : /الوحدة التالية/);
      if (unit === 6) {
        // The final quiz: the right option is marked only after «اعرض الإجابة».
        const quiz = '.quick-card:not([hidden]) .slide-quiz';
        assert.equal(await page.$$eval(quiz, (q) => q.length), 3);
        const marked = () => page.$eval(`${quiz} li[data-right]`, (li) => getComputedStyle(li).backgroundColor);
        const before = await marked();
        await page.click(`${quiz} summary`);
        await page.waitForTimeout(200);
        assert.ok(await page.isVisible(`${quiz} details[open] p`), 'answer shown');
        assert.notEqual(await marked(), before, 'right option highlighted after opening the answer');
        await shot('u6-quiz-open');
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}
assert.deepEqual(errors, []);
console.log(`Browser checks passed. Screenshots in ${out}`);
