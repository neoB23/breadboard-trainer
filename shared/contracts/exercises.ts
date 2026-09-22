import { z } from 'zod'

import {
  difficultySchema,
  jsonValueSchema,
  pageOf,
  pageQuerySchema,
  timestampSchema,
  userIdSchema,
  uuidSchema,
} from './common.ts'

/**
 * Exercises — and the one rule this whole project rests on.
 *
 * ============================================================================
 * THE GOLDEN NETLIST RULE
 * ============================================================================
 * `exercises.golden_netlist` is the instructor's reference circuit. A student
 * who can read it has the answer key, and the entire diagnostic premise of the
 * system collapses. It is defended in four independent places:
 *
 *   1. `api/db/schema.ts` defines two column projections —
 *      `exerciseStudentColumns` (omits it) and `exerciseInstructorColumns`
 *      (includes it). A student-facing handler must never `select()` a whole
 *      exercise row.
 *   2. `exerciseStudentSchema` below has no such field, and Zod strips unknown
 *      keys, so even a leaked payload is scrubbed before a component sees it.
 *   3. `GoldenNetlistIsNotStudentVisible` below fails the build if the student
 *      type ever acquires the key — including transitively, via `.extend()`.
 *   4. `assertNoGoldenNetlist()` is a runtime tripwire for the response-shape
 *      test the build plan requires, and for a dev-mode check in
 *      `src/lib/api.ts`.
 *
 * Note the direction of derivation: the instructor schema extends the student
 * one. Building it the other way — student = instructor.omit({ golden }) —
 * would mean a new secret column added to the instructor shape is student-
 * visible by default until someone remembers to omit it. This way the default
 * is safe and exposure is always deliberate.
 */

/* -------------------------------------------------------------------------- */
/* Bill of materials                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The seven part families from Phase 10. `ic` means a DIP package, which is the
 * only one that straddles the centre channel — a distinction the placement code
 * and several Tier 1 rules both turn on.
 */
export const componentTypeSchema = z.enum([
  'resistor',
  'led',
  'capacitor',
  'diode',
  'transistor',
  'jumper',
  'ic',
])
export type ComponentType = z.infer<typeof componentTypeSchema>

/**
 * One line of the tray. `value` stays a display string ("220Ω", "1kΩ", "10µF")
 * rather than a number plus a unit: the tray renders it verbatim, and the
 * solver parses it in Phase 16 where the unit handling belongs.
 */
export const bomItemSchema = z.object({
  /** Stable across edits so the tray can key on it and drag state survives. */
  id: z.string().min(1).max(64),
  type: componentTypeSchema,
  label: z.string().trim().max(60).nullable(),
  value: z.string().trim().max(40).nullable(),
  quantity: z.int().min(1).max(64),
})
export type BomItem = z.infer<typeof bomItemSchema>

export const bomSchema = z.array(bomItemSchema)
export type Bom = z.infer<typeof bomSchema>

/* -------------------------------------------------------------------------- */
/* The two projections                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Everything a student may see. `difficulty` and `objective` are nullable
 * because section 2 leaves those columns nullable; the authoring form requires
 * both, so in practice they are only null on rows created before the form.
 */
export const exerciseStudentSchema = z.object({
  id: uuidSchema,
  classId: uuidSchema.nullable(),
  authorId: userIdSchema.nullable(),
  title: z.string(),
  objective: z.string().nullable(),
  difficulty: difficultySchema.nullable(),
  schematicUrl: z.string().nullable(),
  bom: bomSchema,
  netlistVersion: z.int().min(1),
  published: z.boolean(),
  createdAt: timestampSchema,
})
export type ExerciseStudent = z.infer<typeof exerciseStudentSchema>

type Expect<T extends true> = T

/**
 * Build-time half of the golden netlist rule. If `ExerciseStudent` ever gains a
 * `goldenNetlist` key — directly, or because someone re-derived it from the
 * instructor schema — the conditional resolves to `false`, `Expect<false>` does
 * not satisfy its constraint, and `npm run build` fails here with this symbol
 * named in the error.
 *
 * Exported so `noUnusedLocals` cannot quietly delete the guard.
 */
export type GoldenNetlistIsNotStudentVisible = Expect<
  'goldenNetlist' extends keyof ExerciseStudent ? false : true
>

