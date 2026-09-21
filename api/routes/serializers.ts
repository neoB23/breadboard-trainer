// Instructor-only contracts are kept out of the barrel so a student bundle
// cannot reach the golden netlist shape even transitively.
import {
  goldenNetlistSchema,
  type ExerciseInstructor,
  type GoldenNetlist,
} from '../../shared/contracts/exercises-instructor.ts'
import {
  bomSchema,
  localeSchema,
  preferencesSchema,
  type Bom,
  type ExerciseStudent,
  type JsonValue,
  type Locale,
  type Profile,
  type ProfilePreferences,
  type PublicProfile,
  type Attempt as WireAttempt,
  type AttemptSummary as WireAttemptSummary,
  type Class as WireClass,
  type ClassSummary as WireClassSummary,
} from '../../shared/contracts/index.ts'
import type { Attempt, Class, Role } from '../db/schema.ts'

/**
 * Database row to wire shape. Every handler serialises through this file, which
 * is what makes the two conventions in `shared/contracts/common.ts` true rather
 * than aspirational: the wire is camelCase, and timestamps are ISO strings.
 *
 * Drizzle hands back `Date` objects for timestamptz. `c.json()` would stringify
 * them anyway, but doing it here means the handler's return type is the
 * contract type, so a mismatch is a compile error instead of something a client
 * discovers at runtime.
 */

export function iso(value: Date): string {
  return value.toISOString()
}

export function isoOrNull(value: Date | null): string | null {
  return value === null ? null : value.toISOString()
}

/* -------------------------------------------------------------------------- */
/* jsonb columns                                                              */
/* -------------------------------------------------------------------------- */

/**
 * `bom` and `golden_netlist` are jsonb, which Drizzle types as `unknown` — a
 * `$type<Bom>()` there would be an assertion Postgres cannot keep, and it stops
 * being true the first time a row written by an older release is read back.
 *
 * So they are parsed on the way out. A row that fails to parse is a real
 * possibility across a schema change, and the honest response is an empty tray
 * plus a log line, not a 500 that takes down the whole exercise list.
 */
export function toBom(value: unknown, exerciseId: string): Bom {
  const parsed = bomSchema.safeParse(value ?? [])
  if (parsed.success) return parsed.data

  console.warn(`[api] exercise ${exerciseId} has an unreadable bill of materials; serving an empty one`)
  return []
}

export function toGoldenNetlist(value: unknown, exerciseId: string): GoldenNetlist | null {
  if (value === null || value === undefined) return null

  const parsed = goldenNetlistSchema.safeParse(value)
  if (parsed.success) return parsed.data

  console.warn(`[api] exercise ${exerciseId} has an unreadable golden netlist`)
  return null
}

/**
 * Board state and telemetry payloads pass straight through. Their interiors
 * belong to `src/board/` (Phase 10) and Phase 17 respectively, and
 * `boardStateSchema` is `z.json()` — running a recursive validator over a
 * 20-component board on every autosave read would cost more than it proves,
 * and this column has exactly one writer.
 */
export function toJson(value: unknown): JsonValue {
  return (value ?? null) as JsonValue
}

/* -------------------------------------------------------------------------- */
/* Exercises                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The row type is structural rather than `typeof exercises.$inferSelect` on
 * purpose: it accepts exactly the columns in `exerciseStudentColumns` and
 * nothing more, so a caller who passes a whole exercise row here is not
 * silently accepted.
 */
export interface StudentExerciseRowShape {
  id: string
  authorId: string | null
  classId: string | null
  title: string
  objective: string | null
  difficulty: number | null
  schematicUrl: string | null
  bom: unknown
  netlistVersion: number
  published: boolean
  createdAt: Date
}

export function toStudentExercise(row: StudentExerciseRowShape): ExerciseStudent {
  return {
    id: row.id,
    classId: row.classId,
    authorId: row.authorId,
    title: row.title,
    objective: row.objective,
    difficulty: row.difficulty,
    schematicUrl: row.schematicUrl,
    bom: toBom(row.bom, row.id),
    netlistVersion: row.netlistVersion,
    published: row.published,
    createdAt: iso(row.createdAt),
  }
}

/** Only ever reachable from /api/teach/*. See the golden netlist rule. */
export function toInstructorExercise(
  row: StudentExerciseRowShape & { goldenNetlist: unknown },
): ExerciseInstructor {
  return {
    ...toStudentExercise(row),
    goldenNetlist: toGoldenNetlist(row.goldenNetlist, row.id),
  }
}

/* -------------------------------------------------------------------------- */
/* Classes                                                                    */
/* -------------------------------------------------------------------------- */

export function toClass(row: Class): WireClass {
  return {
    id: row.id,
    instructorId: row.instructorId,
    name: row.name,
    code: row.code,
    term: row.term,
    archived: row.archived,
    createdAt: iso(row.createdAt),
  }
}

