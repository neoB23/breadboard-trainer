import { and, count, desc, eq, inArray, isNotNull, or, sql, type SQL } from 'drizzle-orm'
import { Hono } from 'hono'

import { API_ERROR_CODES, uuidSchema } from '../../shared/contracts/index.ts'
// This whole route is instructor-only, which is why it reaches past the barrel.
import {
  captureReferenceRequestSchema,
  exerciseCreateRequestSchema,
  exercisePublishRequestSchema,
  exerciseUpdateRequestSchema,
  goldenNetlistV2Schema,
  type InstructorExerciseResponse,
  type TeachExercise,
  type TeachExerciseListResponse,
} from '../../shared/contracts/exercises-instructor.ts'
import type {
  CaptureReferenceResponse,
  ReferenceViewResponse,
  SubmissionsResponse,
  TeachExerciseResponse,
} from '../../shared/contracts/teach-authoring.ts'
import { parseBoardState } from '../../src/board/model.ts'
import { buildGoldenNetlist, validateReference } from '../../src/board/netlist.ts'
import { db } from '../db/client.ts'
import { attempts, classes, exerciseStudentColumns, exercises, profiles } from '../db/schema.ts'
import { isAdmin, sessionOf, type AppEnv } from '../middleware/context.ts'
import { ApiException } from '../middleware/error.ts'
import { loadOwnedClass, loadOwnedExercise } from '../middleware/ownership.ts'
import { parseJsonBody, parseParam } from '../middleware/validate.ts'
import { iso, toBom, toInstructorExercise, toStudentExercise } from './serializers.ts'

/**
 * /api/teach/exercises/* — authoring, publishing, Learn Mode capture and the
 * scores list.
 *
 * This is the only place in the API where `golden_netlist` is legitimately
 * read, and it happens behind `requireRole('instructor')` (applied in app.ts)
 * plus `loadOwnedExercise()` per handler.
 *
 * Exactly one endpoint returns the netlist itself: `GET /:id`, for the API and
 * its tests. Everything the teacher's screens call — the list, create, edit,
 * publish, capture — answers with the teacher view instead (`hasReference`,
 * never the netlist), and Learn Mode reads the instructor's board back under
 * `referenceBoard` from `GET /:id/reference`. That keeps the golden netlist's
 * shape out of every bundle, the instructor's included.
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

  return c.json<TeachExerciseListResponse>({ items: await teachExercises(mine) })
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
      // Not settable here. A reference arrives through Learn Mode and nowhere
      // else, because capture is what runs the validity checks.
      published: false,
    })
    .returning({ id: exercises.id })

  if (!created) throw new Error('exercise insert did not read back')

  return c.json<TeachExerciseResponse>({ exercise: await teachExercise(created.id) }, 201)
})

/* -------------------------------------------------------------------------- */
/* GET, PATCH /api/teach/exercises/:id                                        */
/* -------------------------------------------------------------------------- */

/** The one response that carries the netlist. No screen calls it. */
teachExercisesRoute.get('/:id', async (c) => {
  const session = sessionOf(c)
  const id = parseParam(c, 'id', uuidSchema)

  const row = await loadOwnedExercise(session, id)
  return c.json<InstructorExerciseResponse>({ exercise: toInstructorExercise(row) })
})

/**
 * A change to the bill of materials clears the captured reference. The
 * reference was built from the old tray; keeping it would grade students
 * against parts they were never given. The exercise unpublishes with it and
 * the capture revision moves on, so attempts graded before are marked stale.
 * The authoring screen warns before sending such a change.
 */
