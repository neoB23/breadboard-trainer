import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { hashPassword } from 'better-auth/crypto'
import { and, eq, inArray, notInArray, sql } from 'drizzle-orm'

import type { Bom, ProfilePreferences } from '../../shared/contracts/index.ts'
import { parseBoardState, serializeBoard, type PlacedPart } from '../../src/board/model.ts'
import { buildGoldenNetlist } from '../../src/board/netlist.ts'
import { gradeSubmission } from '../grading/submit.ts'
import { db } from './client.ts'
import {
  astableBoard,
  parallelLedsBoard,
  potDividerBoard,
  rcFilterBoard,
  seriesLedBoard,
  shiftBoard,
  transistorSwitchBoard,
} from './reference-boards.ts'
import { account, attempts, classes, enrollments, exercises, profiles, user } from './schema.ts'

/**
 * The development corpus: one instructor, three students, one class, two
 * exercises — one published, one still a draft.
 *
 * ---------------------------------------------------------------------------
 * IDEMPOTENT. Re-running this is a no-op on shape and a reset on content.
 *
 * Every row has a fixed id and every insert is an upsert, so `npm run db:seed`
 * can be run against a database that already has the seed, a database that has
 * half of it because the last run died, or an empty one. That matters more than
 * it sounds: without it the honest way to re-seed is to drop the database,
 * which takes every attempt you were mid-way through debugging with it.
 *
 * Fixed ids also mean `DEV_AUTH_USER=seed_instructor_reyes` keeps working
 * across re-seeds, which is what makes the development session provider usable.
 * ---------------------------------------------------------------------------
 *
 * There is no transaction wrapping this, deliberately. Drizzle's neon-http
 * driver has no transaction support at all — `db.transaction()` throws — and
 * this script has to run against both drivers. Upserts are what make that safe:
 * a partial run leaves valid rows, and the next run finishes the job.
 */

/**
 * Better Auth issues text ids, so `profiles.id` is text. These ids are Better
 * Auth `user.id` values too — Phase 3 gave `profiles.id` a real foreign key to
 * `"user"(id)`, so every seeded profile now has a seeded auth user behind it and
 * these accounts can genuinely sign in.
 */
export const SEED = {
  instructor: 'seed_instructor_reyes',
  students: ['seed_student_cruz', 'seed_student_santos', 'seed_student_dizon'],
  /** Valid v4 uuids — `z.uuid()` in the contracts checks the version and variant nibbles. */
  classId: '0f9b1a6e-2c4d-4a11-9f3e-000000000001',
  publishedExerciseId: '0f9b1a6e-2c4d-4a11-9f3e-000000000011',
  draftExerciseId: '0f9b1a6e-2c4d-4a11-9f3e-000000000012',
  /**
   * The rest of the library. Fixed ids for the same reason every other row has
   * one: re-seeding must not create a second copy of the same exercise, and the
   * attempts below reference these by id.
   */
  exerciseIds: {
    parallelLeds: '0f9b1a6e-2c4d-4a11-9f3e-000000000013',
    potDivider: '0f9b1a6e-2c4d-4a11-9f3e-000000000014',
    rcFilter: '0f9b1a6e-2c4d-4a11-9f3e-000000000015',
    transistorSwitch: '0f9b1a6e-2c4d-4a11-9f3e-000000000016',
    astable: '0f9b1a6e-2c4d-4a11-9f3e-000000000017',
  },
  /** Attempts, so the dashboard has a completed one and one to resume. */
  attemptIds: {
    cruzLedDone: '0f9b1a6e-2c4d-4a11-9f3e-000000000021',
    cruzParallelDone: '0f9b1a6e-2c4d-4a11-9f3e-000000000022',
    cruzRcAbandoned: '0f9b1a6e-2c4d-4a11-9f3e-000000000023',
    cruzPotOpen: '0f9b1a6e-2c4d-4a11-9f3e-000000000024',
  },
  /** Drawn from JOIN_CODE_ALPHABET: no O/0, no I/1/L. */
  joinCode: 'K7M4QP',
  /**
   * The password every seeded account shares.
   *
   * A published constant is the honest option for a development corpus: the
   * alternative is a secret nobody can use, which means the seeded accounts stop
   * being sign-in-able and the whole point of seeding them is lost. Nothing here
   * ever runs against a real database — `seed.ts` is not imported by the
   * deployed function, and these rows only exist where someone ran
   * `npm run db:seed`.
   */
  password: 'breadboard-dev-2026',
} as const

