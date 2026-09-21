/**
 * Renders docs/pivot-plan.html to docs/pdf/pivot-plan.pdf.
 *
 * `docs/pivot-plan.html` is the source of truth — edit it directly and re-run
 * this. The PDF's document title (what a viewer shows in its title bar and what
 * lands in the file's metadata) is that file's <title>, so change it there
 * rather than here.
 *
 * Uses the Edge already on the machine through playwright-core, the same way
 * scripts/build-docs-pdf.mjs and playwright.config.ts do — no browser download,
 * and the print CSS in the document is what decides the layout.
 *
 *   node scripts/build-pivot-plan-pdf.mjs
 */
import { chromium } from 'playwright-core'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdir, stat } from 'node:fs/promises'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const source = pathToFileURL(resolve(root, 'docs/pivot-plan.html')).href
const outDir = resolve(root, 'docs/pdf')
const outFile = resolve(outDir, 'pivot-plan.pdf')

/** Chromium renders header and footer templates at 0px unless told otherwise. */
const footer = `
  <div style="width:100%;padding:0 15mm;font:400 8pt 'Segoe UI',sans-serif;color:#667085;
              display:flex;justify-content:space-between;">
    <span>Lighting circuits pivot plan &middot; proposal v1</span>
    <span class="pageNumber"></span>
  </div>`

const browser = await chromium.launch({ channel: 'msedge' })

try {
  await mkdir(outDir, { recursive: true })
  const page = await browser.newPage()

  // `waitUntil: 'networkidle'` matters here: the Google Fonts stylesheet and the
  // font files behind it load after DOMContentLoaded, and a PDF taken before
  // they arrive silently ships the fallback stack.
  await page.goto(source, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)

  await page.emulateMedia({ media: 'print' })
  await page.pdf({
    path: outFile,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: footer,
    margin: { top: '14mm', bottom: '16mm', left: '15mm', right: '15mm' },
  })

  await page.close()

  const { size } = await stat(outFile)
  console.log(`  docs/pdf/pivot-plan.pdf   ${(size / 1024).toFixed(0)} KB`)
} finally {
  await browser.close()
}

console.log('\nDone.')
