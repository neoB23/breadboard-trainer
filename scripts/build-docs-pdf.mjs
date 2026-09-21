/**
 * Renders docs/system-documentation.html to PDF, for the capstone appendix.
 *
 * `docs/system-documentation.html` is the source of truth — edit it directly
 * and re-run this. The PDF's document title (what a viewer shows in its title
 * bar and what lands in the file's metadata) is that file's <title>, so change
 * it there rather than here.
 *
 * Uses the Edge already on the machine through playwright-core, the same way
 * playwright.config.ts does — no browser download, and the print CSS in the
 * document is what decides the layout.
 *
 *   node scripts/build-docs-pdf.mjs
 *
 * Emits three files into docs/pdf/:
 *   system-documentation.pdf            both documents, technical first
 *   system-documentation-technical.pdf  the technical one alone
 *   system-documentation-general.pdf    the general-reader one alone
 *
 * The single-document builds work by hiding the other one at print time. The
 * `#id` selector outranks the `.doc[hidden]` rule in the page's own print block
 * — that rule exists so a Ctrl+P from a browser emits both regardless of which
 * one is on screen.
 */
import { chromium } from 'playwright-core'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdir } from 'node:fs/promises'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const source = pathToFileURL(resolve(root, 'docs/system-documentation.html')).href
const outDir = resolve(root, 'docs/pdf')

/** Chromium renders header and footer templates at 0px unless told otherwise. */
const footer = `
  <div style="width:100%;padding:0 16mm;font:400 8pt 'Segoe UI',sans-serif;color:#667085;
              display:flex;justify-content:space-between;">
    <span>Smart Breadboard Diagnostic Trainer &middot; system documentation v1.0</span>
    <span class="pageNumber"></span>
  </div>`

const BUILDS = [
  { file: 'system-documentation.pdf', hide: null, label: 'both documents' },
  { file: 'system-documentation-technical.pdf', hide: '#doc-general', label: 'technical only' },
  { file: 'system-documentation-general.pdf', hide: '#doc-technical', label: 'general only' },
]

const browser = await chromium.launch({ channel: 'msedge' })

try {
  await mkdir(outDir, { recursive: true })

  for (const build of BUILDS) {
    const page = await browser.newPage()

    // `waitUntil: 'networkidle'` matters here: the Google Fonts stylesheet and
    // the font files behind it load after DOMContentLoaded, and a PDF taken
    // before they arrive silently ships the fallback stack.
    await page.goto(source, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)

    if (build.hide) {
      await page.addStyleTag({ content: `@media print { ${build.hide} { display: none !important; } }` })
    }

    await page.emulateMedia({ media: 'print' })
    await page.pdf({
      path: resolve(outDir, build.file),
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: footer,
      margin: { top: '16mm', bottom: '18mm', left: '16mm', right: '16mm' },
    })

    await page.close()
    console.log(`  docs/pdf/${build.file.padEnd(38)} ${build.label}`)
  }
} finally {
  await browser.close()
}

console.log('\nDone.')
