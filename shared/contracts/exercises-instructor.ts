import { z } from 'zod'

import { componentTypeSchema, exerciseStudentSchema } from './exercises.ts'

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
 * shape carrying `goldenNetlist` was compiled into the student bundle.
 * `tests/bundle/client-secrets.test.ts` caught exactly that when the dashboard
 * started reading the exercise list.
 *
 * Nothing was leaking: a key name in a schema is not a reference circuit. But
 * the rule this project defends is that the answer key has no business being
 * anywhere near a student, and "the shape is in their bundle" is the first step
 * of it being in their response. Keeping the module out of the barrel means the
 * student build cannot reach it even transitively.
 *
 * Since the teacher's own screens exist, this module is **server-only** in
 * practice: those screens import `teach-authoring.ts`, which carries no golden
 * key at all, so not even the instructor bundle holds the shape.
 *
 * The reverse dependency is fine and intended: this file imports from
 * `exercises.ts`, never the other way round.
 * ---------------------------------------------------------------------------
 */

/* -------------------------------------------------------------------------- */
/* Golden netlist                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The canonical netlist from `src/board/netlist.ts`, plus the board it was
 * built on. `version` is the *format*: 2 is the canonical form, and 1 was the
 * placeholder the seed carried before the comparator existed — still readable,
 * so an old row does not break a list, but never gradable and never
 * publishable.
 *
 * The capture revision is a different number, `exercises.netlist_version`.
 */
const placedPartSchema = z.object({
  id: z.string().min(1),
  bomItemId: z.string(),
  type: componentTypeSchema,
  label: z.string().nullable(),
  value: z.string().nullable(),
  holes: z.array(z.string()),
})

export const pinRoleSchema = z.enum(['1', '2', 'A', 'K', 'C', 'B', 'E'])

export const goldenNetlistV2Schema = z.object({
  version: z.literal(2),
  referenceBoard: z.object({ version: z.literal(1), parts: z.array(placedPartSchema) }),
  components: z.array(
    z.object({
      key: z.string().min(1),
      partId: z.string().min(1),
      bomItemId: z.string(),
      type: componentTypeSchema,
      value: z.string().nullable(),
      label: z.string().nullable(),
      pins: z.array(pinRoleSchema),
      holeIndex: z.array(z.int().min(0)),
    }),
  ),
  nets: z.array(z.object({ rails: z.array(z.enum(['vcc', 'gnd'])), members: z.array(z.string()) })),
})
export type GoldenNetlistV2 = z.infer<typeof goldenNetlistV2Schema>

const legacyGoldenNetlistSchema = z.looseObject({ version: z.literal(1) })

export const goldenNetlistSchema = z.union([goldenNetlistV2Schema, legacyGoldenNetlistSchema])
export type GoldenNetlist = z.infer<typeof goldenNetlistSchema>

/** Adds the one field students may never receive. */
export const exerciseInstructorSchema = exerciseStudentSchema.extend({
  goldenNetlist: goldenNetlistSchema.nullable(),
})
export type ExerciseInstructor = z.infer<typeof exerciseInstructorSchema>

/* -------------------------------------------------------------------------- */
/* Instructor reads and writes                                                 */
/* -------------------------------------------------------------------------- */

/** `GET /api/teach/exercises/:id` — the one response that carries the netlist itself. */
export const instructorExerciseResponseSchema = z.object({ exercise: exerciseInstructorSchema })
export type InstructorExerciseResponse = z.infer<typeof instructorExerciseResponseSchema>

/**
 * The authoring list, the create/update/publish requests and Learn Mode
 * capture live in `teach-authoring.ts`, because the teacher's screens import
 * them. Re-exported here so the server keeps one import path for everything
 * instructor-side.
 */
export {
  captureReferenceRequestSchema,
  exerciseCreateRequestSchema,
  exercisePublishRequestSchema,
  exerciseUpdateRequestSchema,
  teachExerciseListResponseSchema,
  teachExerciseResponseSchema,
  teachExerciseSchema,
  type CaptureReferenceRequest,
  type ExerciseCreateRequest,
  type ExercisePublishRequest,
  type ExerciseUpdateRequest,
  type TeachExercise,
  type TeachExerciseListResponse,
} from './teach-authoring.ts'
