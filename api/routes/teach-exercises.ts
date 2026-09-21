import { count, desc, eq, inArray, or, sql, type SQL } from 'drizzle-orm'
import { Hono } from 'hono'

import { API_ERROR_CODES, uuidSchema } from '../../shared/contracts/index.ts'
// This whole route is instructor-only, which is why it reaches past the barrel.
import {
  captureNetlistRequestSchema,
  exerciseCreateRequestSchema,
  exercisePublishRequestSchema,
  exerciseUpdateRequestSchema,
  type CaptureNetlistResponse,
  type InstructorExerciseListResponse,
  type InstructorExerciseResponse,
  type InstructorExerciseSummary,
} from '../../shared/contracts/exercises-instructor.ts'
import { db } from '../db/client.ts'
import { attempts, classes, exerciseStudentColumns, exercises } from '../db/schema.ts'
import { isAdmin, sessionOf, type AppEnv } from '../middleware/context.ts'
import { ApiException } from '../middleware/error.ts'
import { loadOwnedClass, loadOwnedExercise } from '../middleware/ownership.ts'
import { parseJsonBody, parseParam } from '../middleware/validate.ts'
import { iso, toInstructorExercise, toStudentExercise } from './serializers.ts'

/**
 * /api/teach/exercises/* — authoring, publishing, and Learn Mode capture.
 *
 * This is the only place in the API where `golden_netlist` is legitimately
 * read, and it happens behind `requireRole('instructor')` (applied in app.ts)
 * plus `loadOwnedExercise()` per handler. Note which of the two reads below
 * uses the instructor projection: the **detail** endpoint does, the **list**
 * does not — see `summaries()`.
 */
export const teachExercisesRoute = new Hono<AppEnv>()

/* -------------------------------------------------------------------------- */
/* GET, POST /api/teach/exercises                                             */
/* -------------------------------------------------------------------------- */

teachExercisesRoute.get('/', async (c) => {
  const session = sessionOf(c)

  const mine = isAdmin(session)
    ? undefined
    : or(
        eq(exercises.authorId, session.userId),
        inArray(
          exercises.classId,
          db.select({ id: classes.id }).from(classes).where(eq(classes.instructorId, session.userId)),
        ),
      )

  return c.json<InstructorExerciseListResponse>({ items: await summaries(mine) })
})

teachExercisesRoute.post('/', async (c) => {
  const session = sessionOf(c)
  const body = await parseJsonBody(c, exerciseCreateRequestSchema)

  // Assigning to a class you do not teach would put your exercise on someone
  // else's dashboard, so the class id is checked, not trusted.
  if (body.classId !== undefined && body.classId !== null) {
    await loadOwnedClass(session, body.classId)
  }

  const [created] = await db
    .insert(exercises)
    .values({
      authorId: session.userId,
      classId: body.classId ?? null,
      title: body.title,
      objective: body.objective ?? null,
      difficulty: body.difficulty,
      schematicUrl: body.schematicUrl ?? null,
      bom: body.bom,
      // Not settable here. A netlist arrives through Learn Mode and nowhere
      // else, because capture is what runs the Phase 12 validity checks.
      published: false,
    })
    .returning()

  if (!created) throw new Error('exercise insert did not read back')

  return c.json<InstructorExerciseResponse>({ exercise: toInstructorExercise(created) }, 201)
})

/* -------------------------------------------------------------------------- */
/* GET, PATCH /api/teach/exercises/:id                                        */
/* -------------------------------------------------------------------------- */

teachExercisesRoute.get('/:id', async (c) => {
  const session = sessionOf(c)
  const id = parseParam(c, 'id', uuidSchema)

  const row = await loadOwnedExercise(session, id)
  return c.json<InstructorExerciseResponse>({ exercise: toInstructorExercise(row) })
})

teachExercisesRoute.patch('/:id', async (c) => {
  const session = sessionOf(c)
  const id = parseParam(c, 'id', uuidSchema)
  const body = await parseJsonBody(c, exerciseUpdateRequestSchema)

  await loadOwnedExercise(session, id)

  if (body.classId !== undefined && body.classId !== null) {
    await loadOwnedClass(session, body.classId)
  }

  const [updated] = await db
    .update(exercises)
    .set({
      ...(body.title !== undefined && { title: body.title }),
      ...(body.objective !== undefined && { objective: body.objective }),
      ...(body.difficulty !== undefined && { difficulty: body.difficulty }),
      ...(body.classId !== undefined && { classId: body.classId }),
      ...(body.schematicUrl !== undefined && { schematicUrl: body.schematicUrl }),
      ...(body.bom !== undefined && { bom: body.bom }),
    })
    .where(eq(exercises.id, id))
    .returning()

  if (!updated) throw new Error(`exercise ${id} vanished mid-update`)

  return c.json<InstructorExerciseResponse>({ exercise: toInstructorExercise(updated) })
})

