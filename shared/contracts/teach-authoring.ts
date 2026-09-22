import { z } from 'zod'

import {
  difficultySchema,
  listOf,
  optionalTextSchema,
  timestampSchema,
  userIdSchema,
  uuidSchema,
} from './common.ts'
import { bomSchema, boardStateSchema, exerciseStudentSchema } from './exercises.ts'

/**
 * What the teacher's screens send and receive — authoring, Learn Mode capture,
 * and the scores list.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT `exercises-instructor.ts`
 *
 * That module holds the golden netlist's shape, and a Zod schema is a value a
 * bundler cannot shake out. The teacher's pages ship in the same build as the
 * student's, so anything they import is in every bundle — and
 * `tests/bundle/client-secrets.test.ts` refuses to find the words "golden
 * netlist" anywhere in one. So the teacher client never touches that shape:
 * the list says `hasReference`, and Learn Mode reads the instructor's board
 * back as `referenceBoard`, a key the server's tripwire guards exactly like
 * the netlist itself.
 *
 * Kept out of the barrel all the same. A student screen has no business
 * importing any of it.
 * ---------------------------------------------------------------------------
 */

/* -------------------------------------------------------------------------- */
/* The teacher's view of an exercise                                           */
/* -------------------------------------------------------------------------- */

/**
 * The student projection plus two answers the authoring screens need: has a
 * reference been captured, and how many attempts are there. The reference
 * itself stays in Postgres unless Learn Mode asks for it by name.
 */
export const teachExerciseSchema = exerciseStudentSchema.extend({
  hasReference: z.boolean(),
  attemptCount: z.int().min(0),
})
export type TeachExercise = z.infer<typeof teachExerciseSchema>

export const teachExerciseListResponseSchema = listOf(teachExerciseSchema)
export type TeachExerciseListResponse = z.infer<typeof teachExerciseListResponseSchema>

export const teachExerciseResponseSchema = z.object({
  exercise: teachExerciseSchema,
  /** True when this change cleared the captured reference (a bill-of-materials edit). */
  referenceCleared: z.boolean().optional(),
})
export type TeachExerciseResponse = z.infer<typeof teachExerciseResponseSchema>

/* -------------------------------------------------------------------------- */
/* Authoring                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The reference is not settable here. It is captured through Learn Mode and
 * nowhere else, because capture is what runs the validity checks (no floating
 * leads, no shorts, every tray part used) and bumps the version.
 */
export const exerciseCreateRequestSchema = z.object({
  title: z.string().trim().min(3, { error: 'Give the exercise a title.' }).max(160),
  objective: optionalTextSchema(600).optional(),
  difficulty: difficultySchema,
  classId: uuidSchema.nullable().optional(),
  schematicUrl: z.string().max(2048).nullable().optional(),
  bom: bomSchema.default([]),
})
export type ExerciseCreateRequest = z.infer<typeof exerciseCreateRequestSchema>

export const exerciseUpdateRequestSchema = exerciseCreateRequestSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { error: 'Nothing to update.' })
export type ExerciseUpdateRequest = z.infer<typeof exerciseUpdateRequestSchema>

/**
 * Publishing is its own endpoint rather than a field on update, so the guard it
 * needs — you cannot publish an exercise with no captured reference — lives in
 * one handler instead of being re-checked on every metadata edit.
 */
export const exercisePublishRequestSchema = z.object({ published: z.boolean() })
export type ExercisePublishRequest = z.infer<typeof exercisePublishRequestSchema>

/* -------------------------------------------------------------------------- */
/* Learn Mode                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Why a board cannot be captured. Returned as `details` on a 422
 * `validation_failed`, keyed by reason, each carrying what to point at (refs,
 * or tray labels for unused parts).
 */
export const referenceIssueReasonSchema = z.enum([
  'empty_board',
  'short_circuit',
  'floating_lead',
  'unused_bom_component',
])
export type ReferenceIssueReason = z.infer<typeof referenceIssueReasonSchema>

/**
 * The instructor sends the **board**, not a netlist: the server parses it,
 * validates it, and derives the netlist with the same pure functions the
 * student's grade is computed with.
 *
 * `confirmReplace` exists because a re-capture increments `netlist_version` and
 * marks every attempt judged against the old one as stale. The instructor has
 * to say so twice — once in the dialog, once on the wire.
 */
export const captureReferenceRequestSchema = z.object({
  board: boardStateSchema,
  confirmReplace: z.boolean().default(false),
})
export type CaptureReferenceRequest = z.infer<typeof captureReferenceRequestSchema>

export const captureReferenceResponseSchema = z.object({
  exercise: teachExerciseSchema,
  capturedAt: timestampSchema,
  /** Attempts graded against the previous reference, now stale. */
  invalidatedAttempts: z.int().min(0),
})
export type CaptureReferenceResponse = z.infer<typeof captureReferenceResponseSchema>

/** `GET /api/teach/exercises/:id/reference` — what Learn Mode reloads. */
export const referenceViewResponseSchema = z.object({
  exercise: teachExerciseSchema,
  reference: z
    .object({
      referenceBoard: boardStateSchema,
      components: z.int().min(0),
      nets: z.int().min(0),
    })
    .nullable(),
})
export type ReferenceViewResponse = z.infer<typeof referenceViewResponseSchema>

/* -------------------------------------------------------------------------- */
/* Scores                                                                      */
/* -------------------------------------------------------------------------- */

export const submissionRowSchema = z.object({
  attemptId: uuidSchema,
  studentId: userIdSchema,
  fullName: z.string(),
  studentNumber: z.string().nullable(),
  submittedAt: timestampSchema,
  /** Null when the attempt was never graded — submitted before a reference existed. */
  score: z.int().min(0).max(100).nullable(),
  completed: z.boolean(),
  durationMs: z.int().min(0).nullable(),
  /** Graded against a reference that has since been re-captured. */
  stale: z.boolean(),
})
export type SubmissionRow = z.infer<typeof submissionRowSchema>

export const submissionsResponseSchema = z.object({
  exercise: teachExerciseSchema,
  items: z.array(submissionRowSchema),
})
export type SubmissionsResponse = z.infer<typeof submissionsResponseSchema>