export interface ClassSummaryRowShape {
  id: string
  instructorId: string
  name: string
  code: string
  term: string | null
  archived: boolean
  createdAt: Date
  instructorName: string
  studentCount: number
  exerciseCount: number
}

export function toClassSummary(row: ClassSummaryRowShape): WireClassSummary {
  return {
    id: row.id,
    instructorId: row.instructorId,
    name: row.name,
    code: row.code,
    term: row.term,
    archived: row.archived,
    createdAt: iso(row.createdAt),
    instructorName: row.instructorName,
    studentCount: row.studentCount,
    exerciseCount: row.exerciseCount,
  }
}

/* -------------------------------------------------------------------------- */
/* Attempts                                                                   */
/* -------------------------------------------------------------------------- */

export function toAttempt(row: Attempt): WireAttempt {
  return {
    ...toAttemptSummary(row),
    finalState: row.finalState === null ? null : toJson(row.finalState),
  }
}

/** No board state. A 20-component snapshot per row is how a list endpoint becomes the slowest thing in the app. */
export function toAttemptSummary(row: Attempt): WireAttemptSummary {
  return {
    id: row.id,
    studentId: row.studentId,
    exerciseId: row.exerciseId,
    startedAt: iso(row.startedAt),
    submittedAt: isoOrNull(row.submittedAt),
    completed: row.completed,
    hintsUsed: row.hintsUsed,
    faultsEncountered: row.faultsEncountered,
    faultsSelfResolved: row.faultsSelfResolved,
    durationMs: row.durationMs,
  }
}

/* -------------------------------------------------------------------------- */
/* Profiles                                                                   */
/* -------------------------------------------------------------------------- */

export interface PublicProfileRowShape {
  id: string
  fullName: string
  role: Role
  studentNumber: string | null
  section: string | null
}

/**
 * `publicProfileSchema`, not `profileSchema`. A roster gives an instructor a
 * student's name, number and section — it does not give them that student's
 * locale, accessibility settings or onboarding timestamps.
 */
export function toPublicProfile(row: PublicProfileRowShape): PublicProfile {
  return {
    id: row.id,
    fullName: row.fullName,
    role: row.role,
    studentNumber: row.studentNumber,
    section: row.section,
  }
}

export interface ProfileRowShape extends PublicProfileRowShape {
  locale: string
  onboardedAt: Date | null
  preferences: unknown
  createdAt: Date
}

/**
 * The owner's own profile — everything `publicProfileSchema` withholds, plus the
 * accessibility settings. Only ever serialised for the caller themselves, from
 * `/api/auth/me` and `/api/profile`.
 */
export function toProfile(row: ProfileRowShape): Profile {
  return {
    ...toPublicProfile(row),
    locale: toLocale(row.locale, row.id),
    onboardedAt: isoOrNull(row.onboardedAt),
    preferences: toPreferences(row.preferences, row.id),
    createdAt: iso(row.createdAt),
  }
}

/**
 * `profiles.locale` is a plain text column with a default rather than a check
 * constraint, so a value outside the contract's enum is reachable — a row
 * written by a future release, or by hand. Falling back to English is the
 * honest response; refusing to serialise the profile would lock the person out
 * of the settings screen where they could fix it.
 */
function toLocale(value: string, profileId: string): Locale {
  const parsed = localeSchema.safeParse(value)
  if (parsed.success) return parsed.data

  console.warn(`[api] profile ${profileId} has an unknown locale ${JSON.stringify(value)}; serving "en"`)
  return 'en'
}

/**
 * Every field in `preferencesSchema` carries a default, which is what makes the
 * jsonb column safe to widen: a row written before a toggle existed parses
 * cleanly and the new toggle simply reads as off. `{}` — the column default — is
 * therefore a complete, valid preferences object.
 *
 * A row that fails to parse outright is served as the defaults, for the same
 * reason as the locale above: an unreadable setting must not cost someone access
 * to the screen that would let them reset it.
 */
function toPreferences(value: unknown, profileId: string): ProfilePreferences {
  const parsed = preferencesSchema.safeParse(value ?? {})
  if (parsed.success) return parsed.data

  console.warn(`[api] profile ${profileId} has unreadable preferences; serving the defaults`)
  return preferencesSchema.parse({})
}

/* -------------------------------------------------------------------------- */
/* Paging                                                                     */
/* -------------------------------------------------------------------------- */

export function paginate<T>(
  items: T[],
  page: number,
  perPage: number,
  total: number,
): { items: T[]; page: number; perPage: number; total: number; hasMore: boolean } {
  return { items, page, perPage, total, hasMore: page * perPage < total }
}

export function offsetFor(page: number, perPage: number): number {
  return (page - 1) * perPage
}
