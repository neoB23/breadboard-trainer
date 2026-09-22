import { expect, test, type Page } from '@playwright/test'

import { linkPath, waitForEmail } from './outbox'

/**
 * The graded task, end to end, in two browsers: the teacher authors an
 * exercise, builds its reference circuit in Learn Mode and publishes it; a
 * student builds it somewhere else on the board, hands in, and reads 100 — then
 * hands in a board missing its ground wire and reads 77 with a hint whose fix
 * waits behind a click; and the teacher's scores list has both.
 *
 * ---------------------------------------------------------------------------
 * WHY THE TEACHER MAKES A CLASS OF THEIR OWN
 *
 * `dashboard.spec.ts` counts the seeded class's six exercises for Mateo Cruz,
 * and `workspace.spec.ts` counts them for its own student. An exercise published
 * into the seeded class would change both numbers. So this suite's teacher
 * creates a fresh class through the API, and its student joins that one. The
 * seed removes the class — and the exercise — on the next run.
 * ---------------------------------------------------------------------------
 */

const SEED_PASSWORD = 'breadboard-dev-2026'
const TEACHER = 'reyes@faculty.example.edu'
const STUDENT_PASSWORD = 'correct-horse-battery-staple'

async function fill(page: Page, label: string | RegExp, value: string) {
  await page.getByLabel(label, { exact: false }).first().fill(value)
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await fill(page, 'Email', email)
  await fill(page, 'Password', password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login$/)
}