/**
 * Both spellings: camelCase is what the wire carries, snake_case is what a raw
 * `select *` would produce if a handler ever bypassed Drizzle's mapping. The
 * tripwire has to catch the mistake in the form the mistake actually takes.
 *
 * `referenceBoard` is the instructor's reference circuit *as a board* — what
 * Learn Mode reloads, and what the stored netlist carries alongside itself. It
 * is the answer key by another name, so it is guarded like one.
 */
export const GOLDEN_NETLIST_KEYS = ['goldenNetlist', 'golden_netlist', 'referenceBoard'] as const

/**
 * Depth-first search for a golden netlist key anywhere in a payload, returning
 * the JSON path to it or null. Handles nesting because the leak that matters is
 * not `{ goldenNetlist }` at the top level — it is an exercise embedded three
 * levels down inside an attempt result.
 */
export function findGoldenNetlist(value: unknown): string | null {
  const seen = new WeakSet<object>()

  const walk = (node: unknown, path: string): string | null => {
    if (node === null || typeof node !== 'object') return null
    if (seen.has(node)) return null
    seen.add(node)

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i += 1) {
        const found = walk(node[i], `${path}[${i}]`)
        if (found !== null) return found
      }
      return null
    }

    for (const [key, child] of Object.entries(node)) {
      const here = `${path}.${key}`
      if ((GOLDEN_NETLIST_KEYS as readonly string[]).includes(key)) return here
      const found = walk(child, here)
      if (found !== null) return found
    }
    return null
  }

  return walk(value, '$')
}

/**
 * Runtime half of the rule. Call it in the response-shape test the Phase 2 DoD
 * requires, and anywhere a student-facing payload is assembled by hand.
 *
 * It throws rather than returning a boolean because there is no sensible way to
 * continue: a caller that ignored the return value is the exact failure this
 * exists to prevent.
 */
export function assertNoGoldenNetlist(payload: unknown, context = 'response'): void {
  const at = findGoldenNetlist(payload)
  if (at !== null) {
    throw new Error(
      `Golden netlist leak: ${context} contains a golden netlist key at ${at}. ` +
        'A student-facing handler must select exerciseStudentColumns, never a whole exercise row.',
    )
  }
}

/* -------------------------------------------------------------------------- */
/* Student reads                                                               */
/* -------------------------------------------------------------------------- */

export const exerciseStatusSchema = z.enum(['not_started', 'in_progress', 'completed'])
export type ExerciseStatus = z.infer<typeof exerciseStatusSchema>

/** Derived from this student's attempts. Drives the dashboard grouping. */
export const exerciseProgressSchema = z.object({
  status: exerciseStatusSchema,
  attemptCount: z.int().min(0),
  lastAttemptAt: timestampSchema.nullable(),
  /** The attempt to resume, or null when the next action is "Start". */
  openAttemptId: uuidSchema.nullable(),
})
export type ExerciseProgress = z.infer<typeof exerciseProgressSchema>

/** What `<ExerciseCard>` renders. Still no golden netlist, by construction. */
export const assignedExerciseSchema = exerciseStudentSchema.extend({
  progress: exerciseProgressSchema,
})
export type AssignedExercise = z.infer<typeof assignedExerciseSchema>

/**
 * `published` is absent from the query. A student sees published exercises and
 * nothing else, and that is decided by the session role in the handler — a
 * filter the client can set is a filter the client can unset.
 */
export const exerciseListQuerySchema = pageQuerySchema.extend({
  q: z.string().trim().max(120).optional(),
  difficulty: z.coerce.number().int().min(1).max(5).optional(),
  classId: uuidSchema.optional(),
  status: exerciseStatusSchema.optional(),
})
export type ExerciseListQuery = z.infer<typeof exerciseListQuerySchema>

export const exerciseListResponseSchema = pageOf(assignedExerciseSchema)
export type ExerciseListResponse = z.infer<typeof exerciseListResponseSchema>

export const exerciseDetailResponseSchema = z.object({ exercise: assignedExerciseSchema })
export type ExerciseDetailResponse = z.infer<typeof exerciseDetailResponseSchema>

/* -------------------------------------------------------------------------- */
/** Board state as serialised by Phase 10. Interior belongs to `src/board/`. */
export const boardStateSchema = jsonValueSchema
export type BoardState = z.infer<typeof boardStateSchema>
