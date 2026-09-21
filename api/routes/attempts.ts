import { and, asc, count, desc, eq, inArray, isNull, or, type SQL } from 'drizzle-orm'
import { Hono } from 'hono'

import {
  API_ERROR_CODES,
  attemptListQuerySchema,
  attemptSaveRequestSchema,
  attemptStartRequestSchema,
  attemptSubmitRequestSchema,
  uuidSchema,
  type AttemptListResponse,
  type AttemptResponse,
  type AttemptResultResponse,
  type AttemptStartResponse,
  type FaultTimelineEntry,
} from '../../shared/contracts/index.ts'
import { db } from '../db/client.ts'
import { attempts, classes, events, exerciseStudentColumns, exercises, type Attempt } from '../db/schema.ts'
import { isAdmin, sessionOf, type AppEnv, type AppSession } from '../middleware/context.ts'
import { ApiException } from '../middleware/error.ts'
import {
  instructorTeachesExercise,
  loadOwnAttempt,
  loadReadableAttempt,
  loadStudentExercise,
} from '../middleware/ownership.ts'
import { parseJsonBody, parseParam, parseQuery } from '../middleware/validate.ts'
import { iso, offsetFor, paginate, toAttempt, toAttemptSummary, toStudentExercise } from './serializers.ts'

/**
 * Attempts — one student's run at one exercise, and the row every telemetry
 * event and every results page hangs off.
 *
 * Every handler here takes an id that belongs to somebody, so every handler
 * here goes through the ownership layer. Reads use `loadReadableAttempt` (the
 * student, or the instructor who teaches the exercise); writes use
 * `loadOwnAttempt`, which is the student alone.
 */
export const attemptsRoute = new Hono<AppEnv>()

/* -------------------------------------------------------------------------- */
/* POST /api/attempts                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Called when `/lab/:exerciseId` mounts, and idempotent by design: an
 * unsubmitted attempt at this exercise is returned with `resumed: true` rather
 * than a second one being started.
 *
 * Phase 7 requires leaving and returning to resume the same attempt, and
 * without this a refresh would fork one sitting into two rows — which would
 * quietly corrupt every duration and isolation-time figure in the results
 * chapter, since those are computed per attempt.
 */
attemptsRoute.post('/', async (c) => {
  const session = sessionOf(c)
  const body = await parseJsonBody(c, attemptStartRequestSchema)

  await assertMayAttempt(session, body.exerciseId)

  const [open] = await db
    .select()
    .from(attempts)
    .where(
      and(
        eq(attempts.studentId, session.userId),
        eq(attempts.exerciseId, body.exerciseId),
        isNull(attempts.submittedAt),
      ),
    )
    .orderBy(desc(attempts.startedAt))
    .limit(1)

  if (open) {
    return c.json<AttemptStartResponse>({ attempt: toAttempt(open), resumed: true })
  }

  const [created] = await db
    .insert(attempts)
    .values({ studentId: session.userId, exerciseId: body.exerciseId })
    .returning()

  if (!created) throw new Error(`attempt on exercise ${body.exerciseId} did not read back`)

  return c.json<AttemptStartResponse>({ attempt: toAttempt(created), resumed: false }, 201)
})

/**
 * A student may only attempt what they can see — published, and in a class they
 * are in. An instructor may attempt their own drafts, which is how Learn Mode
 * and the Phase 8 pre-test get exercised before anything is published.
 */
async function assertMayAttempt(session: AppSession, exerciseId: string): Promise<void> {
  if (session.role === 'student') {
    await loadStudentExercise(session, exerciseId)
    return
  }

  if (isAdmin(session)) return

  if (!(await instructorTeachesExercise(session.userId, exerciseId))) {
    throw new ApiException(403, API_ERROR_CODES.forbidden, 'You do not teach that exercise.')
  }
}

/* -------------------------------------------------------------------------- */
/* GET /api/attempts                                                          */
/* -------------------------------------------------------------------------- */

attemptsRoute.get('/', async (c) => {
  const session = sessionOf(c)
  const query = parseQuery(c, attemptListQuerySchema)

  const clauses: (SQL | undefined)[] = [await scopeFor(session, query.studentId)]
  if (query.exerciseId !== undefined) clauses.push(eq(attempts.exerciseId, query.exerciseId))
  if (query.completed !== undefined) clauses.push(eq(attempts.completed, query.completed))

  const where = and(...clauses)

  const [totals] = await db.select({ value: count() }).from(attempts).where(where)

  const rows = await db
    .select()
    .from(attempts)
    .where(where)
    .orderBy(desc(attempts.startedAt))
    .limit(query.perPage)
    .offset(offsetFor(query.page, query.perPage))

  return c.json<AttemptListResponse>(
    paginate(rows.map(toAttemptSummary), query.page, query.perPage, totals?.value ?? 0),
  )
})

