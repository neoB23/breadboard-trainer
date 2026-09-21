import { expect, test, type Page } from '@playwright/test'

import { linkPath, waitForEmail } from './outbox'

/**
 * The workspace, driven the way a student in a lab drives it: parts out of the
 * tray, legs into holes, the netlist growing as they land, and the LED lighting
 * the moment the return path exists.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS SUITE REGISTERS ITS OWN STUDENT
 *
 * Attempts are rows, and the seed does not delete rows it did not write. If
 * these tests built circuits as Cruz or Santos, the first run would poison the
 * statuses `dashboard.spec.ts` asserts — not on this run, where file order
 * saves it, but on the *next* one, against a database the suite is explicitly
 * allowed to be re-run against. A fresh registration per suite keeps every
 * board built here off everyone else's dashboard forever.
 *
 * The two tests share that account and run in file order (the suite is
 * serial), so the second signs in rather than registering again.
 * ---------------------------------------------------------------------------
 *
 * Holes are found by their accessible names — "Upper bank, column 3, row 1" —
 * which is also the proof that a screen reader gets the same handles a sighted
 * student gets. `exact: true` throughout: "column 3" is a substring of
 * "column 13", and a test that can click the wrong hole proves nothing.
 */

const PASSWORD = 'correct-horse-battery-staple'
const JOIN_CODE = 'K7M4QP'

/** Set by the first test, used by the second. The file runs serially. */
let studentEmail = ''

async function fill(page: Page, label: string | RegExp, value: string) {
  await page.getByLabel(label, { exact: false }).first().fill(value)
}

async function registerAndOnboard(page: Page): Promise<string> {
  const email = `e2e-builder-${Date.now().toString(36)}@students.example.edu`

  await page.goto('/register')
  await fill(page, 'Full name', 'Bea Lazaro')
  await fill(page, 'Email', email)
  await fill(page, 'Password', PASSWORD)
  await fill(page, 'Student number', '2026-00777')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()

  const verification = await waitForEmail(email)
  await page.goto(linkPath(verification))
  await expect(page.getByRole('heading', { name: 'Email confirmed' })).toBeVisible()

  await signIn(page, email)

  // The wizard: identity, the seeded class, done.
  await expect(page).toHaveURL(/\/onboarding$/)
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Join your class' })).toBeVisible()
  await fill(page, 'Class code', JOIN_CODE)
  await page.getByRole('button', { name: 'Join class' }).click()
  await expect(page.getByText(/You are in /)).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Start using the trainer' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)

  return email
}

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await fill(page, 'Email', email)
  await fill(page, 'Password', PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login$/)
}

function hole(page: Page, name: string) {
  return page.getByRole('button', { name, exact: true })
}

/* -------------------------------------------------------------------------- */

test('a student builds the first circuit, watches it save, resumes it, and hands it in', async ({ page }) => {
  studentEmail = await registerAndOnboard(page)

  /* ---- into the workspace ------------------------------------------------ */

  await page
    .getByRole('link', { name: 'Start — Series LED with current-limiting resistor', exact: true })
    .click()
  await expect(page.getByText('The board is yours')).toBeVisible()
  await page.getByRole('button', { name: 'Build the circuit' }).click()

  // The tray is the BOM, with its budget on every line.
  await expect(page.getByRole('button', { name: /Jumper wire/ })).toBeVisible()
  await expect(page.getByText('Choose a part from the tray, then click a hole on the board.')).toBeVisible()

  /* ---- supply jumper: +5V rail onto the board ---------------------------- */

  await page.getByRole('button', { name: /Jumper wire/ }).click()
  await hole(page, '+5V rail, column 3').click()
  await hole(page, 'Upper bank, column 3, row 1').click()

  // The netlist is live from the first part: the +5V row lists the wire ends.
  await expect(page.getByText('W1.1 · W1.2')).toBeVisible()

  /* ---- the resistor ------------------------------------------------------ */

  await page.getByRole('button', { name: /Current-limiting resistor/ }).click()
  await expect(page.getByText(/first leg of Current-limiting resistor/)).toBeVisible()
  await hole(page, 'Upper bank, column 3, row 2').click()
  await hole(page, 'Upper bank, column 8, row 2').click()

  // A hole one leg already sits in refuses the next one.
  await page.getByRole('button', { name: /Jumper wire/ }).click()
  await hole(page, 'Upper bank, column 3, row 2').click()
  await expect(page.getByText('That hole is taken. Pick a free one.')).toBeVisible()

  /* ---- bridge to the LED column, then the LED across the channel --------- */

  await hole(page, 'Upper bank, column 8, row 3').click()
  await hole(page, 'Upper bank, column 13, row 3').click()

  await page.getByRole('button', { name: /Indicator LED/ }).click()
  await expect(page.getByText(/anode \(\+\) leg/)).toBeVisible()
  await hole(page, 'Upper bank, column 13, row 4').click()
  await hole(page, 'Lower bank, column 13, row 2').click()

  // Placed, connected to +5V — and dark, because nothing returns to ground.
  await expect(page.getByText('D1 is dark')).toBeVisible()

  /* ---- the ground return closes the circuit ------------------------------ */

  await page.getByRole('button', { name: /Jumper wire/ }).click()
  await hole(page, 'Lower bank, column 13, row 5').click()
  await hole(page, 'Ground rail, column 15').click()

  // The payoff, all at once: the LED lights, the board is complete, and the
  // netlist reads like the landing page's demo — because it is the same idea,
  // now built by hand.
  await expect(page.getByText('D1 lights')).toBeVisible()
  await expect(page.getByText('Circuit complete').first()).toBeVisible()
  await expect(page.getByText('R1.2 · D1.A')).toBeVisible()
  await expect(page.getByText('5 / 5')).toBeVisible()

  /* ---- the test run scores it -------------------------------------------- */

  await page.getByRole('button', { name: 'Test the circuit' }).click()
  // The scan sweeps first; the verdict follows it.
  await expect(page.getByText('100%')).toBeVisible({ timeout: 5_000 })
  await expect(page.getByText('Everything checks out.')).toBeVisible()
  await expect(page.getByText('Every LED lights.')).toBeVisible()

  /* ---- the same circuit, in three dimensions ------------------------------ */

  await page.getByRole('radio', { name: '3D' }).click()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('radio', { name: '2D' }).click()
  await expect(page.getByText('R1.2 · D1.A')).toBeVisible()

  /* ---- autosave, then resume --------------------------------------------- */

  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10_000 })

  await page.reload()
  // An open attempt skips the brief: the board comes back mid-build, restored
  // from what the autosave wrote.
  await expect(page.getByText('5 / 5')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('D1 lights')).toBeVisible()

  /* ---- hand in ------------------------------------------------------------ */

  await page.getByRole('button', { name: 'Hand in', exact: true }).click()
  await expect(page.getByText('The circuit is complete.', { exact: false })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Hand in', exact: true }).click()

  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10_000 })
  // One of six done, and the totals say so — read from the API, not the toast.
  await expect(page.getByText('1 / 6').first()).toBeVisible()
})

