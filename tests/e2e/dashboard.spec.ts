import { expect, test, type Page } from '@playwright/test'

/**
 * The dashboard, driven the way a student drives it.
 *
 * Every figure on this screen is read from `GET /api/classes` and
 * `GET /api/exercises`, so these tests are as much a check on those two
 * endpoints as on the layout: if the progress derivation in
 * `api/routes/exercises.ts` stops distinguishing "submitted but not passed"
 * from "left open", the button under `Adjustable divider` changes word and this
 * suite says so.
 *
 * The fixture is the committed seed. Mateo Cruz has six published exercises in
 * one class: two finished, one open, one given up on, two untouched. Miguel
 * Santos is in the same class and has attempted nothing, which is the only
 * honest way to test the first-run state without resetting the database.
 *
 * Selectors are roles and accessible names. A row's button is found by its
 * `aria-label` — "Resume — Adjustable divider…" — because six buttons reading
 * "Start" is exactly the ambiguity that label exists to remove, and a test that
 * cannot tell them apart proves a screen reader cannot either.
 */

const SEED_PASSWORD = 'breadboard-dev-2026'

const CRUZ = 'cruz@students.example.edu'
const SANTOS = 'santos@students.example.edu'

/** The seeded library, and where Cruz has got to in each. */
const SERIES_LED = 'Series LED with current-limiting resistor'
const PARALLEL_LEDS = 'Two LEDs in parallel'
const POT_DIVIDER = 'Adjustable divider with a potentiometer'
const RC_FILTER = 'RC low-pass filter'
const TRANSISTOR = 'Transistor switch driving an LED'
const ASTABLE = 'Astable blinker'

async function signIn(page: Page, email: string, password = SEED_PASSWORD) {
  await page.goto('/login')
  await page.getByLabel('Email', { exact: false }).first().fill(email)
  await page.getByLabel('Password', { exact: false }).first().fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login$/)
}

/** The exercise list, as a region. Everything below reads rows out of it. */
function library(page: Page) {
  return page.getByRole('list').filter({ hasText: SERIES_LED }).first()
}

/* -------------------------------------------------------------------------- */