/**
 * Better Auth's credential account uses a synthetic issuer namespace so a
 * provider id can never collide with a real OAuth issuer. Transcribed from
 * `createLocalAccountIssuer('credential')` in
 * `@better-auth/core/dist/db/schema/account.mjs`; the sign-in path looks up an
 * account by exactly this triple, so a typo here is a login that silently fails.
 */
const CREDENTIAL_PROVIDER_ID = 'credential'
const CREDENTIAL_ISSUER = 'local:credential'

/** Seeded email addresses, on a domain reserved for documentation. */
const SEED_EMAIL: Record<string, string> = {
  [SEED.instructor]: 'reyes@faculty.example.edu',
  seed_student_cruz: 'cruz@students.example.edu',
  seed_student_santos: 'santos@students.example.edu',
  seed_student_dizon: 'dizon@students.example.edu',
}

/**
 * One name per person, used for both `user.name` and `profiles.full_name`.
 * Better Auth owns the first and this project owns the second; registration
 * writes both from the same field, so the seed does too.
 */
const SEED_FULL_NAME: Record<string, string> = {
  [SEED.instructor]: 'Prof. Amelia Reyes',
  seed_student_cruz: 'Andrea Cruz',
  seed_student_santos: 'Miguel Santos',
  seed_student_dizon: 'Joyce Dizon',
}

/** Everything off, which is what `preferencesSchema` parses an empty object to. */
const DEFAULT_PREFERENCES: ProfilePreferences = {
  theme: 'light',
  highContrast: false,
  reducedMotion: false,
  largerText: false,
}

const LED_CIRCUIT_BOM: Bom = [
  { id: 'r-220', type: 'resistor', label: 'Current-limiting resistor', value: '220Ω', quantity: 1 },
  { id: 'led-red', type: 'led', label: 'Indicator LED', value: 'Red 2V', quantity: 1 },
  { id: 'jumper', type: 'jumper', label: 'Jumper wire', value: null, quantity: 3 },
]

const DIVIDER_BOM: Bom = [
  { id: 'r-10k-a', type: 'resistor', label: 'Upper leg', value: '10kΩ', quantity: 1 },
  { id: 'r-10k-b', type: 'resistor', label: 'Lower leg', value: '10kΩ', quantity: 1 },
  { id: 'jumper', type: 'jumper', label: 'Jumper wire', value: null, quantity: 4 },
]

/**
 * Every published exercise carries a real reference, built from a real board
 * with the same `buildGoldenNetlist` Learn Mode capture uses — see
 * `reference-boards.ts`. A published exercise without one would be a state the
 * API itself cannot produce: `POST /teach/exercises/:id/publish` refuses it.
 */
const referenceFor = (board: PlacedPart[], bom: Bom) =>
  // Through the board parser first, exactly as capture does: it is what fills
  // each part's label and value in from the tray.
  buildGoldenNetlist(parseBoardState(serializeBoard(board), bom))

/* -------------------------------------------------------------------------- */
/* The exercise library                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Five more published exercises, so the dashboard has something to be a
 * dashboard *of*.
 *
 * With one exercise every screen downstream shows the same state, and the two
 * that matter most — "resume the one you started" and "you have finished some" —
 * cannot be seen at all. These give the library a difficulty spread, so the
 * ordering (`difficulty` then `title`) is visible, and enough rows that a list
 * looks like a list.
 *
 * Each one is a circuit a second-year lab actually sets. Nothing here is
 * lorem ipsum: an objective a student cannot act on is worse than a blank.
 */