teachExercisesRoute.patch('/:id', async (c) => {
  const session = sessionOf(c)
  const id = parseParam(c, 'id', uuidSchema)
  const body = await parseJsonBody(c, exerciseUpdateRequestSchema)

  const existing = await loadOwnedExercise(session, id)

  if (body.classId !== undefined && body.classId !== null) {
    await loadOwnedClass(session, body.classId)
  }

  const bomChanged =
    body.bom !== undefined && JSON.stringify(body.bom) !== JSON.stringify(toBom(existing.bom, existing.id))
  const clearReference = bomChanged && existing.goldenNetlist !== null

  const [updated] = await db
    .update(exercises)
    .set({
      ...(body.title !== undefined && { title: body.title }),
      ...(body.objective !== undefined && { objective: body.objective }),
      ...(body.difficulty !== undefined && { difficulty: body.difficulty }),
      ...(body.classId !== undefined && { classId: body.classId }),
      ...(body.schematicUrl !== undefined && { schematicUrl: body.schematicUrl }),
      ...(body.bom !== undefined && { bom: body.bom }),
      ...(clearReference && {
        goldenNetlist: null,
        netlistVersion: existing.netlistVersion + 1,
        published: false,
      }),
    })
    .where(eq(exercises.id, id))
    .returning({ id: exercises.id })

  if (!updated) throw new Error(`exercise ${id} vanished mid-update`)

  return c.json<TeachExerciseResponse>({
    exercise: await teachExercise(id),
    referenceCleared: clearReference,
  })
})

/* -------------------------------------------------------------------------- */
/* POST /api/teach/exercises/:id/publish                                      */
/* -------------------------------------------------------------------------- */

/**
 * Publishing is its own endpoint rather than a field on PATCH so the one guard
 * it needs lives in one place: an exercise without a gradable reference cannot
 * be published. "Gradable" means the canonical form — the pre-comparator
 * placeholder some old rows carry is a reference in name only.
 */
