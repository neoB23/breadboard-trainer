import { expect, test, type Page } from '@playwright/test'

import { countEmailsTo, linkPath, waitForEmail } from './outbox'

/**
 * Phase 3 DoD: "Playwright test covers register/login/logout."
 *
 * Everything below drives the real stack in a real browser — real Postgres, real
 * Better Auth cookies, real tokens with real expiry. The only substitution is the
 * email transport, which writes to `.e2e-outbox/` so the test can open the link
 * the server genuinely sent. No token is ever handed to the test directly.
 *
 * Selectors are roles and accessible names, not classes or test ids. That is
 * partly discipline — a test that can only find a button by `data-testid` is not
 * proving the button is reachable — and partly leverage: it means these tests
 * also fail if a label loses its `<label for>` or a button loses its name.
 */

const PASSWORD = 'correct-horse-battery-staple'
const SEED_PASSWORD = 'breadboard-dev-2026'

/**
 * A fresh address per run, so the suite can be run twice in a row against a
 * database it does not own. `test.info().workerIndex` disambiguates if this ever
 * goes parallel.
 */
function newEmail(label: string): string {
  return `e2e-${label}-${Date.now().toString(36)}@students.example.edu`
}

/** Fills a field by its visible label — the same way a person finds it. */
async function fill(page: Page, label: string | RegExp, value: string) {
  await page.getByLabel(label, { exact: false }).first().fill(value)
}

/* -------------------------------------------------------------------------- */
/* The journey the DoD names                                                  */
/* -------------------------------------------------------------------------- */

test.describe('register, confirm, sign in, sign out', () => {
  test('a new student can get all the way in and all the way back out', async ({ page }) => {
    const email = newEmail('journey')

    /* ---- register ------------------------------------------------------- */

    await page.goto('/register')
    await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible()

    await fill(page, 'Full name', 'Rowena Bautista')
    await fill(page, 'Email', email)
    await fill(page, 'Password', PASSWORD)
    await fill(page, 'Student number', '2026-00123')
    await page.getByRole('button', { name: 'Create account' }).click()

    // No session yet: the address is unconfirmed, so the form is replaced by the
    // screen that says what to do next rather than by a dashboard.
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
    await expect(page.getByText(email)).toBeVisible()

    /* ---- the account is unusable until the link is opened ---------------- */

    await page.goto('/login')
    await fill(page, 'Email', email)
    await fill(page, 'Password', PASSWORD)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expect(page.getByText('Confirm your email first')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)

    /* ---- confirm -------------------------------------------------------- */

    const verification = await waitForEmail(email)
    expect(verification.subject).toContain('Confirm your email')

    await page.goto(linkPath(verification))
    await expect(page.getByRole('heading', { name: 'Email confirmed' })).toBeVisible()

    /* ---- sign in -------------------------------------------------------- */

    await page.goto('/login')
    await fill(page, 'Email', email)
    await fill(page, 'Password', PASSWORD)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    // A brand-new account has not been onboarded, so this is where it lands.
    await expect(page).toHaveURL(/\/onboarding$/)
    await expect(page.getByRole('heading', { name: 'Confirm your details' })).toBeVisible()

    /* ---- survive a refresh ---------------------------------------------- */

    await page.reload()
    await expect(page).toHaveURL(/\/onboarding$/)
    await expect(page.getByRole('heading', { name: 'Confirm your details' })).toBeVisible()

    /* ---- sign out ------------------------------------------------------- */

    // Onboarding has no shell around it, so the sign-out here is the API call the
    // shell's menu item makes. The menu path is covered in the next test.
    await page.evaluate(() => fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }))
    await page.goto('/onboarding')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('a confirmed link cannot be used twice', async ({ page }) => {
    const email = newEmail('replay')

    await page.goto('/register')
    await fill(page, 'Full name', 'Bayani Ocampo')
    await fill(page, 'Email', email)
    await fill(page, 'Password', PASSWORD)
    await fill(page, 'Student number', '2026-00456')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()

    const message = await waitForEmail(email)
    const link = linkPath(message)

    await page.goto(link)
    await expect(page.getByRole('heading', { name: 'Email confirmed' })).toBeVisible()

    // The token is a stateless JWT and is still cryptographically valid — the
    // replay tombstone in api/auth/single-use.ts is what refuses it.
    await page.goto(link)
    await expect(page.getByRole('heading', { name: 'That link has already been used' })).toBeVisible()
  })

  test('a forged link is invalid however many times it is opened', async ({ page }) => {
    // The regression this guards only shows on the *second* attempt: claiming the
    // token before verifying it gives a forged link a tombstone of its own, and
    // the next try then reports "already used" instead of "not valid".
    const forged = '/verify-email?token=eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImV2aWxAeC5jb20ifQ.nope'

    for (const attempt of [1, 2, 3]) {
      await page.goto(forged)
      await expect(
        page.getByRole('heading', { name: 'That link is not valid' }),
        `attempt ${attempt}`,
      ).toBeVisible()
    }
  })
})