const LIBRARY_SOURCE = [
  {
    id: SEED.exerciseIds.parallelLeds,
    title: 'Two LEDs in parallel',
    objective:
      'Drive two indicator LEDs from the same rail, each with its own current-limiting resistor. ' +
      'One resistor shared between both is the mistake to avoid.',
    difficulty: 1,
    bom: [
      { id: 'r-220-a', type: 'resistor', label: 'Limiting resistor', value: '220Ω', quantity: 2 },
      { id: 'led-red', type: 'led', label: 'Indicator LED', value: 'Red 2V', quantity: 2 },
      { id: 'jumper', type: 'jumper', label: 'Jumper wire', value: null, quantity: 4 },
    ] satisfies Bom,
    board: parallelLedsBoard(),
  },
  {
    id: SEED.exerciseIds.potDivider,
    title: 'Adjustable divider with a potentiometer',
    objective: 'Wire a 10kΩ potentiometer as a three-terminal divider and take the output from the wiper.',
    difficulty: 2,
    bom: [
      // A potentiometer is a variable resistor, and `componentTypeSchema` has no
      // separate member for one. The label carries what it actually is.
      { id: 'pot-10k', type: 'resistor', label: 'Potentiometer', value: '10kΩ', quantity: 1 },
      { id: 'jumper', type: 'jumper', label: 'Jumper wire', value: null, quantity: 4 },
    ] satisfies Bom,
    board: potDividerBoard(),
  },
  {
    id: SEED.exerciseIds.rcFilter,
    title: 'RC low-pass filter',
    objective: 'Build a 1kΩ / 100nF low-pass section and identify the corner frequency from the values.',
    difficulty: 3,
    bom: [
      { id: 'r-1k', type: 'resistor', label: 'Series resistor', value: '1kΩ', quantity: 1 },
      { id: 'c-100n', type: 'capacitor', label: 'Shunt capacitor', value: '100nF', quantity: 1 },
      { id: 'jumper', type: 'jumper', label: 'Jumper wire', value: null, quantity: 3 },
    ] satisfies Bom,
    board: rcFilterBoard(),
  },
  {
    id: SEED.exerciseIds.transistorSwitch,
    title: 'Transistor switch driving an LED',
    objective:
      'Use an NPN transistor as a low-side switch. Get the base resistor and the emitter leg right, ' +
      'and mind which pin is which.',
    difficulty: 3,
    bom: [
      { id: 'q-2n2222', type: 'transistor', label: 'NPN transistor', value: '2N2222', quantity: 1 },
      { id: 'r-1k', type: 'resistor', label: 'Base resistor', value: '1kΩ', quantity: 1 },
      { id: 'r-220', type: 'resistor', label: 'Limiting resistor', value: '220Ω', quantity: 1 },
      { id: 'led-red', type: 'led', label: 'Indicator LED', value: 'Red 2V', quantity: 1 },
      { id: 'jumper', type: 'jumper', label: 'Jumper wire', value: null, quantity: 5 },
    ] satisfies Bom,
    board: transistorSwitchBoard(),
  },
  {
    id: SEED.exerciseIds.astable,
    title: 'Astable blinker',
    objective:
      'Build a free-running oscillator that alternates two LEDs. The timing components straddle ' +
      'the centre channel, so the channel is the thing to watch.',
    difficulty: 4,
    bom: [
      { id: 'r-10k', type: 'resistor', label: 'Timing resistor', value: '10kΩ', quantity: 2 },
      // The collector loads. Without them each LED sits between +5V and a
      // switched-on transistor with nothing limiting its current — a circuit
      // the trainer itself would flag as unsafe, and so not one it can use as
      // the answer.
      { id: 'r-470', type: 'resistor', label: 'LED resistor', value: '470Ω', quantity: 2 },
      { id: 'c-10u', type: 'capacitor', label: 'Timing capacitor', value: '10µF', quantity: 2 },
      { id: 'q-2n2222', type: 'transistor', label: 'NPN transistor', value: '2N2222', quantity: 2 },
      { id: 'led-red', type: 'led', label: 'Indicator LED', value: 'Red 2V', quantity: 2 },
      { id: 'jumper', type: 'jumper', label: 'Jumper wire', value: null, quantity: 8 },
    ] satisfies Bom,
    board: astableBoard(),
  },
] satisfies {
  id: string
  title: string
  objective: string
  difficulty: number
  bom: Bom
  board: PlacedPart[]
}[]

