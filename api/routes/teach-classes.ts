import { and, eq, inArray, max, sql } from 'drizzle-orm'
import { Hono } from 'hono'

import {
  API_ERROR_CODES,
  classCreateRequestSchema,
  classUpdateRequestSchema,
  userIdSchema,
  uuidSchema,
  type ClassListResponse,
  type ClassResponse,
  type RegenerateJoinCodeResponse,
  type RemoveStudentResponse,
  type RosterEntry,
  type RosterResponse,
} from '../../shared/contracts/index.ts'
import { db } from '../db/client.ts'
import { attempts, classes, enrollments, exercises, profiles } from '../db/schema.ts'
import { isAdmin, sessionOf, type AppEnv } from '../middleware/context.ts'
import { ApiException } from '../middleware/error.ts'
import { loadOwnedClass } from '../middleware/ownership.ts'
import { parseJsonBody, parseParam } from '../middleware/validate.ts'
import { classSummaries, classSummary, withUniqueJoinCode } from './class-queries.ts'
import { isoOrNull, toPublicProfile } from './serializers.ts'

/**
 * /api/teach/classes/* — instructor-owned classes and their rosters.
 *
 * `requireRole('instructor')` is applied once in `api/app.ts` for this whole
 * subtree, which is what stops a student reading any golden netlist. It does
 * nothing about one instructor reading another's roster, so every handler here
 * that takes an id still goes through `loadOwnedClass()`.
 */
export const teachClassesRoute = new Hono<AppEnv>()

/* -------------------------------------------------------------------------- */
/* GET, POST /api/teach/classes                                               */
/* -------------------------------------------------------------------------- */

teachClassesRoute.get('/', async (c) => {
  const session = sessionOf(c)

  const items = await classSummaries(
    isAdmin(session) ? undefined : eq(classes.instructorId, session.userId),
    // Drafts included: an instructor's class card and their own exercise list
    // must not disagree about how many exercises exist.
    { publishedExercisesOnly: false },
  )

  return c.json<ClassListResponse>({ items })
})

teachClassesRoute.post('/', async (c) => {
  const session = sessionOf(c)
  const body = await parseJsonBody(c, classCreateRequestSchema)

  const created = await withUniqueJoinCode(async (code) => {
    const [row] = await db
      .insert(classes)
      .values({
        instructorId: session.userId,
        name: body.name,
        term: body.term ?? null,
        code,
      })
      .returning({ id: classes.id })
    return row
  })

  if (!created) throw new Error('class insert did not read back')

  const summary = await classSummary(created.id, { publishedExercisesOnly: false })
  if (summary === undefined) throw new Error(`class ${created.id} did not read back`)

  return c.json<ClassResponse>({ class: summary }, 201)
})

/* -------------------------------------------------------------------------- */
/* GET, PATCH /api/teach/classes/:id                                          */
/* -------------------------------------------------------------------------- */

/**
 * The roster screen. `publicProfileSchema` per row, not the full profile — an
 * instructor has a legitimate need for a student's name, number and section,
 * and none at all for their locale or accessibility settings.
 */
teachClassesRoute.get('/:id', async (c) => {
  const session = sessionOf(c)
  const id = parseParam(c, 'id', uuidSchema)

  await loadOwnedClass(session, id)

  const summary = await classSummary(id, { publishedExercisesOnly: false })
  if (summary === undefined)
    throw new ApiException(404, API_ERROR_CODES.notFound, 'That class does not exist.')

  return c.json<RosterResponse>({ class: summary, items: await roster(id) })
})

teachClassesRoute.patch('/:id', async (c) => {
  const session = sessionOf(c)
  const id = parseParam(c, 'id', uuidSchema)
  const body = await parseJsonBody(c, classUpdateRequestSchema)

  await loadOwnedClass(session, id)

  await db
    .update(classes)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.term !== undefined && { term: body.term }),
      ...(body.archived !== undefined && { archived: body.archived }),
    })
    .where(eq(classes.id, id))

  const summary = await classSummary(id, { publishedExercisesOnly: false })
  if (summary === undefined) throw new Error(`class ${id} vanished mid-update`)

  return c.json<ClassResponse>({ class: summary })
})