/* -------------------------------------------------------------------------- */

test('the classic mistake gets a warning, and Undo takes it back', async ({ page }) => {
  test.skip(studentEmail === '', 'the registration test did not run')
  await signIn(page, studentEmail)

  await page.getByRole('link', { name: 'Start — Two LEDs in parallel', exact: true }).click()
  await page.getByRole('button', { name: 'Build the circuit' }).click()

  // An LED straight across the rails: lit — current would certainly flow — and
  // flagged, which is the entire lesson of this exercise's objective line.
  await page.getByRole('button', { name: /Indicator LED/ }).click()
  await hole(page, '+5V rail, column 5').click()
  await hole(page, 'Ground rail, column 5').click()

  await expect(page.getByText(/nothing to limit current/)).toBeVisible()
  await expect(page.getByText('D1 lights')).toBeVisible()

  // The scan agrees, and says where: the failed check names D1 and its column.
  await page.getByRole('button', { name: 'Test the circuit' }).click()
  await expect(page.getByText(/nothing limiting its current — columns 5/)).toBeVisible({
    timeout: 5_000,
  })
  await expect(page.getByText(/Still in the tray/)).toBeVisible()

  // Undo is real: the part, its warning and its net rows all go together.
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByText(/nothing to limit current/)).toBeHidden()
  await expect(page.getByText('Place a part and its nets appear here, live.')).toBeVisible()

  // Leaving keeps the attempt open to resume — the dashboard's Resume promise.
  await page.getByRole('button', { name: 'Save & exit' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('link', { name: 'Resume — Two LEDs in parallel', exact: true })).toBeVisible()
})

/* -------------------------------------------------------------------------- */

test('free build keeps a board on this machine and tests without a rubric', async ({ page }) => {
  test.skip(studentEmail === '', 'the registration test did not run')
  await signIn(page, studentEmail)

  await page.getByRole('link', { name: 'Free build' }).click()
  await expect(page).toHaveURL(/\/sandbox$/)

  // The shelf, not a budget: the whole kit, nothing to hand in.
  await expect(page.getByRole('button', { name: /Jumper wire/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hand in', exact: true })).toBeHidden()

  await page.getByRole('button', { name: /^LED Red/ }).click()
  await hole(page, '+5V rail, column 5').click()
  await hole(page, 'Ground rail, column 5').click()
  await expect(page.getByText('D1 lights')).toBeVisible()

  // The scan still judges the electricity — but not completeness, because
  // there is no bill of materials to finish here.
  await page.getByRole('button', { name: 'Test the circuit' }).click()
  await expect(page.getByText(/nothing limiting its current/)).toBeVisible({ timeout: 5_000 })
  await expect(page.getByText(/Still in the tray/)).toBeHidden()

  // The board belongs to this browser, and a refresh proves it.
  await page.reload()
  await expect(page.getByText('D1 lights')).toBeVisible({ timeout: 10_000 })

  // Leave it clean for the next run of this suite.
  await page.getByRole('button', { name: 'Clear board' }).click()
  await expect(page.getByText('Place a part and its nets appear here, live.')).toBeVisible()
})
