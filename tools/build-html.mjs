import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// Bundled renderer and theme keep standalone deployments independent of sibling repositories.
import { loadDocument } from './latex-parse.mjs'
import { renderFlowSite, flowImages, UI } from './html-render.mjs'
import { loadVideos, attachVideos, copyVideos } from './guide-videos.mjs'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WEB = path.join(ROOT, 'web')
export const STORE = 'kayan-training-progress-v1'
const TITLE = 'الحقيبة التدريبية'
// The kit is made of units, not examples; the «who» of each step is the trainee, «where» is the place in Kayan.
const FLOW_LABELS = {
    example: (n) => `الوحدة ${n}`, examples: 'اختر الوحدة', start: 'ابدأ الوحدة',
    nextExample: 'انتقل إلى الوحدة التالية', finish: 'أنهيت الوحدة — العودة إلى الرئيسية',
    dataTitle: 'أمثلة وأرقام', data: 'أمثلة', field: 'البند', value: 'التفصيل', whyTitle: 'لماذا يهمّك هذا؟', why: 'لماذا يهمّك؟',
}

// `root` lets Guide Studio build an isolated draft copy; use the bundled theme.
export function buildHtml(root = ROOT) {
    const site = path.join(root, 'site')
    fs.rmSync(path.join(site, 'ar'), { recursive: true, force: true })
    fs.mkdirSync(path.join(site, 'ar'), { recursive: true })
    fs.mkdirSync(path.join(site, 'assets/screens'), { recursive: true })
    for (const name of ['guide.css', 'guide.js', 'kayanos-mark.svg', 'favicon.svg']) {
        fs.copyFileSync(path.join(WEB, name), path.join(site, 'assets', name))
    }
    const doc = loadDocument(root, { lang: 'ar' })
    copyVideos(root, site, attachVideos(doc.blocks, loadVideos(root), 'ar'))
    const original = { ...UI.ar }
    let pages
    try {
        Object.assign(UI.ar, {
            brand: TITLE,
            start: 'ابدأ التدريب',
            helpWork:
                'يُحفظ تقدّمك في الوحدات في هذا المتصفح فقط، ولا يغيّر شيئاً في كيان. روابط «تعمّق أكثر» تفتح الدليل المختص في تبويب جديد.',
        })
        pages = renderFlowSite(doc, { lang: 'ar', guide: { store: STORE, id: 'training', flowUi: FLOW_LABELS } })
    } finally {
        Object.assign(UI.ar, original)
    }
    for (const [name, source] of Object.entries(pages)) {
        // The guide is the examples shown as apps (renderFlowSite). Arabic only: fail visibly if the shell changes.
        if (!source.includes('class="lang-btn"')) throw new Error('Shared language-switch markup changed')
        const html = source
            .replace(/<a class="lang-btn"[^>]*>[\s\S]*?<\/a>/, '')
            .replace(/<link rel="alternate" hreflang="en"[^>]*>/, '')
        fs.writeFileSync(path.join(site, 'ar', name), html)
    }
    const usedImages = new Set()
    const copyImages = (blocks) =>
        blocks.forEach((block) => {
            if (block.image) {
                usedImages.add(path.basename(block.image))
                fs.copyFileSync(path.join(root, block.image), path.join(site, 'assets/screens', path.basename(block.image)))
            }
            if (block.blocks) copyImages(block.blocks)
        })
    copyImages(doc.blocks)
    // Screens shown inside the steps' «البيانات» dialogs (qshot).
    for (const image of flowImages(doc)) {
        usedImages.add(path.basename(image))
        fs.copyFileSync(path.join(root, image), path.join(site, 'assets/screens', path.basename(image)))
    }
    // This directory is generated: do not ship screenshots from removed chapters.
    for (const entry of fs.readdirSync(path.join(site, 'assets/screens'), { withFileTypes: true })) {
        if (entry.isFile() && !usedImages.has(entry.name)) fs.unlinkSync(path.join(site, 'assets/screens', entry.name))
    }
    fs.writeFileSync(
        path.join(site, 'index.html'),
        `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=ar/index.html"><title>${TITLE}</title><a href="ar/index.html">افتح ${TITLE}</a></html>`
    )
    return pages
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    console.log(`Built ${Object.keys(buildHtml()).length} Arabic pages.`)
}
