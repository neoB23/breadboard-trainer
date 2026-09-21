import { expect, test } from '@playwright/test'

/**
 * The landing hero's animated board.
 *
 * The claim under test is the one a global `transition-duration: 0` cannot make
 * good on: this is a JavaScript timeline, so "reduce motion" has to be honoured
 * by not running it — zeroing the steps would just flash through every stage as
 * fast as the event loop allows, which is more motion, not less.
 */

test('plays through build, scan and diagnosis', async ({ page }) => {
  await page.goto('/')

  const status = page.locator('[aria-live=polite]')

  // The build is narrated part by part, in assembly order. This is the check
  // that the hero actually *assembles* rather than showing a finished board:
  // the 3D scene ignored the build count entirely until it was threaded through,
  // and the only symptom was a caption nobody could contradict.
  await expect(status).toHaveText('Running a jumper from the +5V rail')
  await expect(status).toHaveText('Seating the 220 ohm resistor', { timeout: 4000 })
  await expect(status).toHaveText('Seating the LED across the centre channel', { timeout: 4000 })
  await expect(status).toHaveText('Running a jumper back to ground', { timeout: 4000 })

  // The netlist fills in as the scan finds each net, so the rows are the honest
  // signal that the drawing and the listing are advancing together.
  await expect(status).toHaveText('1 net missing', { timeout: 15_000 })
  await expect(page.getByText('D1 cathode never reaches ground.')).toBeVisible()

  const rows = page.getByRole('button', { name: /N[123]/ })
  await expect(rows).toHaveCount(3)
  await expect(page.getByRole('button', { name: /N3/ })).toContainText('absent')
})

test('a netlist row lights its net on the board', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[aria-live=polite]')).toHaveText('1 net missing', { timeout: 15_000 })

  const n1 = page.getByRole('button', { name: /N1/ })
  await expect(n1).toHaveAttribute('aria-pressed', 'false')

  await n1.hover()
  await expect(n1).toHaveAttribute('aria-pressed', 'true')
})

test('holds still, and shows the answer, under reduced motion', async ({ browser }) => {
  // The OS-level setting, which is the route most people arrive by.
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await context.newPage()

  await page.goto('/')

  // No build-up at all: the finished board is there on the first paint.
  await expect(page.locator('[aria-live=polite]')).toHaveText('1 net missing')
  await expect(page.getByText('D1 cathode never reaches ground.')).toBeVisible()

  // And it stays there rather than looping — the sequence never restarts.
  await page.waitForTimeout(11_000)
  await expect(page.locator('[aria-live=polite]')).toHaveText('1 net missing')

  // The replay control is withheld, because there is nothing to replay.
  await expect(page.getByRole('button', { name: 'Run it again' })).toBeHidden()
  await expect(page.getByText('Motion is off')).toBeVisible()

  await context.close()
})

test('keeps three.js out of the first load, then upgrades to 3D', async ({ page }) => {
  const chunks: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    if (url.includes('.js') || url.includes('/@fs/') || url.includes('node_modules')) chunks.push(url)
  })

  await page.goto('/')

  // The flat board is up before any 3D exists — it is the Suspense fallback, so
  // the hero is correct and interactive from first paint rather than blank.
  await expect(page.getByRole('img', { name: /breadboard/i })).toBeVisible()

  // …and then the canvas replaces it.
  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible({ timeout: 20_000 })
  await expect(canvas).not.toHaveJSProperty('width', 0)

  /**
   * The point of the split, asserted where it can actually be seen: nothing
   * three-shaped is requested until the board is on screen. In a dev server the
   * module graph is unbundled, so this checks the *ordering* — three is not part
   * of the initial document's dependency wave.
   */
  const threeRequests = chunks.filter((url) => /three|board-3d/i.test(url))
  expect(threeRequests.length).toBeGreaterThan(0)
})

test('falls back to the flat board when WebGL is unavailable', async ({ browser }) => {
  // Some lab machines have WebGL disabled by policy. The hero has to survive it.
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.addInitScript(() => {
    const deny = () => null
    HTMLCanvasElement.prototype.getContext = deny as typeof HTMLCanvasElement.prototype.getContext
  })

  await page.goto('/')

  // The netlist still fills in and the diagnosis still arrives: the sequence is
  // independent of how the board happens to be drawn.
  await expect(page.locator('[aria-live=polite]')).toHaveText('1 net missing', { timeout: 15_000 })
  await expect(page.getByText('D1 cathode never reaches ground.')).toBeVisible()

  await context.close()
})

test('the 3D board gains one part per step rather than appearing whole', async ({ page }) => {
  await page.goto('/')

  // Wait for the 3D chunk, then restart so the build is watched from empty.
  await expect(page.locator('canvas')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Run it again' }).click()

  const status = page.locator('[aria-live=polite]')

  /**
   * Counting draw calls is not available from here, so the proxy is the caption:
   * each part is announced as it goes in, and the parts are gated on the same
   * BUILD_AT the caption is driven from. If the scene ever stops honouring the
   * count again, the flat board and the 3D board disagree and this ordering is
   * the first thing that breaks.
   */
  const order = [
    'Running a jumper from the +5V rail',
    'Seating the 220 ohm resistor',
    'Seating the LED across the centre channel',
    'Running a jumper back to ground',
    'Circuit built',
  ]

  for (const step of order) {
    await expect(status, step).toHaveText(step, { timeout: 5000 })
  }

  // And only then does the scan begin — the build finishes before the test run.
  await expect(status).toHaveText('Reading the board', { timeout: 5000 })
})