const LIBRARY = LIBRARY_SOURCE.map(({ board, ...exercise }) => ({
  ...exercise,
  authorId: SEED.instructor,
  classId: SEED.classId,
  // Every one is published and carries a captured reference, because
  // `POST /teach/exercises/:id/publish` refuses to publish without one — a
  // seeded row the API itself could not have produced is a bad fixture.
  goldenNetlist: referenceFor(board, exercise.bom),
  netlistVersion: 1,
  published: true,
}))

/**
 * Every captured reference the seed writes, with the tray it was built from —
 * what `tests/unit/seed-references.test.ts` holds to the same bar Learn Mode
 * capture does.
 */
export const SEED_REFERENCES: readonly { exerciseId: string; bom: Bom; board: () => PlacedPart[] }[] = [
  { exerciseId: SEED.publishedExerciseId, bom: LED_CIRCUIT_BOM, board: seriesLedBoard },
  {
    exerciseId: SEED.exerciseIds.parallelLeds,
    bom: bomOf(SEED.exerciseIds.parallelLeds),
    board: parallelLedsBoard,
  },
  {
    exerciseId: SEED.exerciseIds.potDivider,
    bom: bomOf(SEED.exerciseIds.potDivider),
    board: potDividerBoard,
  },
  { exerciseId: SEED.exerciseIds.rcFilter, bom: bomOf(SEED.exerciseIds.rcFilter), board: rcFilterBoard },
  {
    exerciseId: SEED.exerciseIds.transistorSwitch,
    bom: bomOf(SEED.exerciseIds.transistorSwitch),
    board: transistorSwitchBoard,
  },
  { exerciseId: SEED.exerciseIds.astable, bom: bomOf(SEED.exerciseIds.astable), board: astableBoard },
]

function bomOf(exerciseId: string): Bom {
  const found = LIBRARY_SOURCE.find((exercise) => exercise.id === exerciseId)
  if (!found) throw new Error(`no seeded exercise ${exerciseId}`)
  return found.bom
}

