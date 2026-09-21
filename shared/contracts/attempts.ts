import { z } from 'zod'

import { pageOf, pageQuerySchema, timestampSchema, userIdSchema, uuidSchema } from './common.ts'
import { boardStateSchema, exerciseStudentSchema } from './exercises.ts'

/**
 * Attempts — one student's run at one exercise.
 *
 * Every handler here takes an id that belongs to somebody, so every handler
 * here calls `assertOwns()`. The Phase 2 DoD is explicit: reading another
 * student's attempt returns 403, not data. The `studentId` on the wire is for
 * an instructor's drill-down view, never for a client-side check.
 */

export const attemptSchema = z.object({
  id: uuidSchema,
  studentId: userIdSchema,
  exerciseId: uuidSchema,
  startedAt: timestampSchema,
  submittedAt: timestampSchema.nullable(),
  completed: z.boolean(),
  hintsUsed: z.int().min(0),
  faultsEncountered: z.int().min(0),
  faultsSelfResolved: z.int().min(0),
  /** Null until submission. Wall-clock, not time-on-task. */
  durationMs: z.int().min(0).nullable(),
  /**
   * The board snapshot. Absent from list rows — a 20-component board is far
   * more payload than a dashboard row needs, and shipping it per row is how a
   * list endpoint quietly becomes the slowest thing in the app.
   */
  finalState: boardStateSchema.nullable(),
})
export type Attempt = z.infer<typeof attemptSchema>

/** List row: the counters, none of the board state. */
export const attemptSummarySchema = attemptSchema.omit({ finalState: true })
export type AttemptSummary = z.infer<typeof attemptSummarySchema>

/* -------------------------------------------------------------------------- */
/* Entering the workspace                                                      */
/* -------------------------------------------------------------------------- */

/**
 * `POST /api/attempts` — called when `/lab/:exerciseId` mounts.
 *
 * Idempotent by design: if the student already has an unsubmitted attempt at
 * this exercise, the handler returns that one with `resumed: true` rather than
 * starting a second. Phase 7 DoD requires leaving and returning to resume the
 * same attempt, and a refresh must not fork the telemetry for one sitting into
 * two rows.
 */
export const attemptStartRequestSchema = z.object({ exerciseId: uuidSchema })
export type AttemptStartRequest = z.infer<typeof attemptStartRequestSchema>

export const attemptStartResponseSchema = z.object({
  attempt: attemptSchema,
  resumed: z.boolean(),
})
export type AttemptStartResponse = z.infer<typeof attemptStartResponseSchema>

/* -------------------------------------------------------------------------- */
/* Autosave and submit                                                         */
/* -------------------------------------------------------------------------- */

/**
 * `PATCH /api/attempts/:id` — periodic autosave of the board so a refresh
 * mid-build restores exactly what was there.
 *
 * The counters are accepted here because the diagnostic engine runs in the
 * browser (non-negotiable 4) and the API has no way to derive them. They are
 * therefore student-reportable numbers: fine for formative feedback, and the
 * reason the Phase 20 accuracy figures come from the seeded corpus and the
 * `events` table rather than from these fields.
 */
export const attemptSaveRequestSchema = z
  .object({
    finalState: boardStateSchema,
    hintsUsed: z.int().min(0),
    faultsEncountered: z.int().min(0),
    faultsSelfResolved: z.int().min(0),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { error: 'Nothing to save.' })
export type AttemptSaveRequest = z.infer<typeof attemptSaveRequestSchema>

/**
 * `POST /api/attempts/:id/submit`. Terminal — a submitted attempt is immutable,
 * and a second submit is a `conflict`, not a silent overwrite.
 *
 * `durationMs` comes from the client because the elapsed timer is what the
 * student watched; the server still records `submitted_at` itself, so the two
 * can be reconciled if a clock is wrong.
 */
export const attemptSubmitRequestSchema = z.object({
  finalState: boardStateSchema,
  durationMs: z.int().min(0),
  hintsUsed: z.int().min(0).default(0),
  faultsEncountered: z.int().min(0).default(0),
  faultsSelfResolved: z.int().min(0).default(0),
  completed: z.boolean().default(true),
})
export type AttemptSubmitRequest = z.infer<typeof attemptSubmitRequestSchema>

export const attemptResponseSchema = z.object({ attempt: attemptSchema })
export type AttemptResponse = z.infer<typeof attemptResponseSchema>

/* -------------------------------------------------------------------------- */
/* Results                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * `/results/:attemptId`.
 *
 * The embedded exercise is `exerciseStudentSchema` — a student reading their
 * own results is still a student, and the results page is the least obvious
 * place a golden netlist could ride along. Phase 17 fills
 * `faultTimeline` from the `events` table; until then it is an empty array and
 * the section renders its stub.
 */
export const faultTimelineEntrySchema = z.object({
  ts: timestampSchema,
  type: z.enum(['fault', 'hint', 'resolve', 'submit']),
  faultClass: z.string().nullable(),
  rowLabels: z.array(z.string()).default([]),
  /** Time from this fault first firing to its resolution. Null if unresolved. */
  isolationMs: z.int().min(0).nullable(),
})
export type FaultTimelineEntry = z.infer<typeof faultTimelineEntrySchema>

export const attemptResultResponseSchema = z.object({
  attempt: attemptSchema,
  exercise: exerciseStudentSchema,
  faultTimeline: z.array(faultTimelineEntrySchema).default([]),
})
export type AttemptResultResponse = z.infer<typeof attemptResultResponseSchema>

/* -------------------------------------------------------------------------- */
/* Lists                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A student may filter their own attempts. An instructor uses the same shape
 * with `studentId` set, and the handler rejects that parameter for a student
 * session rather than trusting it.
 */
export const attemptListQuerySchema = pageQuerySchema.extend({
  exerciseId: uuidSchema.optional(),
  studentId: userIdSchema.optional(),
  completed: z.stringbool().optional(),
})
export type AttemptListQuery = z.infer<typeof attemptListQuerySchema>

export const attemptListResponseSchema = pageOf(attemptSummarySchema)
export type AttemptListResponse = z.infer<typeof attemptListResponseSchema>
