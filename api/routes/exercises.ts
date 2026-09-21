import { and, asc, count, desc, eq, ilike, inArray, isNull, or, type SQL } from 'drizzle-orm'
import { Hono } from 'hono'

import {
  exerciseListQuerySchema,
  uuidSchema,
  type AssignedExercise,
  type ExerciseDetailResponse,
  type ExerciseListResponse,
  type ExerciseProgress,
  type ExerciseStatus,
} from '../../shared/contracts/index.ts'
import { db } from '../db/client.ts'
import { attempts, exerciseStudentColumns, exercises } from '../db/schema.ts'
import { isAdmin, sessionOf, type AppEnv, type AppSession } from '../middleware/context.ts'
import { enrolledClassIds, loadStudentExercise } from '../middleware/ownership.ts'
import { parseParam, parseQuery } from '../middleware/validate.ts'
import { iso, offsetFor, paginate, toStudentExercise } from './serializers.ts'

/**
 * The student half of exercises: the dashboard list, the library, and the
 * detail modal behind Start / Resume.
 *
 * Every read in this file goes through `exerciseStudentColumns`, directly or
 * via `loadStudentExercise()`. There is no `select()` without an argument
 * anywhere in it, and there must never be one — see the golden netlist rule in
 * `api/db/schema.ts`.
 */
export const exercisesRoute = new Hono<AppEnv>()

/* -------------------------------------------------------------------------- */
/* GET /api/exercises                                                         */
/* -------------------------------------------------------------------------- */

exercisesRoute.get('/', async (c) => {
  const session = sessionOf(c)
  const query = parseQuery(c, exerciseListQuerySchema)

  const where = and(visibleTo(session), matchesFilters(query.q, query.difficulty, query.classId))

  /**
   * Three queries rather than one clever one.
   *
   * Status is derived from this student's attempts, not stored, so filtering
   * and paginating on it in SQL means a correlated aggregate in the WHERE
   * clause and a second copy of it in the COUNT. Instead: get the visible ids
   * in order, fold this student's attempts over them in memory, then fetch the
   * page. The ids are one small column and an exercise library is tens of rows,
   * not millions — if that ever stops being true, the fix is a materialised
   * progress table, not a smarter query.
   */
  const ordered = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(where)
    .orderBy(asc(exercises.difficulty), asc(exercises.title))

  const progress = await progressFor(
    session.userId,
    ordered.map((row) => row.id),
  )

  const matching =
    query.status === undefined
      ? ordered
      : ordered.filter((row) => progressOf(progress, row.id).status === query.status)

  const pageIds = matching
    .slice(offsetFor(query.page, query.perPage), offsetFor(query.page, query.perPage) + query.perPage)
    .map((row) => row.id)

  const items = await hydrate(pageIds, progress)

  return c.json<ExerciseListResponse>(paginate(items, query.page, query.perPage, matching.length))
})

/* -------------------------------------------------------------------------- */
/* GET /api/exercises/:id                                                     */
/* -------------------------------------------------------------------------- */

exercisesRoute.get('/:id', async (c) => {
  const session = sessionOf(c)
  const id = parseParam(c, 'id', uuidSchema)

  // Ownership layer: 404 if unpublished, 403 if it belongs to another class.
  const row = await loadStudentExercise(session, id)
  const progress = await progressFor(session.userId, [row.id])

  return c.json<ExerciseDetailResponse>({
    exercise: { ...toStudentExercise(row), progress: progressOf(progress, row.id) },
  })
})

/* -------------------------------------------------------------------------- */
/* Visibility                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * What a student may see, expressed once. `published` is not a query parameter
 * and never will be — a filter the client can set is a filter the client can
 * unset, and Phase 6 requires unpublished exercises be invisible at the API
 * level rather than merely hidden by the UI.
 *
 * `classId is null` is the shared library. Anything else is visible only inside
 * the class it was assigned to.
 */
function visibleTo(session: AppSession): SQL | undefined {
  if (isAdmin(session)) return undefined

  return and(
    eq(exercises.published, true),
    or(isNull(exercises.classId), inArray(exercises.classId, enrolledClassIds(session.userId))),
  )
}