export async function seed({ quiet = false }: { quiet?: boolean } = {}): Promise<void> {
  await assertMigrated()

  /* ---- auth users and credentials ---------------------------------------- */

  /**
   * `profiles.id` references `"user"(id)`, so these have to land first or every
   * profile insert below fails on the foreign key.
   *
   * All four share one password, so the scrypt hash is computed once rather than
   * four times — at Better Auth's default cost parameters each one is tens of
   * milliseconds, and the test harness calls this per test file.
   */
  const passwordHash = await hashPassword(SEED.password)
  const allUsers = [SEED.instructor, ...SEED.students]

  await db
    .insert(user)
    .values(
      allUsers.map((id) => ({
        id,
        name: SEED_FULL_NAME[id] ?? id,
        email: SEED_EMAIL[id] ?? `${id}@example.edu`,
        // Verified, so a seeded account can sign in without going through the
        // mailbox. The un-verified path is exercised by registering a new one.
        emailVerified: true,
      })),
    )
    .onConflictDoUpdate({
      target: user.id,
      set: {
        name: sql`excluded.name`,
        email: sql`excluded.email`,
        emailVerified: sql`excluded.email_verified`,
        updatedAt: new Date(),
      },
    })

  await db
    .insert(account)
    .values(
      allUsers.map((id) => ({
        id: `seed_account_${id}`,
        providerId: CREDENTIAL_PROVIDER_ID,
        issuer: CREDENTIAL_ISSUER,
        // Better Auth keys a credential account by the user's own id.
        accountId: id,
        userId: id,
        password: passwordHash,
      })),
    )
    .onConflictDoUpdate({
      target: account.id,
      set: {
        password: sql`excluded.password`,
        updatedAt: new Date(),
      },
    })

  /* ---- profiles ---------------------------------------------------------- */

  await db
    .insert(profiles)
    .values([
      {
        id: SEED.instructor,
        fullName: SEED_FULL_NAME[SEED.instructor] ?? SEED.instructor,
        role: 'instructor',
        section: 'ECE',
        locale: 'en',
        preferences: DEFAULT_PREFERENCES,
        // Instructors skip onboarding; a null here would bounce them to the
        // wizard on every login and make the seed useless for /teach work.
        onboardedAt: new Date(),
      },
      {
        id: SEED.students[0],
        fullName: SEED_FULL_NAME[SEED.students[0]] ?? SEED.students[0],
        role: 'student',
        studentNumber: '2021-00417',
        section: 'ECE-3A',
        locale: 'en',
        preferences: DEFAULT_PREFERENCES,
        onboardedAt: new Date(),
      },
      {
        id: SEED.students[1],
        fullName: SEED_FULL_NAME[SEED.students[1]] ?? SEED.students[1],
        role: 'student',
        studentNumber: '2021-00892',
        section: 'ECE-3A',
        locale: 'fil',
        // One seeded account with a non-default setting, so the Phase 4 "these
        // follow you to another machine" claim has something to prove itself on
        // without anyone having to click a toggle first.
        preferences: { ...DEFAULT_PREFERENCES, largerText: true },
        onboardedAt: new Date(),
      },
      {
        // Left un-onboarded on purpose. Phase 4's DoD is "a new user is forced
        // through onboarding exactly once", and that path needs an account that
        // has not been through it yet.
        id: SEED.students[2],
        fullName: SEED_FULL_NAME[SEED.students[2]] ?? SEED.students[2],
        role: 'student',
        studentNumber: '2021-01130',
        section: 'ECE-3B',
        locale: 'en',
        preferences: DEFAULT_PREFERENCES,
        onboardedAt: null,
      },
    ])
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        fullName: sql`excluded.full_name`,
        role: sql`excluded.role`,
        studentNumber: sql`excluded.student_number`,
        section: sql`excluded.section`,
        locale: sql`excluded.locale`,
        preferences: sql`excluded.preferences`,
        onboardedAt: sql`excluded.onboarded_at`,
      },
    })

  /* ---- class ------------------------------------------------------------- */

  await db
    .insert(classes)
    .values({
      id: SEED.classId,
      instructorId: SEED.instructor,
      name: 'ECE 3A — Electronics Laboratory',
      code: SEED.joinCode,
      term: '2026-1',
    })
    .onConflictDoUpdate({
      target: classes.id,
      set: {
        name: sql`excluded.name`,
        code: sql`excluded.code`,
        term: sql`excluded.term`,
        archived: sql`excluded.archived`,
      },
    })

  /* ---- enrollments ------------------------------------------------------- */

  // Two of the three. The third is the "no classes joined" empty state that
  // Phase 5 requires the dashboard to render properly.
  await db
    .insert(enrollments)
    .values([
      { classId: SEED.classId, studentId: SEED.students[0] },
      { classId: SEED.classId, studentId: SEED.students[1] },
    ])
    // Nothing to update — the composite key is the whole row bar `joined_at`,
    // and rewriting that on every re-seed would move the roster's join dates.
    .onConflictDoNothing()

  /* ---- exercises --------------------------------------------------------- */

  await db
    .insert(exercises)
    .values([
      {
        id: SEED.publishedExerciseId,
        authorId: SEED.instructor,
        classId: SEED.classId,
        title: 'Series LED with current-limiting resistor',
        objective:
          'Build a single LED branch from the +5V rail through a 220Ω resistor to ground, ' +
          'observing polarity.',
        difficulty: 1,
        bom: LED_CIRCUIT_BOM,
        goldenNetlist: referenceFor(seriesLedBoard(), LED_CIRCUIT_BOM),
        netlistVersion: 1,
        published: true,
      },
      {
        // The draft. Students must not see this one — it is the fixture behind
        // "unpublished exercises are invisible to students (verified at the API
        // level, not just the UI)".
        id: SEED.draftExerciseId,
        authorId: SEED.instructor,
        classId: SEED.classId,
        title: 'Resistive voltage divider',
        objective: 'Halve the rail voltage with two equal resistors and measure the midpoint.',
        difficulty: 2,
        bom: DIVIDER_BOM,
        goldenNetlist: null,
        netlistVersion: 1,
        published: false,
      },
      ...LIBRARY,
    ])
    .onConflictDoUpdate({
      target: exercises.id,
      set: {
        title: sql`excluded.title`,
        objective: sql`excluded.objective`,
        difficulty: sql`excluded.difficulty`,
        bom: sql`excluded.bom`,
        goldenNetlist: sql`excluded.golden_netlist`,
        netlistVersion: sql`excluded.netlist_version`,
        published: sql`excluded.published`,
        classId: sql`excluded.class_id`,
        authorId: sql`excluded.author_id`,
      },
    })

  /* ---- attempts ---------------------------------------------------------- */

  /**
   * Andrea Cruz's history, which is what gives the dashboard something to show.
   *
   * `progressFor()` in `api/routes/exercises.ts` derives status from these rows
   * and nothing else, so each shape here is chosen to produce one:
   *
   *   completed    any attempt with `completed: true`
   *   in_progress  an attempt exists, none completed. `openAttemptId` is the
   *                most recent one with `submitted_at` still null — that is what
   *                the Resume button reopens
   *   not_started  no rows at all
   *
   * Miguel Santos is deliberately left with none, so there is a second account
   * that shows the first-run dashboard without having to reset the database.
   */
  const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  /**
   * The seeded accounts' attempt state is the seed's *promise* — "2 done, 1 to
   * resume" is what the docs, the demo script and `tests/e2e/dashboard.spec.ts`
   * all rely on. A manual test-drive as Cruz leaves extra open attempts behind,
   * and upserting the four known rows would not take those back. So attempts by
   * seeded accounts that the seed did not write are removed here — for these
   * four accounts only; anything a registered account built is never touched.
   */
  await db
    .delete(attempts)
    .where(
      and(
        inArray(attempts.studentId, [...SEED.students, SEED.instructor]),
        notInArray(attempts.id, Object.values(SEED.attemptIds)),
      ),
    )

  /**
   * The same policy for what the seeded instructor authored: exercises and
   * classes the seed did not write — left behind by a manual test-drive of the
   * authoring screens, or by the e2e suite's own teacher — are removed, along
   * with any attempts on those exercises. Otherwise every run of the suite adds
   * another copy of its task to Prof. Reyes's list.
   */
  const seededExerciseIds = [
    SEED.publishedExerciseId,
    SEED.draftExerciseId,
    ...Object.values(SEED.exerciseIds),
  ]
  const strayExercises = db
    .select({ id: exercises.id })
    .from(exercises)
    .where(and(eq(exercises.authorId, SEED.instructor), notInArray(exercises.id, seededExerciseIds)))
  await db.delete(attempts).where(inArray(attempts.exerciseId, strayExercises))
  await db.delete(exercises).where(inArray(exercises.id, strayExercises))
  await db
    .delete(classes)
    .where(and(eq(classes.instructorId, SEED.instructor), notInArray(classes.id, [SEED.classId])))

  /**
   * The handed-in attempts carry real boards and real grades, computed with
   * the submit route's own `gradeSubmission`, so the instructor's scores list
   * and the student's result page have something true to show. The two
   * finished runs are the reference built further along the board — full
   * marks, which is the whole point — and the abandoned one is missing its
   * ground wire.
   */
  const handedIn = (exerciseId: string, board: PlacedPart[], when: Date) => {
    const reference = SEED_REFERENCES.find((entry) => entry.exerciseId === exerciseId)
    if (!reference) throw new Error(`no seeded reference for ${exerciseId}`)
    const finalState = serializeBoard(board)
    const judged = gradeSubmission(finalState, reference.bom, referenceFor(reference.board(), reference.bom))
    return {
      finalState,
      score: judged.graded?.grade.score ?? null,
      scoreBreakdown: judged.graded ?? null,
      gradedAt: judged.graded === null ? null : when,
      netlistVersion: judged.graded === null ? null : 1,
      feedback: null,
    }
  }

  await db
    .insert(attempts)
    .values([
      {
        id: SEED.attemptIds.cruzLedDone,
        studentId: SEED.students[0],
        exerciseId: SEED.publishedExerciseId,
        startedAt: daysAgo(9),
        submittedAt: daysAgo(9),
        completed: true,
        hintsUsed: 1,
        faultsEncountered: 2,
        faultsSelfResolved: 2,
        durationMs: 14 * 60_000,
        ...handedIn(SEED.publishedExerciseId, shiftBoard(seriesLedBoard(), 3), daysAgo(9)),
      },
      {
        id: SEED.attemptIds.cruzParallelDone,
        studentId: SEED.students[0],
        exerciseId: SEED.exerciseIds.parallelLeds,
        startedAt: daysAgo(5),
        submittedAt: daysAgo(5),
        completed: true,
        hintsUsed: 0,
        faultsEncountered: 1,
        faultsSelfResolved: 1,
        durationMs: 9 * 60_000,
        ...handedIn(SEED.exerciseIds.parallelLeds, shiftBoard(parallelLedsBoard(), 2), daysAgo(5)),
      },
      {
        // Submitted but not completed: a run that was given up on. It leaves the
        // exercise in_progress without an open attempt, which is the state that
        // shows "Start" rather than "Resume" despite a history existing.
        id: SEED.attemptIds.cruzRcAbandoned,
        studentId: SEED.students[0],
        exerciseId: SEED.exerciseIds.rcFilter,
        startedAt: daysAgo(2),
        submittedAt: daysAgo(2),
        completed: false,
        hintsUsed: 3,
        faultsEncountered: 4,
        faultsSelfResolved: 1,
        durationMs: 21 * 60_000,
        ...handedIn(
          SEED.exerciseIds.rcFilter,
          shiftBoard(rcFilterBoard(), 4).filter((placed) => placed.id !== 'stu-w2'),
          daysAgo(2),
        ),
      },
      {
        // The open one. `submitted_at` null is what makes this the attempt the
        // dashboard offers to resume, and why it is the newest.
        id: SEED.attemptIds.cruzPotOpen,
        studentId: SEED.students[0],
        exerciseId: SEED.exerciseIds.potDivider,
        startedAt: daysAgo(1),
        submittedAt: null,
        completed: false,
        hintsUsed: 1,
        faultsEncountered: 1,
        faultsSelfResolved: 0,
        durationMs: null,
        finalState: null,
        score: null,
        scoreBreakdown: null,
        gradedAt: null,
        netlistVersion: null,
        feedback: null,
      },
    ])
    .onConflictDoUpdate({
      target: attempts.id,
      set: {
        startedAt: sql`excluded.started_at`,
        submittedAt: sql`excluded.submitted_at`,
        completed: sql`excluded.completed`,
        hintsUsed: sql`excluded.hints_used`,
        faultsEncountered: sql`excluded.faults_encountered`,
        faultsSelfResolved: sql`excluded.faults_self_resolved`,
        durationMs: sql`excluded.duration_ms`,
        finalState: sql`excluded.final_state`,
        score: sql`excluded.score`,
        scoreBreakdown: sql`excluded.score_breakdown`,
        gradedAt: sql`excluded.graded_at`,
        netlistVersion: sql`excluded.netlist_version`,
        feedback: sql`excluded.feedback`,
      },
    })

  if (!quiet) await report()
}

