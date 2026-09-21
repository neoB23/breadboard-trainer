import { and, eq } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'

import { db } from '../db/client.ts'
import {
  attempts,
  classes,
  enrollments,
  exerciseInstructorColumns,
  exerciseStudentColumns,
  exercises,
  type Attempt,
  type Class,
} from '../db/schema.ts'
import { type AppSession, isAdmin } from './context.ts'

/**
 * Layer three: which rows. Session middleware proves identity and the role
 * guard proves category, but neither stops one student reading another's
 * attempt or one instructor reading another's roster — with no RLS and no
 * client-side database access, this file is the only thing that does.
 *
 * The rule the build plan states: **every handler that takes an :id calls
 * `assertOwns()`.** In practice handlers call one of the loaders below, each of
 * which fetches the row and then checks it, because the fetch and the check
 * must not be separable — a loader that hands back a row before the check is a
 * leak waiting for someone to forget the second line.
 *
 * ---------------------------------------------------------------------------
 * 404 vs 403 — deliberate, and it differs by resource.
 *
 * A row that does not exist is 404. A row that exists and is not yours is 403,
 * because the Phase 2 DoD says so in as many words: "Requesting another
 * student's attempt returns 403, not data."
 *
 * The one exception is an unpublished exercise seen by a student, which is 404.
 * Publication state is the instructor's draft process, and Phase 6 asks for
 * those to be invisible, not merely refused.
 * ---------------------------------------------------------------------------
 */

/**
 * The helper the build plan names. `ownerId` is nullable because the columns it
 * gets pointed at are — `exercises.author_id` most of all. A null owner is
 * nobody's, and nobody's is not yours.
 */
export function assertOwns(session: AppSession, ownerId: string | null, resource: string): void {
  if (isAdmin(session)) return
  if (ownerId !== null && ownerId === session.userId) return

  throw new HTTPException(403, {
    message: `You do not have access to this ${resource}.`,
  })
}

function notFound(resource: string): HTTPException {
  return new HTTPException(404, { message: `That ${resource} does not exist.` })
}

/* -------------------------------------------------------------------------- */
/* Enrollment                                                                 */
/* -------------------------------------------------------------------------- */

export async function isEnrolled(userId: string, classId: string): Promise<boolean> {
  const [row] = await db
    .select({ classId: enrollments.classId })
    .from(enrollments)
    .where(and(eq(enrollments.classId, classId), eq(enrollments.studentId, userId)))
    .limit(1)
  return row !== undefined
}

/** Every class id this student is in, as a subquery. Scopes the exercise library. */
export function enrolledClassIds(userId: string) {
  return db
    .select({ classId: enrollments.classId })
    .from(enrollments)
    .where(eq(enrollments.studentId, userId))
}

/* -------------------------------------------------------------------------- */
/* Classes                                                                    */
/* -------------------------------------------------------------------------- */

async function findClass(classId: string): Promise<Class> {
  const [row] = await db.select().from(classes).where(eq(classes.id, classId)).limit(1)
  if (!row) throw notFound('class')
  return row
}

/** For /api/teach/classes/:id — the instructor who teaches it, and nobody else. */
export async function loadOwnedClass(session: AppSession, classId: string): Promise<Class> {
  const row = await findClass(classId)
  assertOwns(session, row.instructorId, 'class')
  return row
}

/**
 * For student-facing class reads. Enrollment is not ownership, so this cannot
 * collapse into one `assertOwns()` call — the owner check runs first and
 * membership is the second way in.
 */
export async function loadVisibleClass(session: AppSession, classId: string): Promise<Class> {
  const row = await findClass(classId)
  if (isAdmin(session) || row.instructorId === session.userId) return row
  if (await isEnrolled(session.userId, classId)) return row

  throw new HTTPException(403, { message: 'You are not in this class.' })
}

/* -------------------------------------------------------------------------- */
/* Exercises                                                                  */
/* -------------------------------------------------------------------------- */

async function selectStudentExercise(exerciseId: string) {
  const [row] = await db
    .select(exerciseStudentColumns)
    .from(exercises)
    .where(eq(exercises.id, exerciseId))
    .limit(1)
  if (!row) throw notFound('exercise')
  return row
}

