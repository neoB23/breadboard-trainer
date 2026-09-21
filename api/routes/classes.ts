import { and, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'

import {
  API_ERROR_CODES,
  joinClassRequestSchema,
  uuidSchema,
  type ClassListResponse,
  type ClassResponse,
  type JoinClassResponse,
  type LeaveClassResponse,
} from '../../shared/contracts/index.ts'
import { db } from '../db/client.ts'
import { classes, enrollments } from '../db/schema.ts'
import { isAdmin, sessionOf, type AppEnv } from '../middleware/context.ts'
import { ApiException } from '../middleware/error.ts'
import { enrolledClassIds, loadVisibleClass } from '../middleware/ownership.ts'
import { parseJsonBody, parseParam } from '../middleware/validate.ts'
import { classSummaries, classSummary } from './class-queries.ts'
import { iso } from './serializers.ts'

/**
 * Classes as a student sees them: the ones they are in, and joining one by
 * code. Creating, renaming and rostering live under /api/teach/classes, behind
 * `requireRole('instructor')`.
 */
export const classesRoute = new Hono<AppEnv>()

/* -------------------------------------------------------------------------- */
/* GET /api/classes                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The same URL answers for both roles, scoped by session rather than by a
 * parameter: a student gets the classes they are enrolled in, an instructor the
 * ones they teach. A `?studentId=` here would be a filter the caller could
 * change, which is not a thing this API offers.
 */
classesRoute.get('/', async (c) => {
  const session = sessionOf(c)

  const where =
    session.role === 'student'
      ? inArray(classes.id, enrolledClassIds(session.userId))
      : isAdmin(session)
        ? undefined
        : eq(classes.instructorId, session.userId)

  const items = await classSummaries(where, {
    publishedExercisesOnly: session.role === 'student',
  })

  return c.json<ClassListResponse>({ items })
})

/* -------------------------------------------------------------------------- */
/* GET /api/classes/:id                                                       */
/* -------------------------------------------------------------------------- */

classesRoute.get('/:id', async (c) => {
  const session = sessionOf(c)
  const id = parseParam(c, 'id', uuidSchema)

  // 404 when it does not exist, 403 when it is not yours and you are not in it.
  await loadVisibleClass(session, id)

  const found = await classSummary(id, { publishedExercisesOnly: session.role === 'student' })
  if (found === undefined) throw new ApiException(404, API_ERROR_CODES.notFound, 'That class does not exist.')

  return c.json<ClassResponse>({ class: found })
})

/* -------------------------------------------------------------------------- */
/* POST /api/classes/join                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Step 2 of onboarding. The three failures are distinct codes, not one generic
 * 400, because the Phase 4 DoD requires an error specific enough to render
 * beside the field without clearing it — "that code is not a class" and "you
 * are already in this class" call for different copy and different next steps.
 */
classesRoute.post('/join', async (c) => {
  const session = sessionOf(c)
  const body = await parseJsonBody(c, joinClassRequestSchema)

  // The input schema has already trimmed and upper-cased. Codes are stored in
  // that canonical form; comparing without it makes AB12CD and ab12cd two
  // different classes.
  const [found] = await db.select().from(classes).where(eq(classes.code, body.code)).limit(1)

  if (!found) {
    throw new ApiException(
      404,
      API_ERROR_CODES.joinCodeNotFound,
      'No class has that code. Check it with your instructor.',
    )
  }

  if (found.archived) {
    throw new ApiException(409, API_ERROR_CODES.classArchived, 'That class has been archived.')
  }

  const [existing] = await db
    .select({ joinedAt: enrollments.joinedAt })
    .from(enrollments)
    .where(and(eq(enrollments.classId, found.id), eq(enrollments.studentId, session.userId)))
    .limit(1)

  if (existing) {
    throw new ApiException(409, API_ERROR_CODES.alreadyEnrolled, `You are already in ${found.name}.`)
  }

  const [joined] = await db
    .insert(enrollments)
    .values({ classId: found.id, studentId: session.userId })
    .returning({ joinedAt: enrollments.joinedAt })

  const summary = await classSummary(found.id, { publishedExercisesOnly: true })
  if (summary === undefined || joined === undefined) {
    throw new Error(`enrollment in class ${found.id} did not read back`)
  }

  return c.json<JoinClassResponse>({ class: summary, joinedAt: iso(joined.joinedAt) }, 201)
})

/* -------------------------------------------------------------------------- */
/* DELETE /api/classes/:id/enrollment                                         */
/* -------------------------------------------------------------------------- */

/**
 * Leaving is scoped to the caller's own enrollment — there is no `:studentId`
 * in this path, so it cannot be aimed at anyone else. Removing another student
 * is the instructor's action and lives on the roster route.
 *
 * Attempts survive. They reference `profiles` and `exercises`, not
 * `enrollments`, so the work is still there if the student rejoins, and the
 * class analytics do not develop a hole.
 */
classesRoute.delete('/:id/enrollment', async (c) => {
  const session = sessionOf(c)
  const id = parseParam(c, 'id', uuidSchema)

  const removed = await db
    .delete(enrollments)
    .where(and(eq(enrollments.classId, id), eq(enrollments.studentId, session.userId)))
    .returning({ classId: enrollments.classId })

  if (removed.length === 0) {
    throw new ApiException(404, API_ERROR_CODES.notFound, 'You are not in that class.')
  }

  return c.json<LeaveClassResponse>({ ok: true })
})