function matchesFilters(q: string | undefined, difficulty: number | undefined, classId: string | undefined) {
  const clauses: (SQL | undefined)[] = []

  if (q !== undefined && q.length > 0) {
    const pattern = `%${escapeLike(q)}%`
    clauses.push(or(ilike(exercises.title, pattern), ilike(exercises.objective, pattern)))
  }
  if (difficulty !== undefined) clauses.push(eq(exercises.difficulty, difficulty))
  if (classId !== undefined) clauses.push(eq(exercises.classId, classId))

  return and(...clauses)
}

/** `%` and `_` are wildcards in LIKE; a student searching for "10_k" means the literal. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

/* -------------------------------------------------------------------------- */
/* Progress                                                                   */
/* -------------------------------------------------------------------------- */

const NO_PROGRESS: ExerciseProgress = {
  status: 'not_started',
  attemptCount: 0,
  lastAttemptAt: null,
  openAttemptId: null,
}

function progressOf(map: ReadonlyMap<string, ExerciseProgress>, exerciseId: string): ExerciseProgress {
  return map.get(exerciseId) ?? NO_PROGRESS
}

/**
 * One student's attempts across a set of exercises, folded into the shape
 * `<ExerciseCard>` renders. Rows come back newest first so the first attempt
 * seen for an exercise is the latest one.
 *
 * A student has tens of attempts, not thousands, so this is deliberately a
 * plain query and a fold rather than `count(*) filter (...)` and
 * `array_agg(...)` in a subquery — the SQL version is fragile across the two
 * drivers this API runs on and buys nothing at this scale.
 */
export async function progressFor(
  studentId: string,
  exerciseIds: readonly string[],
): Promise<Map<string, ExerciseProgress>> {
  const map = new Map<string, ExerciseProgress>()
  if (exerciseIds.length === 0) return map

  const rows = await db
    .select({
      id: attempts.id,
      exerciseId: attempts.exerciseId,
      startedAt: attempts.startedAt,
      submittedAt: attempts.submittedAt,
      completed: attempts.completed,
    })
    .from(attempts)
    .where(and(eq(attempts.studentId, studentId), inArray(attempts.exerciseId, [...exerciseIds])))
    .orderBy(desc(attempts.startedAt))

  const completed = new Set<string>()

  for (const row of rows) {
    const current = map.get(row.exerciseId) ?? NO_PROGRESS
    if (row.completed) completed.add(row.exerciseId)

    map.set(row.exerciseId, {
      status: 'in_progress',
      attemptCount: current.attemptCount + 1,
      // Rows are newest first, so the first one wins.
      lastAttemptAt: current.lastAttemptAt ?? iso(row.startedAt),
      // The attempt Resume reopens: the most recent one never submitted.
      openAttemptId: current.openAttemptId ?? (row.submittedAt === null ? row.id : null),
    })
  }

  for (const [exerciseId, value] of map) {
    const status: ExerciseStatus = completed.has(exerciseId) ? 'completed' : 'in_progress'
    map.set(exerciseId, { ...value, status })
  }

  return map
}

/* -------------------------------------------------------------------------- */
/* Hydration                                                                  */
/* -------------------------------------------------------------------------- */

/** Fetches the page and restores the order `inArray` does not preserve. */
async function hydrate(
  ids: readonly string[],
  progress: ReadonlyMap<string, ExerciseProgress>,
): Promise<AssignedExercise[]> {
  if (ids.length === 0) return []

  const rows = await db
    .select(exerciseStudentColumns)
    .from(exercises)
    .where(inArray(exercises.id, [...ids]))
  const byId = new Map(rows.map((row) => [row.id, row]))

  return ids.flatMap((id) => {
    const row = byId.get(id)
    if (row === undefined) return []
    return [{ ...toStudentExercise(row), progress: progressOf(progress, id) }]
  })
}

/** Exported for the instructor list, which counts attempts per exercise the same way. */
export async function attemptCounts(exerciseIds: readonly string[]): Promise<Map<string, number>> {
  if (exerciseIds.length === 0) return new Map()

  const rows = await db
    .select({ exerciseId: attempts.exerciseId, total: count() })
    .from(attempts)
    .where(inArray(attempts.exerciseId, [...exerciseIds]))
    .groupBy(attempts.exerciseId)

  return new Map(rows.map((row) => [row.exerciseId, row.total]))
}
