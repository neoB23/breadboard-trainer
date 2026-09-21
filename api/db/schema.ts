import { sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import {
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import { user } from './auth-schema.ts'

/**
 * The single source of truth for the database. Section 2 of docs/build-plan.md
 * is the semantic target; this file is what actually ships, and drizzle-kit
 * derives every migration from it. Never edit the database by hand.
 *
 * Four deliberate departures from the SQL in the plan, each documented at the
 * point it occurs:
 *   1. Foreign keys to `profiles` are `text`, not `uuid` — see `profiles.id`.
 *   2. Columns that carry a default are also `not null`. Otherwise a default the
 *      caller never overrides still reads back as `number | null`, which puts a
 *      `?? 0` on every consumer of `hints_used` and its neighbours for no gain.
 *   3. A handful of indexes the plan does not list, each named for the query it
 *      exists to serve.
 *   4. `profiles.preferences` — a column section 2 has no entry for. See the
 *      note on it below.
 *
 * Better Auth's own four tables live in `auth-schema.ts` and are re-exported at
 * the foot of this file, so drizzle-kit sees one schema graph and `profiles.id`
 * can carry a real foreign key to `"user"(id)`.
 */

/* -------------------------------------------------------------------------- */
/* profiles                                                                   */
/* -------------------------------------------------------------------------- */

export const ROLES = ['student', 'instructor', 'admin'] as const
export type Role = (typeof ROLES)[number]

export const profiles = pgTable(
  'profiles',
  {
    /**
     * Better Auth's `user.id`, which is a text id — not a uuid.
     *
     * Phase 2 left this without a foreign key because the `"user"` table did not
     * exist yet; Phase 3 adds both, and the cascade is what guarantees a deleted
     * account cannot leave an orphaned profile that `loadSessionForUser` would
     * happily resolve.
     *
     * This is why every column below that points at a profile is `text`. The
     * plan's SQL is internally inconsistent on exactly this point — it declares
     * `profiles.id text` and then `instructor_id uuid references profiles(id)`,
     * which no Postgres will accept.
     */
    id: text('id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    fullName: text('full_name').notNull(),
    /**
     * A check constraint rather than a pg enum, as the plan specifies. Widening
     * a check is a plain ALTER; widening an enum is not.
     */
    role: text('role').$type<Role>().notNull(),
    studentNumber: text('student_number'),
    section: text('section'),
    locale: text('locale').notNull().default('en'),
    /**
     * Accessibility and display settings, so a student's choices follow them to
     * a lab machine (Phase 4 task 5). Section 2 of the build plan has no column
     * for these and `profileSchema` in the contracts has required them since
     * Phase 2 — this is the migration that closes that gap.
     *
     * One jsonb rather than four booleans, deliberately. Part B adds more
     * toggles (camera easing, fault highlight intensity) and each one would
     * otherwise be a migration; `preferencesSchema` gives every field a default,
     * so a row written before a toggle existed still parses and the new toggle
     * simply reads as off.
     *
     * `not null default '{}'` rather than nullable: an absent object and an
     * empty one would mean the same thing, and a nullable jsonb puts a `?? {}`
     * on every reader.
     */
    preferences: jsonb('preferences').notNull().default({}),
    /** Null until onboarding completes. Phase 4 redirects on exactly this. */
    onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('profiles_role_check', sql`${t.role} in ('student','instructor','admin')`)],
)

/* -------------------------------------------------------------------------- */
/* classes                                                                    */
/* -------------------------------------------------------------------------- */

export const classes = pgTable(
  'classes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * No ON DELETE. Deleting an instructor who still owns classes must fail
     * loudly rather than silently taking a term of rosters, exercises and
     * attempts with it.
     */
    instructorId: text('instructor_id')
      .notNull()
      .references(() => profiles.id),
    name: text('name').notNull(),
    /**
     * The 6-character join code students type during onboarding. Unique, and
     * case-sensitive at the database level — normalise to upper case both where
     * it is issued and where it is looked up, or `AB12CD` and `ab12cd` become
     * two different classes.
     */
    code: text('code').notNull().unique(),
    term: text('term'),
    archived: boolean('archived').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /** `/teach` — the classes I own. */
    index('classes_instructor_idx').on(t.instructorId),
  ],
)

/* -------------------------------------------------------------------------- */
/* enrollments                                                                */
/* -------------------------------------------------------------------------- */

export const enrollments = pgTable(
  'enrollments',
  {
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.classId, t.studentId] }),
    /**
     * The composite primary key already indexes class -> students, which is the
     * roster. This is the other direction, student -> classes, which the
     * dashboard runs on every load.
     */
    index('enrollments_student_idx').on(t.studentId),
  ],
)

/* -------------------------------------------------------------------------- */
/* exercises                                                                  */
/* -------------------------------------------------------------------------- */

export const exercises = pgTable(
  'exercises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authorId: text('author_id').references(() => profiles.id),
    classId: uuid('class_id').references(() => classes.id),
    title: text('title').notNull(),
    objective: text('objective'),
    difficulty: integer('difficulty'),
    schematicUrl: text('schematic_url'),
    /**
     * Allowed components. Left as `unknown` on purpose: the shape of every jsonb
     * column here belongs to the Zod contracts in shared/contracts and is
     * validated at the API boundary. A `$type` on jsonb is an assertion the
     * database cannot keep, and it stops being true the first time a row written
     * by an older release is read back by a newer one.
     */
    bom: jsonb('bom').notNull().default([]),
    /**
     * THE column. Captured in Learn Mode (Phase 12) and never, under any
     * circumstance, serialised to a student. See `exerciseStudentColumns`.
     */
    goldenNetlist: jsonb('golden_netlist'),
    /** Bumped on re-capture so an in-flight attempt can detect a stale reference. */
    netlistVersion: integer('netlist_version').notNull().default(1),
    published: boolean('published').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('exercises_difficulty_check', sql`${t.difficulty} between 1 and 5`),
    /** Student dashboard: the published exercises for a class I am in. */
    index('exercises_class_idx').on(t.classId),
  ],
)