/* -------------------------------------------------------------------------- */
/* POST /api/teach/classes/:id/code                                           */
/* -------------------------------------------------------------------------- */

/**
 * Rotation, not revocation of membership. Existing enrollments survive; what is
 * revoked is the ability of anyone still holding the old code to join. This is
 * the answer to a code that ended up on a group chat, and it is why the code is
 * treated as a join token rather than a secret.
 */
teachClassesRoute.post('/:id/code', async (c) => {
  const session = sessionOf(c)
  const id = parseParam(c, 'id', uuidSchema)

  await loadOwnedClass(session, id)

  const rotated = await withUniqueJoinCode(async (code) => {
    const [row] = await db
      .update(classes)
      .set({ code })
      .where(eq(classes.id, id))
      .returning({ code: classes.code })
    return row
  })

  if (!rotated) throw new Error(`class ${id} vanished mid-rotation`)

  return c.json<RegenerateJoinCodeResponse>({ code: rotated.code })
})

/* -------------------------------------------------------------------------- */
/* DELETE /api/teach/classes/:id/students/:studentId                          */
/* -------------------------------------------------------------------------- */

/**
 * Removes the enrollment, and only the enrollment. Attempts reference
 * `profiles` and `exercises` rather than `enrollments`, so a student removed
 * from the wrong section keeps their work and the class analytics keep their
 * history.
 */
teachClassesRoute.delete('/:id/students/:studentId', async (c) => {
  const session = sessionOf(c)
  const id = parseParam(c, 'id', uuidSchema)
  const studentId = parseParam(c, 'studentId', userIdSchema)

  await loadOwnedClass(session, id)

  const removed = await db
    .delete(enrollments)
    .where(and(eq(enrollments.classId, id), eq(enrollments.studentId, studentId)))
    .returning({ studentId: enrollments.studentId })

  if (removed.length === 0) {
    throw new ApiException(404, API_ERROR_CODES.notFound, 'That student is not in this class.')
  }

  return c.json<RemoveStudentResponse>({ ok: true })
})

/* -------------------------------------------------------------------------- */
/* Roster                                                                     */
/* -------------------------------------------------------------------------- */

async function roster(classId: string): Promise<RosterEntry[]> {
  const members = await db
    .select({
      id: profiles.id,
      fullName: profiles.fullName,
      role: profiles.role,
      studentNumber: profiles.studentNumber,
      section: profiles.section,
      joinedAt: enrollments.joinedAt,
    })
    .from(enrollments)
    .innerJoin(profiles, eq(profiles.id, enrollments.studentId))
    .where(eq(enrollments.classId, classId))
    .orderBy(profiles.fullName)

  if (members.length === 0) return []

  /**
   * Activity is counted against this class's exercises only. A student in two
   * sections would otherwise appear equally busy on both rosters, which is
   * precisely backwards for the Phase 18 "flagged as struggling" list.
   */
  const activity = await db
    .select({
      studentId: attempts.studentId,
      attemptCount: sql<number>`count(*)::int`.mapWith(Number),
      lastActiveAt: max(attempts.startedAt),
    })
    .from(attempts)
    .innerJoin(exercises, eq(exercises.id, attempts.exerciseId))
    .where(
      and(
        eq(exercises.classId, classId),
        inArray(
          attempts.studentId,
          members.map((member) => member.id),
        ),
      ),
    )
    .groupBy(attempts.studentId)

  const byStudent = new Map(activity.map((row) => [row.studentId, row]))

  return members.map((member) => {
    const seen = byStudent.get(member.id)
    return {
      student: toPublicProfile(member),
      joinedAt: member.joinedAt.toISOString(),
      attemptCount: seen?.attemptCount ?? 0,
      lastActiveAt: isoOrNull(seen?.lastActiveAt ?? null),
    }
  })
}