async function selectInstructorExercise(exerciseId: string) {
  const [row] = await db
    .select(exerciseInstructorColumns)
    .from(exercises)
    .where(eq(exercises.id, exerciseId))
    .limit(1)
  if (!row) throw notFound('exercise')
  return row
}

export type StudentExerciseRow = Awaited<ReturnType<typeof selectStudentExercise>>
export type InstructorExerciseRow = Awaited<ReturnType<typeof selectInstructorExercise>>

/**
 * THE GOLDEN NETLIST RULE, at the point where it actually bites.
 *
 * This is the only exercise loader a student-reachable handler may use, and it
 * selects `exerciseStudentColumns` — so the answer key is not merely stripped
 * from the response, it is never read out of Postgres at all. Nothing
 * downstream can leak a value that was never fetched.
 *
 * It also enforces the two visibility rules that are the API's job rather than
 * the UI's: an unpublished exercise does not exist, and a class exercise is
 * visible only inside that class. `classId === null` is the shared library that
 * `/exercises` browses.
 */
export async function loadStudentExercise(
  session: AppSession,
  exerciseId: string,
): Promise<StudentExerciseRow> {
  const row = await selectStudentExercise(exerciseId)

  if (!row.published && !isAdmin(session)) throw notFound('exercise')
  if (row.classId !== null && !isAdmin(session) && !(await isEnrolled(session.userId, row.classId))) {
    throw new HTTPException(403, { message: 'That exercise belongs to a class you are not in.' })
  }

  return row
}

/**
 * For /api/teach/exercises/:id. Two owners are legitimate: the author, and the
 * instructor of the class it was assigned to — someone taking over a section
 * mid-term must not be locked out of the exercises in it.
 */
export async function loadOwnedExercise(
  session: AppSession,
  exerciseId: string,
): Promise<InstructorExerciseRow> {
  const row = await selectInstructorExercise(exerciseId)

  if (isAdmin(session) || row.authorId === session.userId) return row
  if (row.classId !== null && (await classIsTaughtBy(row.classId, session.userId))) return row

  // Neither route in: fall through to the shared helper so the refusal message
  // and status come from one place.
  assertOwns(session, row.authorId, 'exercise')
  return row
}

async function classIsTaughtBy(classId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.instructorId, userId)))
    .limit(1)
  return row !== undefined
}

/** Whether this instructor may grade or author against an exercise. */
export async function instructorTeachesExercise(userId: string, exerciseId: string): Promise<boolean> {
  const [row] = await db
    .select({ authorId: exercises.authorId, instructorId: classes.instructorId })
    .from(exercises)
    .leftJoin(classes, eq(classes.id, exercises.classId))
    .where(eq(exercises.id, exerciseId))
    .limit(1)

  if (!row) return false
  return row.authorId === userId || row.instructorId === userId
}

/* -------------------------------------------------------------------------- */
/* Attempts                                                                   */
/* -------------------------------------------------------------------------- */

async function findAttempt(attemptId: string): Promise<Attempt> {
  const [row] = await db.select().from(attempts).where(eq(attempts.id, attemptId)).limit(1)
  if (!row) throw notFound('attempt')
  return row
}

/**
 * Writes. Strictly the student whose attempt it is — an instructor watching a
 * lab must not be able to autosave over a student's board, and an admin editing
 * attempt rows would silently corrupt the Phase 20 corpus.
 *
 * Deliberately not delegating to `assertOwns()`: its admin bypass is wrong
 * here, and a mutation guard that quietly widens is worse than one duplicated
 * comparison.
 */
export async function loadOwnAttempt(session: AppSession, attemptId: string): Promise<Attempt> {
  const row = await findAttempt(attemptId)

  if (row.studentId !== session.userId) {
    throw new HTTPException(403, { message: 'You do not have access to this attempt.' })
  }

  return row
}

/**
 * Reads. The student, plus the instructor who teaches the exercise — that
 * drill-down is what Phase 18's per-student fault timeline is built on.
 */
export async function loadReadableAttempt(session: AppSession, attemptId: string): Promise<Attempt> {
  const row = await findAttempt(attemptId)

  if (isAdmin(session) || row.studentId === session.userId) return row
  if (session.role === 'instructor' && (await instructorTeachesExercise(session.userId, row.exerciseId))) {
    return row
  }

  assertOwns(session, row.studentId, 'attempt')
  return row
}