/* -------------------------------------------------------------------------- */
/* THE GOLDEN NETLIST RULE                                                    */
/* -------------------------------------------------------------------------- */

export type Exercise = typeof exercises.$inferSelect
export type NewExercise = typeof exercises.$inferInsert

/**
 * Everything a student is ever allowed to see of an exercise. Deriving it with
 * `Omit` rather than listing the keys means a column added to `exercises` later
 * breaks the build here until someone decides, explicitly, which side of the
 * line it falls on.
 */
export type StudentExercise = Omit<Exercise, 'goldenNetlist'>

/**
 * Student-facing projection. `golden_netlist` is absent and cannot be added back
 * by accident: the `satisfies` clause is keyed on `StudentExercise`, so writing
 * `goldenNetlist: exercises.goldenNetlist` here fails to compile as an excess
 * property. That compile error is the enforcement; the rest is convention.
 *
 * Why it matters: a student who can read the golden netlist can pass every
 * exercise without building anything, which invalidates the premise of the
 * trainer. So in any handler reachable by a student session, never call
 * `select()` with no argument and never call `db.query.exercises.*` without a
 * `columns` filter — both return the whole row.
 */
export const exerciseStudentColumns = {
  id: exercises.id,
  authorId: exercises.authorId,
  classId: exercises.classId,
  title: exercises.title,
  objective: exercises.objective,
  difficulty: exercises.difficulty,
  schematicUrl: exercises.schematicUrl,
  bom: exercises.bom,
  netlistVersion: exercises.netlistVersion,
  published: exercises.published,
  createdAt: exercises.createdAt,
} satisfies Record<keyof StudentExercise, AnyPgColumn>

/** Instructor-facing projection — the whole row, golden netlist included. */
export const exerciseInstructorColumns = {
  ...exerciseStudentColumns,
  goldenNetlist: exercises.goldenNetlist,
} satisfies Record<keyof Exercise, AnyPgColumn>

/* -------------------------------------------------------------------------- */
/* attempts                                                                   */
/* -------------------------------------------------------------------------- */

export const attempts = pgTable(
  'attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: text('student_id')
      .notNull()
      .references(() => profiles.id),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    /** Null while the attempt is in progress; Phase 7 resumes on exactly this. */
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    completed: boolean('completed').notNull().default(false),
    /** Board snapshot. Serialised by Phase 10, restored on resume. */
    finalState: jsonb('final_state'),
    hintsUsed: integer('hints_used').notNull().default(0),
    faultsEncountered: integer('faults_encountered').notNull().default(0),
    faultsSelfResolved: integer('faults_self_resolved').notNull().default(0),
    durationMs: integer('duration_ms'),
  },
  (t) => [
    /** "My attempts", and "my attempt at this exercise" for the resume check. */
    index('attempts_student_exercise_idx').on(t.studentId, t.exerciseId),
    /** Instructor analytics, which aggregate by exercise across a whole class. */
    index('attempts_exercise_idx').on(t.exerciseId),
  ],
)

/* -------------------------------------------------------------------------- */
/* events                                                                     */
/* -------------------------------------------------------------------------- */

export const EVENT_TYPES = ['place', 'remove', 'move', 'scan', 'fault', 'hint', 'resolve', 'submit'] as const
export type EventType = (typeof EVENT_TYPES)[number]

export const events = pgTable(
  'events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    attemptId: uuid('attempt_id').references(() => attempts.id, { onDelete: 'cascade' }),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
    /**
     * Constrained in TypeScript by `EventType`, deliberately not by a check
     * constraint: Phases 13 and 17 add fault and hint sub-classes, and a check
     * would mean a migration for each. This table has exactly one writer.
     */
    type: text('type').$type<EventType>().notNull(),
    payload: jsonb('payload'),
  },
  (t) => [
    /**
     * Fault isolation time is a delta between `ts` values within one attempt,
     * read in order — the headline number of the results chapter. This index is
     * that query.
     */
    index('events_attempt_ts_idx').on(t.attemptId, t.ts),
  ],
)

/* -------------------------------------------------------------------------- */
/* row types                                                                  */
/* -------------------------------------------------------------------------- */

export type Profile = typeof profiles.$inferSelect
export type NewProfile = typeof profiles.$inferInsert
export type Class = typeof classes.$inferSelect
export type NewClass = typeof classes.$inferInsert
export type Enrollment = typeof enrollments.$inferSelect
export type NewEnrollment = typeof enrollments.$inferInsert
export type Attempt = typeof attempts.$inferSelect
export type NewAttempt = typeof attempts.$inferInsert
export type Event = typeof events.$inferSelect
export type NewEvent = typeof events.$inferInsert

/* -------------------------------------------------------------------------- */
/* Better Auth                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Re-exported so `import * as schema from './schema.ts'` — which is what both
 * `api/db/client.ts` and drizzle.config.ts consume — sees a single graph
 * containing both halves. Splitting the file keeps the library's shapes
 * visibly separate from ours; splitting the *schema* would mean two migration
 * histories and a foreign key that could never be emitted.
 */
export * from './auth-schema.ts'