/* -------------------------------------------------------------------------- */
/* Signing in and out through the interface                                   */
/* -------------------------------------------------------------------------- */

test.describe('a seeded student', () => {
  test('signs in, is returned to the page they asked for, and signs out from the menu', async ({ page }) => {
    // Ask for a protected page while signed out.
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/login$/)

    await fill(page, 'Email', 'cruz@students.example.edu')
    await fill(page, 'Password', SEED_PASSWORD)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    // Not the dashboard — the page originally requested.
    await expect(page).toHaveURL(/\/settings$/)
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

    // Still signed in after a hard reload, which is the check that fails when a
    // route guard treats "not yet known" as "signed out".
    await page.reload()
    await expect(page).toHaveURL(/\/settings$/)

    await page.getByRole('button', { name: 'Account menu' }).click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()

    await page.goto('/settings')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('sees a designed 403 at /teach rather than a crash or a redirect', async ({ page }) => {
    await signIn(page, 'cruz@students.example.edu', SEED_PASSWORD)

    await page.goto('/teach')

    // Still on /teach: a redirect would make a permissions problem look like a
    // broken link. The API refuses the same request with 403 regardless.
    await expect(page).toHaveURL(/\/teach$/)
    await expect(page.getByText('Error 403')).toBeVisible()
    // EmptyState renders its title as a paragraph on purpose — it stands in for
    // list content and must not inject a heading level into the page outline.
    await expect(page.getByText('That area is for instructors')).toBeVisible()
    await expect(page.getByText('Signed in as Andrea Cruz')).toBeVisible()
  })

  test('an instructor reaches the same route', async ({ page }) => {
    // The counterpart to the case above — without it, a guard that refused
    // everybody would pass the 403 test.
    await signIn(page, 'reyes@faculty.example.edu', SEED_PASSWORD)

    await page.goto('/teach')
    await expect(page.getByRole('heading', { name: 'Teaching' })).toBeVisible()
  })
})

/* -------------------------------------------------------------------------- */
/* Password reset, end to end                                                 */
/* -------------------------------------------------------------------------- */

test('a forgotten password can be reset from the emailed link', async ({ page }) => {
  const email = newEmail('reset')

  // A fresh, confirmed account, so the reset does not disturb the seed.
  await page.goto('/register')
  await fill(page, 'Full name', 'Ligaya Mendoza')
  await fill(page, 'Email', email)
  await fill(page, 'Password', PASSWORD)
  await fill(page, 'Student number', '2026-00789')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.goto(linkPath(await waitForEmail(email)))
  await expect(page.getByRole('heading', { name: 'Email confirmed' })).toBeVisible()

  const before = countEmailsTo(email)

  await page.goto('/forgot-password')
  await fill(page, 'Email', email)
  await page.getByRole('button', { name: 'Email me a link' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()

  const reset = await waitForEmail(email, { after: before })
  expect(reset.subject).toContain('Reset your')

  const next = 'a-completely-different-password'
  await page.goto(linkPath(reset))
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible()
  await fill(page, 'New password', next)
  await fill(page, 'Confirm new password', next)
  await page.getByRole('button', { name: 'Save and sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Password changed' })).toBeVisible()

  // The old one is genuinely gone.
  await page.goto('/login')
  await fill(page, 'Email', email)
  await fill(page, 'Password', PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByText('do not match an account')).toBeVisible()

  // The new one works.
  await fill(page, 'Password', next)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/onboarding$/)
})

/* -------------------------------------------------------------------------- */
/* The instructor gate                                                        */
/* -------------------------------------------------------------------------- */

test('self-registration cannot produce an instructor', async ({ page }) => {
  const email = newEmail('faculty')

  await page.goto('/register')
  await page.getByRole('radio', { name: 'Instructor' }).click()

  await fill(page, 'Full name', 'Mallory Faculty')
  await fill(page, 'Email', email)
  await fill(page, 'Password', PASSWORD)
  await fill(page, 'Instructor invite code', 'not-the-real-code')
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByText('That instructor invite code is not valid.').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeHidden()

  // The gate is the API's, not the form's: nothing was created.
  // Everything page.evaluate needs travels as an argument: it runs in the
  // browser, which cannot see this module's scope.
  const created = await page.evaluate(
    async ([address, password]) =>
      (
        await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: address, password }),
        })
      ).status,
    [email, PASSWORD],
  )
  expect(created).toBe(401)
})

/* -------------------------------------------------------------------------- */
/* What the client is allowed to keep                                         */
/* -------------------------------------------------------------------------- */