/**
 * `studentId` is a query parameter, so it is a claim, not a fact. A student may
 * pass their own id or nothing at all; anything else is a 403 rather than a
 * silently narrowed result, because a filter that quietly ignores what you
 * asked for is worse than one that refuses.
 *
 * An instructor is scoped to attempts on exercises they teach — the parameter
 * narrows within that, it does not widen past it.
 */
async function scopeFor(session: AppSession, studentId: string | undefined): Promise<SQL | undefined> {
  if (session.role === 'student') {
    if (studentId !== undefined && studentId !== session.userId) {
      throw new ApiException(403, API_ERROR_CODES.forbidden, 'You can only list your own attempts.')
    }
    return eq(attempts.studentId, session.userId)
  }

  if (isAdmin(session)) {
    return studentId === undefined ? undefined : eq(attempts.studentId, studentId)
  }

  const taught = inArray(attempts.exerciseId, exercisesTaughtBy(session.userId))
  return studentId === undefined ? taught : and(taught, eq(attempts.studentId, studentId))
}

/** Exercises this instructor authored, or that sit in a class they teach. */
function exercisesTaughtBy(userId: string) {
  return db
    .select({ id: exercises.id })
    .from(exercises)
    .leftJoin(classes, eq(classes.id, exercises.classId))
    .where(or(eq(exercises.authorId, userId), eq(classes.instructorId, userId)))
}

/* -------------------------------------------------------------------------- */
/* GET /api/attempts/:id                                                      */
/* -------------------------------------------------------------------------- */

attemptsRoute.get('/:id', async (c) => {
  const session = sessionOf(c)
  const id = parseParam(c, 'id', uuidSchema)

  const row = await loadReadableAttempt(session, id)
  return c.json<AttemptResponse>({ attempt: toAttempt(row) })
})

/* -------------------------------------------------------------------------- */
/* PATCH /api/attempts/:id                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Autosave. The counters are accepted from the client because the diagnostic
 * engine runs in the browser by design (non-negotiable 4) and the API has no
 * way to derive them — which is exactly why the Phase 20 accuracy figures come
 * from the seeded corpus and the `events` table, never from these fields.
 */
attemptsRoute.patch('/:id', async (c) => {
  const session = sessionOf(c)
  const id = parseParam(c, 'id', uuidSchema)
  const body = await parseJsonBody(c, attemptSaveRequestSchema)

  const existing = await loadOwnAttempt(session, id)
  assertOpen(existing)

  const [updated] = await db
    .update(attempts)
    .set({
      ...(body.finalState !== undefined && { finalState: body.finalState }),
      ...(body.hintsUsed !== undefined && { hintsUsed: body.hintsUsed }),
      ...(body.faultsEncountered !== undefined && { faultsEncountered: body.faultsEncountered }),
      ...(body.faultsSelfResolved !== undefined && { faultsSelfResolved: body.faultsSelfResolved }),
    })
    .where(eq(attempts.id, id))
    .returning()

  if (!updated) throw new Error(`attempt ${id} vanished mid-update`)

  return c.json<AttemptResponse>({ attempt: toAttempt(updated) })
})

/* -------------------------------------------------------------------------- */
/* POST /api/attempts/:id/submit                                              */
/* -------------------------------------------------------------------------- */

/**
 * Terminal. `submitted_at` is stamped server-side while `durationMs` comes from
 * the client, so the elapsed time the student actually watched is recorded and
 * the two can still be reconciled when a lab machine's clock is wrong.
 */
attemptsRoute.post('/:id/submit', async (c) => {
  const session = sessionOf(c)
  const id = parseParam(c, 'id', uuidSchema)
  const body = await parseJsonBody(c, attemptSubmitRequestSchema)

  const existing = await loadOwnAttempt(session, id)
  assertOpen(existing)

  const [submitted] = await db
    .update(attempts)
    .set({
      finalState: body.finalState,
      durationMs: body.durationMs,
      hintsUsed: body.hintsUsed,
      faultsEncountered: body.faultsEncountered,
      faultsSelfResolved: body.faultsSelfResolved,
      completed: body.completed,
      submittedAt: new Date(),
    })
    .where(eq(attempts.id, id))
    .returning()

  if (!submitted) throw new Error(`attempt ${id} vanished mid-submit`)

  return c.json<AttemptResponse>({ attempt: toAttempt(submitted) })
})