/**
 * A seed run against an unmigrated database fails somewhere in the middle with
 * a driver message about a missing relation, which reads like a bug in this
 * script rather than a missing step. One cheap probe turns that into a
 * sentence.
 */
async function assertMigrated(): Promise<void> {
  try {
    await db.select({ id: profiles.id }).from(profiles).limit(1)
  } catch (err) {
    throw new Error(
      'The database has no schema yet. Run `npm run db:migrate` first.\n' +
        `  underlying error: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

async function report(): Promise<void> {
  const enrolled = await db
    .select({ studentId: enrollments.studentId })
    .from(enrollments)
    .where(eq(enrollments.classId, SEED.classId))

  const published = Object.keys(SEED.exerciseIds).length + 1

  const line = '─'.repeat(74)
  console.log(`\n${line}`)
  console.log(`  Seeded. Every account signs in with:  ${SEED.password}`)
  console.log(line)

  /**
   * Written as a table of *what each account is for* rather than a list of ids.
   *
   * The point of seeding three students is that they land on three different
   * dashboards, and that is invisible from a list of primary keys.
   */
  const accounts: [string, string, string][] = [
    [
      SEED_EMAIL[SEED.students[0]] ?? '',
      'student',
      `the populated dashboard — ${published} exercises, 2 done, 1 to resume`,
    ],
    [SEED_EMAIL[SEED.students[1]] ?? '', 'student', 'the same class, nothing attempted yet'],
    [SEED_EMAIL[SEED.students[2]] ?? '', 'student', 'never onboarded — lands in the wizard'],
    [SEED_EMAIL[SEED.instructor] ?? '', 'instructor', 'reaches /teach; a student gets 403 there'],
  ]

  for (const [email, role, note] of accounts) {
    console.log(`  ${email.padEnd(30)} ${role.padEnd(11)} ${note}`)
  }

  console.log(line)
  console.log(`  class   ${SEED.joinCode}  ·  ${enrolled.length} enrolled  ·  ${published} published`)
  console.log(`  drafts  1, invisible to students by design`)
  console.log(`${line}\n`)
  console.log('  npm run dev    then open http://localhost:5173/login\n')
}

/**
 * Only run when this file *is* the process, so the test suite can import `seed`
 * and call it against its own throwaway database. Importing a module that
 * exits the process on load is the reason this guard exists.
 */
if (isEntryPoint()) {
  await seed()
    .then(() => {
      // PGlite keeps a WASM instance and its file handles alive, and the Neon
      // HTTP driver keeps an agent. Neither is exposed through the `db` facade
      // in client.ts, so the honest way to end a one-shot script is to exit.
      process.exit(0)
    })
    .catch((err: unknown) => {
      console.error('\n[seed] failed:', err instanceof Error ? err.message : err)
      process.exit(1)
    })
}

function isEntryPoint(): boolean {
  const argv = process.argv[1]
  if (argv === undefined) return false
  // Compare resolved file paths rather than URLs: tsx rewrites the specifier,
  // and Windows drive-letter casing differs between argv and import.meta.url.
  const invoked = resolve(argv).toLowerCase()
  const self = fileURLToPath(import.meta.url).toLowerCase()
  return invoked === self || invoked === self.replace(/\.ts$/, '')
}
