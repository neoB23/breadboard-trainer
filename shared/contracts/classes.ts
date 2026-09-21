import { z } from 'zod'

import {
  joinCodeInputSchema,
  joinCodeSchema,
  listOf,
  okSchema,
  optionalTextSchema,
  timestampSchema,
  userIdSchema,
  uuidSchema,
} from './common.ts'
import { publicProfileSchema } from './profile.ts'

/**
 * Classes and enrollment. Instructors own classes; students join one with a
 * six-character code (Phase 4) and appear on its roster (Phase 6).
 *
 * Ownership is not expressible in a schema. Every handler that takes a class id
 * must call `assertOwns()` — an instructor may only read a class they teach,
 * and a student may only read one they are enrolled in. The `instructorId`
 * field below is for display, never for an authorisation decision on the
 * client.
 */

export const classSchema = z.object({
  id: uuidSchema,
  instructorId: userIdSchema,
  name: z.string(),
  code: joinCodeSchema,
  term: z.string().nullable(),
  archived: z.boolean(),
  createdAt: timestampSchema,
})
export type Class = z.infer<typeof classSchema>

/**
 * What a list row needs: the class plus the two numbers a card shows. Computed
 * per query rather than stored, so they cannot drift.
 *
 * `code` is present here because both sides need it — the instructor to share
 * it, the student to recognise the class they typed into. It is a join token,
 * not a secret; regenerating it is the revocation mechanism.
 */
export const classSummarySchema = classSchema.extend({
  instructorName: z.string(),
  studentCount: z.int().min(0),
  exerciseCount: z.int().min(0),
})
export type ClassSummary = z.infer<typeof classSummarySchema>

/* -------------------------------------------------------------------------- */
/* Instructor: create, update, rotate the code                                 */
/* -------------------------------------------------------------------------- */

/**
 * No `code` field. The join code is generated server-side from
 * `JOIN_CODE_ALPHABET` and retried on collision — letting a client propose one
 * means either a uniqueness race or a guessable code, and both are avoidable
 * for free.
 */
export const classCreateRequestSchema = z.object({
  name: z.string().trim().min(2, { error: 'Give the class a name.' }).max(120),
  term: optionalTextSchema(40).optional(),
})
export type ClassCreateRequest = z.infer<typeof classCreateRequestSchema>

export const classUpdateRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    term: optionalTextSchema(40),
    archived: z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { error: 'Nothing to update.' })
export type ClassUpdateRequest = z.infer<typeof classUpdateRequestSchema>

export const classResponseSchema = z.object({ class: classSummarySchema })
export type ClassResponse = z.infer<typeof classResponseSchema>

export const classListResponseSchema = listOf(classSummarySchema)
export type ClassListResponse = z.infer<typeof classListResponseSchema>

/**
 * `POST /api/teach/classes/:id/code` — rotate. Existing enrollments survive;
 * only the ability to join with the old code is revoked.
 */
export const regenerateJoinCodeResponseSchema = z.object({ code: joinCodeSchema })
export type RegenerateJoinCodeResponse = z.infer<typeof regenerateJoinCodeResponseSchema>

/* -------------------------------------------------------------------------- */
/* Student: join by code                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The input schema normalises before validating, so a pasted " k7m4qp " joins
 * rather than erroring. Failure modes the handler must distinguish by code:
 * `join_code_not_found`, `already_enrolled`, `class_archived`. Phase 4 DoD
 * requires the field keep its value on failure, which only works if the error
 * is specific enough to render next to it.
 */
export const joinClassRequestSchema = z.object({ code: joinCodeInputSchema })
export type JoinClassRequest = z.infer<typeof joinClassRequestSchema>

export const joinClassResponseSchema = z.object({
  class: classSummarySchema,
  joinedAt: timestampSchema,
})
export type JoinClassResponse = z.infer<typeof joinClassResponseSchema>

export const leaveClassResponseSchema = okSchema
export type LeaveClassResponse = z.infer<typeof leaveClassResponseSchema>

/* -------------------------------------------------------------------------- */
/* Roster                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A roster row carries `publicProfileSchema`, not `profileSchema`. An
 * instructor has a legitimate need for a student's name, number and section;
 * they have no need for that student's locale, accessibility settings or
 * onboarding timestamps, and the narrower shape means a careless
 * `select()` cannot hand them over.
 *
 * Email is deliberately absent — it lives on Better Auth's `user` table and
 * nothing on the roster screen needs it.
 */
export const rosterEntrySchema = z.object({
  student: publicProfileSchema,
  joinedAt: timestampSchema,
  attemptCount: z.int().min(0),
  lastActiveAt: timestampSchema.nullable(),
})
export type RosterEntry = z.infer<typeof rosterEntrySchema>

export const rosterResponseSchema = z.object({
  class: classSummarySchema,
  items: z.array(rosterEntrySchema),
})
export type RosterResponse = z.infer<typeof rosterResponseSchema>

export const removeStudentResponseSchema = okSchema
export type RemoveStudentResponse = z.infer<typeof removeStudentResponseSchema>