teachExercisesRoute.post('/:id/publish', async (c) => {
  const session = sessionOf(c)
  const id = parseParam(c, 'id', uuidSchema)
  const body = await parseJsonBody(c, exercisePublishRequestSchema)

  const existing = await loadOwnedExercise(session, id)

  if (body.published && !goldenNetlistV2Schema.safeParse(existing.goldenNetlist).success) {
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
    .returning({ id: exercises.id })

  if (!updated) throw new Error(`exercise ${id} vanished mid-publish`)

  return c.json<TeachExerciseResponse>({ exercise: await teachExercise(id) })
})

/* -------------------------------------------------------------------------- */
/* POST /api/teach/exercises/:id/capture                                      */
/* -------------------------------------------------------------------------- */

/**
 * Learn Mode capture. The instructor sends the board they built; the server
 * reads it with the same parser the student's submission goes through,
 * refuses it if it would not earn full marks itself (a short, an unprotected
 * LED, a lead touching nothing, a tray part left over), and derives the
 * netlist from it. The netlist the comparator reads therefore always matches
 * the board Learn Mode shows.
 *
 * Re-capture bumps `netlist_version`, which marks every attempt graded against
 * the old reference as stale. It requires `confirmReplace` because of that,
 * and it unpublishes: whatever was published was judged against the old
 * reference, and quietly swapping it under a live class is how a lab section
 * spends an afternoon chasing phantom faults.
 */
teachExercisesRoute.post('/:id/capture', async (c) => {
  const session = sessionOf(c)
  const id = parseParam(c, 'id', uuidSchema)
  const body = await parseJsonBody(c, captureReferenceRequestSchema)

  const existing = await loadOwnedExercise(session, id)
  const bom = toBom(existing.bom, existing.id)
  const bomIds = new Set(bom.map((item) => item.id))

  // A part from a tray line that no longer exists cannot be in the answer key.
  const parts = parseBoardState(body.board, bom).filter((part) => bomIds.has(part.bomItemId))

  const issues = validateReference(parts, bom)
  if (issues.length > 0) {
    throw new ApiException(
      422,
      API_ERROR_CODES.validationFailed,
      'This circuit cannot be the reference yet. Fix what is listed and capture again.',
      Object.fromEntries(issues.map((issue) => [issue.reason, issue.labels])),
    )
  }

  const replacing = existing.goldenNetlist !== null

  if (replacing && !body.confirmReplace) {
    throw new ApiException(
      409,
      API_ERROR_CODES.conflict,
      'This exercise already has a reference circuit. Confirm the replacement to continue.',
    )
  }

  const [invalidated] = replacing
    ? await db
        .select({ value: count() })
        .from(attempts)
        .where(and(eq(attempts.exerciseId, id), isNotNull(attempts.gradedAt)))
    : []

  const [updated] = await db
    .update(exercises)
    .set({
      goldenNetlist: buildGoldenNetlist(parts),
      // First capture stays at version 1 — the column defaults to it, and a
      // freshly authored exercise has nothing graded to invalidate.
      ...(replacing && { netlistVersion: existing.netlistVersion + 1, published: false }),
    })
    .where(eq(exercises.id, id))
    .returning({ id: exercises.id })

  if (!updated) throw new Error(`exercise ${id} vanished mid-capture`)

  return c.json<CaptureReferenceResponse>({
    exercise: await teachExercise(id),
    capturedAt: iso(new Date()),
    invalidatedAttempts: invalidated?.value ?? 0,
  })
})

/* -------------------------------------------------------------------------- */
/* GET /api/teach/exercises/:id/reference                                     */
/* -------------------------------------------------------------------------- */

/** What Learn Mode puts back on the board. Null until a gradable reference exists. */
teachExercisesRoute.get('/:id/reference', async (c) => {
  const session = sessionOf(c)
  const id = parseParam(c, 'id', uuidSchema)

  const existing = await loadOwnedExercise(session, id)
  const parsed = goldenNetlistV2Schema.safeParse(existing.goldenNetlist)

  return c.json<ReferenceViewResponse>({
    exercise: await teachExercise(id),
    reference: parsed.success
      ? {
          referenceBoard: parsed.data.referenceBoard,
          components: parsed.data.components.length,
          nets: parsed.data.nets.length,
        }
      : null,
  })
})

/* -------------------------------------------------------------------------- */
/* GET /api/teach/exercises/:id/submissions                                   */
/* -------------------------------------------------------------------------- */

/**
 * The scores list: every student's handed-in attempt, newest first. An
 * instructor trying their own exercise out is not a submission, so only
 * student rows are listed.
 */
teachExercisesRoute.get('/:id/submissions', async (c) => {
  const session = sessionOf(c)
  const id = parseParam(c, 'id', uuidSchema)

  const existing = await loadOwnedExercise(session, id)

  const rows = await db
    .select({
      attemptId: attempts.id,
      studentId: attempts.studentId,
      fullName: profiles.fullName,
      studentNumber: profiles.studentNumber,
      submittedAt: attempts.submittedAt,
      score: attempts.score,
      completed: attempts.completed,
      durationMs: attempts.durationMs,
      netlistVersion: attempts.netlistVersion,
    })
    .from(attempts)
    .innerJoin(profiles, eq(profiles.id, attempts.studentId))
    .where(and(eq(attempts.exerciseId, id), isNotNull(attempts.submittedAt), eq(profiles.role, 'student')))
    .orderBy(desc(attempts.submittedAt))

  return c.json<SubmissionsResponse>({
    exercise: await teachExercise(id),
    items: rows.flatMap((row) =>
      row.submittedAt === null
        ? []
        : [
            {
              attemptId: row.attemptId,
              studentId: row.studentId,
              fullName: row.fullName,
              studentNumber: row.studentNumber,
              submittedAt: iso(row.submittedAt),
              score: row.score,
              completed: row.completed,
              durationMs: row.durationMs,
              stale: row.netlistVersion !== null && row.netlistVersion !== existing.netlistVersion,
            },
          ],
    ),
  })
})

/* -------------------------------------------------------------------------- */
/* The teacher's view                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The authoring screens need a "captured / not captured" badge, which is a
 * boolean — not the netlist itself. So this selects `exerciseStudentColumns`
 * plus a test on the stored format, and every reference circuit stays in
 * Postgres instead of being shipped down to render a list of titles.
 *
 * "Has a reference" means a *gradable* one, format 2. The pre-comparator
 * placeholder does not count, because nothing can be scored against it.
 */
async function teachExercises(where: SQL | undefined): Promise<TeachExercise[]> {
  const rows = await db
    .select({
      ...exerciseStudentColumns,
      hasReference: sql<boolean>`coalesce((${exercises.goldenNetlist} ->> 'version') = '2', false)`.mapWith(
        Boolean,
      ),
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
    hasReference: row.hasReference,
    attemptCount: byExercise.get(row.id) ?? 0,
  }))
}

async function teachExercise(id: string): Promise<TeachExercise> {
  const [row] = await teachExercises(eq(exercises.id, id))
  if (!row) throw new Error(`exercise ${id} vanished before it could be read back`)
  return row
}