async function registerInto(page: Page, joinCode: string): Promise<void> {
  const email = `e2e-grader-${Date.now().toString(36)}@students.example.edu`

  await page.goto('/register')
  await fill(page, 'Full name', 'Nico Ramos')
  await fill(page, 'Email', email)
  await fill(page, 'Password', STUDENT_PASSWORD)
  await fill(page, 'Student number', '2026-00931')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()

  const verification = await waitForEmail(email)
  await page.goto(linkPath(verification))
  await expect(page.getByRole('heading', { name: 'Email confirmed' })).toBeVisible()

  await signIn(page, email, STUDENT_PASSWORD)
  await expect(page).toHaveURL(/\/onboarding$/)
  await page.getByRole('button', { name: 'Continue' }).click()
  await fill(page, 'Class code', joinCode)
  await page.getByRole('button', { name: 'Join class' }).click()
  await expect(page.getByText(/You are in /)).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Start using the trainer' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

function hole(page: Page, name: string) {
  return page.getByRole('button', { name, exact: true })
}

/**
 * The series LED, starting at `column` (1-based): +5V → jumper → resistor →
 * jumper → LED across the channel → jumper → ground. `withGround: false` leaves
 * the last wire off — the classic first-lab mistake.
 */
async function buildSeriesLed(page: Page, column: number, withGround = true) {
  const c = (offset: number) => column + offset

  await page.getByRole('button', { name: /^Jumper wire/ }).click()
  await hole(page, `+5V rail, column ${c(0)}`).click()
  await hole(page, `Upper bank, column ${c(0)}, row 1`).click()

  await page.getByRole('button', { name: /^Resistor/ }).click()
  await hole(page, `Upper bank, column ${c(0)}, row 2`).click()
  await hole(page, `Upper bank, column ${c(5)}, row 2`).click()

  await page.getByRole('button', { name: /^Jumper wire/ }).click()
  await hole(page, `Upper bank, column ${c(5)}, row 3`).click()
  await hole(page, `Upper bank, column ${c(10)}, row 3`).click()

  await page.getByRole('button', { name: /^LED/ }).click()
  await hole(page, `Upper bank, column ${c(10)}, row 4`).click()
  await hole(page, `Lower bank, column ${c(10)}, row 2`).click()

  if (withGround) {
    await page.getByRole('button', { name: /^Jumper wire/ }).click()
    await hole(page, `Lower bank, column ${c(10)}, row 5`).click()
    await hole(page, `Ground rail, column ${c(12)}`).click()
  }
}

async function handIn(page: Page) {
  await page.getByRole('button', { name: 'Hand in', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Hand in', exact: true }).click()
  await expect(page).toHaveURL(/\/results\/[0-9a-f-]+$/, { timeout: 20_000 })
}

test('a teacher’s reference scores a student’s hand-in, and the hints come after, not during', async ({
  browser,
}) => {
  test.setTimeout(240_000)
  const title = `Graded LED ${Date.now().toString(36)}`

  /* ---- the teacher: a class, an exercise, a reference, published ------------ */

  const teacher = await browser.newPage()
  await signIn(teacher, TEACHER, SEED_PASSWORD)

  const created = await teacher.request.post('/api/teach/classes', {
    data: { name: `E2E graded section ${Date.now().toString(36)}`, term: '2026-1' },
  })
  expect(created.ok()).toBe(true)
  const section = ((await created.json()) as { class: { name: string; code: string } }).class

  await teacher.goto('/teach')
  await teacher.getByRole('link', { name: 'New exercise' }).first().click()
  await expect(teacher).toHaveURL(/\/teach\/exercises\/new$/)

  await fill(teacher, 'Title', title)
  await fill(teacher, 'Objective', 'Light one LED from +5V through a 220Ω resistor.')
  await teacher.getByRole('combobox').click()
  await teacher.getByRole('option', { name: section.name }).click()

  await teacher.getByRole('button', { name: 'Resistor', exact: true }).click()
  await teacher.getByRole('button', { name: 'LED', exact: true }).click()
  await teacher.getByRole('button', { name: 'Jumper wire', exact: true }).click()
  const rows = teacher.getByTestId('bom-row')
  await rows.nth(0).getByLabel('Value').fill('220Ω')
  await rows.nth(1).getByLabel('Value').fill('Red 2V')

  await teacher.getByRole('button', { name: 'Create and build the reference' }).click()
  await expect(teacher).toHaveURL(/\/teach\/exercises\/[0-9a-f-]+\/capture$/, { timeout: 10_000 })
  const exerciseId = /exercises\/([0-9a-f-]+)\/capture/.exec(teacher.url())?.[1] ?? ''

  // Learn Mode refuses to capture until the board would earn full marks itself.
  await expect(teacher.getByText('Not ready to be the reference yet')).toBeVisible()
  await buildSeriesLed(teacher, 3)
  await expect(teacher.getByText('Ready to capture')).toBeVisible()
  await teacher.getByRole('button', { name: 'Capture reference' }).click()
  // .first(): a toast renders its text twice — once to read, once in the live region.
  await expect(teacher.getByText('Reference captured. Publish it when you are ready.').first()).toBeVisible()

  await teacher.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(teacher.getByText('Published', { exact: true })).toBeVisible()

  /* ---- the student: the same circuit, two columns along --------------------- */

  const student = await browser.newPage()
  await registerInto(student, section.code)

  await student.getByRole('link', { name: `Start — ${title}`, exact: true }).click()
  await student.getByRole('button', { name: 'Build the circuit' }).click()
  await buildSeriesLed(student, 5)

  // While building there are live, deterministic hints — the LED lights — and
  // no coach: nothing the student sees yet came from the server's grading.
  await expect(student.getByText('D1 lights')).toBeVisible()
  await expect(student.getByText('What to look at')).toBeHidden()

  await handIn(student)
  await expect(student.getByTestId('result-score')).toHaveText('100')
  await expect(student.getByText('It matches the task circuit')).toBeVisible()

  /* ---- again, with the ground wire left off ---------------------------------- */

  await student.getByRole('link', { name: 'Build it again' }).click()
  await student.getByRole('button', { name: 'Build it again' }).click()
  await buildSeriesLed(student, 5, false)
  await expect(student.getByText('D1 is dark')).toBeVisible()
  await handIn(student)

  await expect(student.getByTestId('result-score')).toHaveText('77')
  const hint = student.getByTestId('suggestion').first()
  await expect(hint).toContainText('Follow D1.K (column 15). Where should it connect next?')
  // Hint first: the fix is there, and waits for the student to ask.
  await expect(hint.getByText('Connect D1.K (column 15) to the ground rail.')).toBeHidden()
  await hint.getByRole('button', { name: 'Show the fix' }).click()
  await expect(hint.getByText('Connect D1.K (column 15) to the ground rail.')).toBeVisible()

  /* ---- the teacher sees both scores -------------------------------------------- */

  await teacher.goto(`/teach/exercises/${exerciseId}/submissions`)
  await expect(teacher.getByTestId('submission-row')).toHaveCount(2)
  // Newest first: the broken board, then the full-marks one.
  await expect(teacher.getByTestId('submission-score')).toHaveText([/^77\s*\/\s*100$/, /^100\s*\/\s*100$/])

  await teacher.close()
  await student.close()
})
