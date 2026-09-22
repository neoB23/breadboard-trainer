import { z } from 'zod'

/**
 * Grades, findings and after-submit coaching — what a student sees once they
 * hand in an assigned task, and what their instructor sees beside it.
 *
 * Everything here is derived on the server from the submitted board and the
 * instructor's reference circuit, and none of it carries the reference itself.
 * A finding speaks in the *student's* terms — their refs (`D1`), their columns
 * — never in the reference's (`c0`, its nets), so reading one tells a student
 * what to look at on their own board, not what the answer key looks like.
 */

/* -------------------------------------------------------------------------- */
/* The grade                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Four fixed lines, always in this order: 70 circuit match, 10 parts, 10
 * polarity, 10 safety. Fixed so the same board scores byte-identically.
 */
export const gradeLineIdSchema = z.enum(['circuit', 'parts', 'polarity', 'safety'])
export type GradeLineId = z.infer<typeof gradeLineIdSchema>

/** An i18n key plus its parameters — the client words it, in the student's language. */
export const gradeReasonSchema = z.object({
  code: z.string().min(1),
  params: z.record(z.string(), z.union([z.string(), z.number()])),
})
export type GradeReason = z.infer<typeof gradeReasonSchema>

export const gradeLineSchema = z.object({
  id: gradeLineIdSchema,
  earned: z.int().min(0),
  possible: z.int().min(1),
  reason: gradeReasonSchema,
})
export type GradeLine = z.infer<typeof gradeLineSchema>

export const gradeSchema = z.object({
  score: z.int().min(0).max(100),
  max: z.literal(100),
  lines: z.array(gradeLineSchema),
})
export type Grade = z.infer<typeof gradeSchema>

/* -------------------------------------------------------------------------- */
/* Findings                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * In focus order: the first kind present is what the student should fix first.
 * A short outranks everything because it is the one mistake that is unsafe to
 * leave on a powered board.
 */
export const findingKindSchema = z.enum([
  'rail_short',
  'led_unprotected',
  'missing_part',
  'missing_link',
  'extra_link',
  'polarity',
  'wrong_value',
])
export type FindingKind = z.infer<typeof findingKindSchema>

export const FINDING_FOCUS_ORDER: readonly FindingKind[] = findingKindSchema.options

export const findingEndpointSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('rail'), rail: z.enum(['vcc', 'gnd']) }),
  z.object({
    kind: z.literal('pin'),
    /** The student's own ref: `D1`, `R2`. */
    ref: z.string().min(1),
    /** `A`/`K`, `C`/`B`/`E`, or `1`/`2`. */
    pin: z.string().min(1),
    /** 1-based column of the hole the leg sits in. */
    column: z.int().min(1),
  }),
])
export type FindingEndpoint = z.infer<typeof findingEndpointSchema>

export const findingSchema = z.object({
  /** `f1`, `f2`, `f3` in focus order. */
  id: z.string().min(1),
  kind: findingKindSchema,
  refs: z.array(z.string()),
  /** 1-based, sorted — where to look on the board. */
  columns: z.array(z.int().min(1)),
  endpoints: z.array(findingEndpointSchema),
  params: z.record(z.string(), z.union([z.string(), z.number()])),
})
export type Finding = z.infer<typeof findingSchema>

/** At most this many findings are returned. The rest wait until these are fixed. */
export const MAX_FINDINGS = 3

/* -------------------------------------------------------------------------- */
/* Coaching                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * `source: 'rules'` means no model wrote anything — there was none configured,
 * it was slow, or what it wrote failed the grounding check — and the client
 * renders each finding from its own catalogue in the student's language.
 * `source: 'model'` carries the model's wording, already grounding-checked on
 * the server; a finding without a suggestion still falls back to the catalogue.
 *
 * Hint-first either way: the question is shown, the fix waits behind a click.
 */
export const coachSuggestionSchema = z.object({
  findingId: z.string().min(1),
  question: z.string().min(1).max(400),
  fix: z.string().min(1).max(400),
})
export type CoachSuggestion = z.infer<typeof coachSuggestionSchema>

export const feedbackViewSchema = z.object({
  source: z.enum(['model', 'rules']),
  suggestions: z.array(coachSuggestionSchema),
  /** A sentence of praise when the circuit is right. Model-written, or null for the catalogue's. */
  praise: z.string().max(400).nullable(),
})
export type FeedbackView = z.infer<typeof feedbackViewSchema>
