import { z } from 'zod'

import { difficultySchema, listOf, optionalTextSchema, timestampSchema, uuidSchema } from './common.ts'
import { bomSchema, exerciseStudentSchema } from './exercises.ts'

/**
 * The instructor half of the exercise contract — including the golden netlist.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A SEPARATE MODULE, AND NOT IN THE BARREL
 *
 * `shared/contracts/index.ts` deliberately does **not** re-export this file.
 * Instructor code imports it by path:
 *
 *     import { exerciseInstructorSchema } from '@shared/contracts/exercises-instructor.ts'
 *
 * That is not stylistic. A Zod schema is a value, built by a function call at
 * module scope, so a bundler cannot prove it side-effect-free and cannot shake
 * it out. The moment one client screen imported *anything* from the barrel, the
 * shape carrying `goldenNetlist` — and `hasGoldenNetlist` with it — was compiled
 * into the student bundle. `tests/bundle/client-secrets.test.ts` caught exactly
 * that when the dashboard started reading the exercise list.
 *
 * Nothing was leaking: a key name in a schema is not a reference circuit. But
 * the rule this project defends is that the answer key has no business being
 * anywhere near a student, and "the shape is in their bundle" is the first step
 * of it being in their response. Keeping the module out of the barrel means the
 * student build cannot reach it even transitively.
 *
 * The reverse dependency is fine and intended: this file imports from
 * `exercises.ts`, never the other way round.
 * ---------------------------------------------------------------------------
 */

/* -------------------------------------------------------------------------- */
/* Golden netlist                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Loose on purpose. Phase 11 designs the canonical netlist form and Phase 12
 * captures it; the only thing that must be true from day one is that it carries
 * a version, because `exercises.netlist_version` has to mean something when a
 * re-capture invalidates existing attempts.
 *
 * Tighten the interior in Phase 11. Guessing it now would produce a contract
 * that has to be broken to be corrected.
 */
export const goldenNetlistSchema = z.looseObject({ version: z.int().min(1) })
export type GoldenNetlist = z.infer<typeof goldenNetlistSchema>

/** Adds the one field students may never receive. */
export const exerciseInstructorSchema = exerciseStudentSchema.extend({
  goldenNetlist: goldenNetlistSchema.nullable(),
})
export type ExerciseInstructor = z.infer<typeof exerciseInstructorSchema>

/* -------------------------------------------------------------------------- */
/* Instructor reads and writes                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Carries `hasGoldenNetlist` rather than the netlist itself so the authoring
 * list can show a "captured / not captured" badge without shipping every
 * reference circuit down to render a list.
 */
export const instructorExerciseSummarySchema = exerciseStudentSchema.extend({
  hasGoldenNetlist: z.boolean(),
  attemptCount: z.int().min(0),
})
export type InstructorExerciseSummary = z.infer<typeof instructorExerciseSummarySchema>

export const instructorExerciseListResponseSchema = listOf(instructorExerciseSummarySchema)
export type InstructorExerciseListResponse = z.infer<typeof instructorExerciseListResponseSchema>

export const instructorExerciseResponseSchema = z.object({ exercise: exerciseInstructorSchema })
export type InstructorExerciseResponse = z.infer<typeof instructorExerciseResponseSchema>

/**
 * `goldenNetlist` is not settable here. It is captured through Learn Mode and
 * nowhere else, because capture is what runs the validity checks in Phase 12
 * (no floating leads, no shorts, every BOM part used) and bumps the version.
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
 * needs — you cannot publish an exercise with no captured netlist — lives in
 * one handler instead of being re-checked on every metadata edit.
 */
export const exercisePublishRequestSchema = z.object({ published: z.boolean() })
export type ExercisePublishRequest = z.infer<typeof exercisePublishRequestSchema>

/* -------------------------------------------------------------------------- */
/* Learn Mode capture (Phase 12)                                               */
/* -------------------------------------------------------------------------- */

/**
 * `confirmReplace` exists because a re-capture increments `netlist_version` and
 * invalidates every attempt judged against the old one. The instructor has to
 * say so twice — once in the dialog, once on the wire.
 */
export const captureNetlistRequestSchema = z.object({
  netlist: goldenNetlistSchema,
  confirmReplace: z.boolean().default(false),
})
export type CaptureNetlistRequest = z.infer<typeof captureNetlistRequestSchema>

export const captureNetlistResponseSchema = z.object({
  netlistVersion: z.int().min(1),
  capturedAt: timestampSchema,
  /** Attempts made against the previous version, now stale. */
  invalidatedAttempts: z.int().min(0),
})
export type CaptureNetlistResponse = z.infer<typeof captureNetlistResponseSchema>

/**
 * Capture-time validation failures, returned as `details` on a
 * `validation_failed` error. Phase 12 DoD requires a *specific* reason, not
 * "invalid circuit".
 */
export const captureValidationIssueSchema = z.object({
  reason: z.enum(['floating_lead', 'short_circuit', 'unused_bom_component', 'empty_board']),
  message: z.string(),
  rowLabels: z.array(z.string()).default([]),
})
export type CaptureValidationIssue = z.infer<typeof captureValidationIssueSchema>