test.describe('the student dashboard', () => {
  test('leads with the open attempt and lists every assigned exercise beneath it', async ({ page }) => {
    await signIn(page, CRUZ)
    await expect(page).toHaveURL(/\/dashboard$/)

    /* ---- the one thing to do -------------------------------------------- */

    // An attempt is open on the potentiometer divider, so that is what the
    // screen leads with, and the word is "Resume" rather than "Start".
    await expect(page.getByText('Pick up where you left off')).toBeVisible()
    // Level 2: the same title is also an h3 down in the list, which is the point.
    await expect(page.getByRole('heading', { level: 2, name: POT_DIVIDER })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Resume', exact: true })).toBeVisible()

    /* ---- the counts ------------------------------------------------------ */

    // Six published exercises, two attempts still open in some sense, two done.
    // Read as term/definition pairs so the numbers are checked against the
    // labels they sit under rather than as loose text on the page.
    const totals = page.getByRole('definition')
    await expect(totals.filter({ hasText: 'Assigned' })).toBeVisible()
    // The readout appears twice — overall, and again on the class card — and
    // that is correct: six exercises in one class is the same six either way.
    await expect(page.getByText('2 / 6').first()).toBeVisible()
    await expect(page.getByText('2 / 6')).toHaveCount(2)

    /* ---- the whole library ----------------------------------------------- */

    // The bug this section exists for: before it, a student with six exercises
    // could reach exactly one of them from this screen.
    const rows = library(page).getByRole('listitem')
    await expect(rows).toHaveCount(6)

    for (const title of [SERIES_LED, PARALLEL_LEDS, POT_DIVIDER, RC_FILTER, TRANSISTOR, ASTABLE]) {
      await expect(library(page).getByRole('heading', { name: title })).toBeVisible()
    }

    // Unfinished first, finished last — regardless of the order the API sends.
    const titles = await rows.locator('h3').allInnerTexts()
    expect(titles).toEqual([POT_DIVIDER, RC_FILTER, TRANSISTOR, ASTABLE, SERIES_LED, PARALLEL_LEDS])
  })

  test('says Start, not Resume, for an attempt that was handed in unfinished', async ({ page }) => {
    await signIn(page, CRUZ)

    // The distinction the seed exists to produce: the RC filter has an attempt,
    // so it is in progress — but that attempt was submitted, so there is nothing
    // to reopen and the button must not promise otherwise.
    await expect(library(page).getByRole('link', { name: `Start — ${RC_FILTER}` })).toBeVisible()
    await expect(library(page).getByRole('link', { name: `Resume — ${POT_DIVIDER}` })).toBeVisible()
    await expect(library(page).getByRole('link', { name: `Review — ${SERIES_LED}` })).toBeVisible()
  })

  test('the first-run dashboard offers a start rather than an empty screen', async ({ page }) => {
    await signIn(page, SANTOS)

    /**
     * The language is set here rather than assumed.
     *
     * Santos is seeded Filipino, but `reduced motion is applied to the document`
     * in `auth.spec.ts` signs in as him and pins English — and that choice is
     * persisted to the *profile*, so it outlives the browser context and every
     * later run against the same database. This test passed in isolation and
     * failed in the suite, which is the only interesting way for it to fail.
     *
     * A shared database means order-independence has to be bought rather than
     * hoped for. The cost is two lines and the reward is that the assertion
     * below means what it says.
     */
    await page.goto('/settings')
    await page.getByRole('radio', { name: 'Filipino' }).click()
    await page.goto('/dashboard')

    // The whole screen — the list heading, the row buttons, the readout label —
    // comes out of the catalogue, and a missing key would be a build error
    // rather than an English string sitting in a Filipino UI.
    await expect(page.getByText('Simulan ang ehersisyo')).toBeVisible()
    await expect(library(page).getByRole('listitem')).toHaveCount(6)
    await expect(library(page).getByRole('link', { name: `Simulan — ${SERIES_LED}` })).toBeVisible()

    // Nothing attempted: the completion readout is honest about it.
    await expect(page.getByText('0 / 6').first()).toBeVisible()
  })
})

/* -------------------------------------------------------------------------- */
/* Where the primary action leads                                             */
/* -------------------------------------------------------------------------- */

test.describe('the exercise brief', () => {
  test('opening an exercise lands on its brief, not on the 404', async ({ page }) => {
    await signIn(page, CRUZ)
    await library(page)
      .getByRole('link', { name: `Start — ${ASTABLE}` })
      .click()

    await expect(page).toHaveURL(/\/lab\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('heading', { level: 1, name: ASTABLE })).toBeVisible()

    // The brief: what it asks for, what it takes, and the way in. The button
    // is live — the workspace behind it is `tests/e2e/workspace.spec.ts`'s job.
    await expect(page.getByText('What you will need')).toBeVisible()
    await expect(page.getByText('The board is yours')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Build the circuit' })).toBeEnabled()

    await page.getByRole('link', { name: 'Back to dashboard' }).first().click()
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('an exercise that is not yours is a designed refusal, not a crash', async ({ page }) => {
    await signIn(page, CRUZ)

    // The seeded draft. It is unpublished, so `GET /api/exercises/:id` refuses
    // it — the guard is on the API and this screen only reports the answer. The
    // wording is the same for "does not exist" and "not yours" on purpose:
    // telling them apart would be an oracle for what the class holds.
    await page.goto('/lab/0f9b1a6e-2c4d-4a11-9f3e-000000000012')
    await expect(page.getByText('That exercise is not on your list')).toBeVisible()

    // And an id that was never a UUID reaches the same place rather than a stack
    // trace.
    await page.goto('/lab/not-a-uuid')
    await expect(page.getByText('That exercise is not on your list')).toBeVisible()
  })
})