test('the session lives only in an httpOnly cookie', async ({ page, context }) => {
  await signIn(page, 'cruz@students.example.edu', SEED_PASSWORD)
  await page.goto('/settings')

  const stored = await page.evaluate(() => ({
    local: Object.entries(localStorage),
    session: Object.entries(sessionStorage),
  }))

  const looksLikeCredential = /token|jwt|bearer|password|secret/i
  const offending = [...stored.local, ...stored.session].filter(
    ([key, value]) => looksLikeCredential.test(key) || looksLikeCredential.test(String(value)),
  )
  expect(offending, 'nothing credential-shaped in web storage').toEqual([])

  // httpOnly, from the only side that can actually observe it.
  const visibleToScript = await page.evaluate(() => document.cookie)
  expect(visibleToScript).not.toContain('session_token')

  // …and the cookie is genuinely there, so the assertion above is not vacuous.
  const cookies = await context.cookies()
  const session = cookies.find((cookie) => cookie.name === 'bbt.session_token')
  expect(session, 'the session cookie exists').toBeDefined()
  expect(session?.httpOnly).toBe(true)
  expect(session?.sameSite).toBe('Lax')
})

/* -------------------------------------------------------------------------- */
/* Phase 4                                                                    */
/* -------------------------------------------------------------------------- */

test('a new account is walked through onboarding exactly once', async ({ page }) => {
  const email = newEmail('onboard')

  await page.goto('/register')
  await fill(page, 'Full name', 'Teodoro Villar')
  await fill(page, 'Email', email)
  await fill(page, 'Password', PASSWORD)
  await fill(page, 'Student number', '2026-00999')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.goto(linkPath(await waitForEmail(email)))
  await signIn(page, email, PASSWORD)

  await expect(page).toHaveURL(/\/onboarding$/)

  // Step 1 — identity.
  await page.getByRole('button', { name: 'Continue' }).click()

  // Step 2 — a bad code must not clear the field.
  await expect(page.getByRole('heading', { name: 'Join your class' })).toBeVisible()
  await fill(page, 'Class code', 'ZZZZZZ')
  await page.getByRole('button', { name: 'Join class' }).click()
  await expect(page.getByText('No class has that code')).toBeVisible()
  await expect(page.getByLabel('Class code')).toHaveValue('ZZZZZZ')

  // The seeded code works.
  await page.getByLabel('Class code').fill('K7M4QP')
  await page.getByRole('button', { name: 'Join class' }).click()
  await expect(page.getByText(/You are in /)).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  // Step 3 — finish.
  await expect(page.getByRole('heading', { name: 'How this works' })).toBeVisible()
  await page.getByRole('button', { name: 'Start using the trainer' }).click()

  await expect(page).toHaveURL(/\/dashboard$/)

  // Never again — including on a brand-new session, which is the only honest
  // way to check a flag rather than a client-side state machine.
  await page.evaluate(() => fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }))
  await signIn(page, email, PASSWORD)
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.goto('/settings')
  await expect(page).toHaveURL(/\/settings$/)
})

test('the language toggle switches every string, and follows the account', async ({ page }) => {
  await signIn(page, 'cruz@students.example.edu', SEED_PASSWORD)
  await page.goto('/settings')

  await page.getByRole('radio', { name: 'Filipino' }).click()
  await expect(page.getByRole('heading', { name: 'Palitan ang password mo' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Change your password' })).toBeHidden()
  await expect(page.locator('html')).toHaveAttribute('lang', 'fil')

  // Persisted to the profile, not just to this browser: a reload with storage
  // cleared still comes back Filipino.
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Palitan ang password mo' })).toBeVisible()

  // And back. The option is labelled "English" in both catalogues on purpose —
  // a Filipino speaker looking for English must not have to recognise "Ingles".
  await page.getByRole('radio', { name: 'English' }).click()
  await expect(page.getByRole('heading', { name: 'Change your password' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('reduced motion is applied to the document and follows the account', async ({ page }) => {
  await signIn(page, 'santos@students.example.edu', SEED_PASSWORD)
  await page.goto('/settings')

  // Santos is seeded with locale 'fil', so pin the language first rather than
  // assuming the labels are English. The option is findable either way because
  // the language names are endonyms in both catalogues.
  await page.getByRole('radio', { name: 'English' }).click()

  const toggle = page.getByRole('switch', { name: 'Reduce motion' })
  await toggle.click()
  await expect(page.locator('html')).toHaveClass(/reduce-motion/)

  // The class is only half of it — this is the check that it reaches computed
  // style, which is what "disables all transitions app-wide" actually means.
  const duration = await page.evaluate(() => {
    const probe = document.createElement('div')
    probe.className = 'transition-colors duration-200'
    document.body.appendChild(probe)
    const value = getComputedStyle(probe).transitionDuration
    probe.remove()
    return value
  })
  expect(parseFloat(duration)).toBeLessThan(0.001)

  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/reduce-motion/)

  // Put it back, so the seeded account is left as the seed describes it.
  await page.getByRole('switch', { name: 'Reduce motion' }).click()
  await expect(page.locator('html')).not.toHaveClass(/reduce-motion/)
})

/* -------------------------------------------------------------------------- */

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await fill(page, 'Email', email)
  await fill(page, 'Password', password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login$/)
}