/**
 * A submitted attempt is immutable. A second submit is a conflict rather than a
 * silent overwrite: the first one is the evidence, and a double-click on a slow
 * connection must not be able to replace it.
 */
function assertOpen(attempt: Attempt): void {
  if (attempt.submittedAt !== null) {
    throw new ApiException(409, API_ERROR_CODES.conflict, 'This attempt has already been submitted.')
  }
}

/* -------------------------------------------------------------------------- */
/* GET /api/attempts/:id/result                                               */
/* -------------------------------------------------------------------------- */

/**
 * `/results/:attemptId`.
 *
 * The embedded exercise is the **student** projection even when an instructor
 * is reading, and that is not an oversight. This is the least obvious place a
 * golden netlist could ride along — three levels down, inside an embedded
 * exercise, on a page nobody thinks of as exercise-facing — and an instructor
 * who wants the reference circuit has /api/teach/exercises/:id for it.
 */
attemptsRoute.get('/:id/result', async (c) => {
  const session = sessionOf(c)
  const id = parseParam(c, 'id', uuidSchema)

  const attempt = await loadReadableAttempt(session, id)

  const [exercise] = await db
    .select(exerciseStudentColumns)
    .from(exercises)
    .where(eq(exercises.id, attempt.exerciseId))
    .limit(1)

  if (!exercise) throw new Error(`attempt ${id} points at a missing exercise ${attempt.exerciseId}`)

  return c.json<AttemptResultResponse>({
    attempt: toAttempt(attempt),
    exercise: toStudentExercise(exercise),
    faultTimeline: await faultTimeline(id),
  })
})

/**
 * Fault isolation time — the headline number of the results chapter — is a
 * delta between `events.ts` values within one attempt, so it is derived here
 * rather than stored. Phase 17 owns the event payload shape and will tighten
 * both this reader and the pairing; until then the timeline degrades to an
 * empty array on an attempt with no telemetry, which is what the stubbed
 * sections in Phase 5 expect.
 */
async function faultTimeline(attemptId: string): Promise<FaultTimelineEntry[]> {
  const rows = await db
    .select({ id: events.id, ts: events.ts, type: events.type, payload: events.payload })
    .from(events)
    .where(eq(events.attemptId, attemptId))
    // `id` breaks ties: a batched offline flush can land several events on the
    // same millisecond, and their order is the order they were queued in.
    .orderBy(asc(events.ts), asc(events.id))

  const timeline: FaultTimelineEntry[] = []

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    if (row === undefined) continue
    if (row.type !== 'fault' && row.type !== 'hint' && row.type !== 'resolve' && row.type !== 'submit') {
      continue
    }

    const { faultClass, rowLabels } = readFaultPayload(row.payload)

    timeline.push({
      ts: iso(row.ts),
      type: row.type,
      faultClass,
      rowLabels,
      isolationMs: row.type === 'fault' ? isolationMs(rows.slice(i + 1), row.ts, faultClass) : null,
    })
  }

  return timeline
}

/** Time from a fault firing to the resolve event for the same fault class. Null while unresolved. */
function isolationMs(
  later: readonly { ts: Date; type: string; payload: unknown }[],
  firedAt: Date,
  faultClass: string | null,
): number | null {
  for (const row of later) {
    if (row.type !== 'resolve') continue
    if (readFaultPayload(row.payload).faultClass !== faultClass) continue
    return row.ts.getTime() - firedAt.getTime()
  }
  return null
}

/** Payloads are jsonb and written by the client, so nothing in them is guaranteed. */
function readFaultPayload(payload: unknown): { faultClass: string | null; rowLabels: string[] } {
  if (typeof payload !== 'object' || payload === null) return { faultClass: null, rowLabels: [] }

  const candidate = payload as { faultClass?: unknown; rowLabels?: unknown }

  return {
    faultClass: typeof candidate.faultClass === 'string' ? candidate.faultClass : null,
    rowLabels: Array.isArray(candidate.rowLabels)
      ? candidate.rowLabels.filter((label): label is string => typeof label === 'string')
      : [],
  }
}