/* -------------------------------------------------------------------------- */
/* POST /api/teach/exercises/:id/publish                                      */
/* -------------------------------------------------------------------------- */

/**
 * Publishing is its own endpoint rather than a field on PATCH so the one guard
 * it needs lives in one place: an exercise with no captured netlist cannot be
 * published.
 *
 * Without that check a student could start a Part B exercise the comparator has
 * no reference for, which does not fail loudly — it silently reports every
 * correct circuit as "substantially different".
 */
teachExercisesRoute.post('/:id/publish', async (c) => {
  const session = sessionOf(c)
  const id = parseParam(c, 'id', uuidSchema)
  const body = await parseJsonBody(c, exercisePublishRequestSchema)

  const existing = await loadOwnedExercise(session, id)

  if (body.published && existing.goldenNetlist === null) {
    throw new ApiException(
      409,
      API_ERROR_CODES.exerciseNotPublished,
      'Capture the reference circuit in Learn Mode before publishing this exercise.',
    )
  }

  const [updated] = await db
    .update(exercises)
    .set({ published: body.published })
    .where(eq(exercises.id, id))
    .returning()

  if (!updated) throw new Error(`exercise ${id} vanished mid-publish`)

  return c.json<InstructorExerciseResponse>({ exercise: toInstructorExercise(updated) })
})

/* -------------------------------------------------------------------------- */
/* POST /api/teach/exercises/:id/capture                                      */
/* -------------------------------------------------------------------------- */

/**
 * Learn Mode capture. Phase 12 wires the button and adds the circuit-validity
 * checks that run before this is called (no floating leads, no shorts, every
 * BOM part used); the persistence half is here now so the shape is settled
 * before the workspace starts producing netlists.
 *
 * Re-capture bumps `netlist_version`, which is what lets an in-flight attempt
 * detect that the reference it was being judged against has moved. It requires
 * `confirmReplace` because it invalidates every attempt already made.
 */
teachExercisesRoute.post('/:id/capture', async (c) => {
  const session = sessionOf(c)
  const id = parseParam(c, 'id', uuidSchema)
  const body = await parseJsonBody(c, captureNetlistRequestSchema)

  const existing = await loadOwnedExercise(session, id)
  const replacing = existing.goldenNetlist !== null

  if (replacing && !body.confirmReplace) {
    throw new ApiException(
      409,
      API_ERROR_CODES.conflict,
      'This exercise already has a captured netlist. Confirm the replacement to continue.',
    )
  }

  const [invalidated] = replacing
    ? await db.select({ value: count() }).from(attempts).where(eq(attempts.exerciseId, id))
    : []

  const [updated] = await db
    .update(exercises)
    .set({
      goldenNetlist: body.netlist,
      // First capture stays at version 1 — the column defaults to it, and a
      // freshly authored exercise has no attempts to invalidate.
      ...(replacing && { netlistVersion: existing.netlistVersion + 1 }),
      // A replaced netlist unpublishes. Whatever was published was judged
      // against the old reference, and quietly swapping it under a live class
      // is how a lab section spends an afternoon chasing phantom faults.
      ...(replacing && { published: false }),
    })
    .where(eq(exercises.id, id))
    .returning({ netlistVersion: exercises.netlistVersion })

  if (!updated) throw new Error(`exercise ${id} vanished mid-capture`)

  return c.json<CaptureNetlistResponse>({
    netlistVersion: updated.netlistVersion,
    capturedAt: iso(new Date()),
    invalidatedAttempts: invalidated?.value ?? 0,
  })
})

/* -------------------------------------------------------------------------- */
/* List projection                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The authoring list needs a "captured / not captured" badge, which is a
 * boolean — not the netlist itself. So this selects `exerciseStudentColumns`
 * plus an `is not null` test, and every reference circuit in the class stays in
 * Postgres instead of being shipped down to render a list of titles.
 *
 * That is the same instinct as the golden netlist rule one level up: fetch the
 * answer to the question you are asking, not the row that contains it.
 */
async function summaries(where: SQL | undefined): Promise<InstructorExerciseSummary[]> {
  const rows = await db
    .select({
      ...exerciseStudentColumns,
      hasGoldenNetlist: sql<boolean>`${exercises.goldenNetlist} is not null`.mapWith(Boolean),
    })
    .from(exercises)
    .where(where)
    .orderBy(desc(exercises.createdAt))

  if (rows.length === 0) return []

  const counted = await db
    .select({ exerciseId: attempts.exerciseId, total: count() })
    .from(attempts)
    .where(
      inArray(
        attempts.exerciseId,
        rows.map((row) => row.id),
      ),
    )
    .groupBy(attempts.exerciseId)

  const byExercise = new Map(counted.map((row) => [row.exerciseId, row.total]))

  return rows.map((row) => ({
    ...toStudentExercise(row),
    hasGoldenNetlist: row.hasGoldenNetlist,
    attemptCount: byExercise.get(row.id) ?? 0,
  }))
}
