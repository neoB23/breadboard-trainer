import { z } from 'zod'

/**
 * Primitives shared by every other contract in this folder.
 *
 * Two conventions hold across all of them:
 *
 *  - **The wire is camelCase.** Postgres columns are snake_case, Drizzle maps
 *    them to camelCase properties, and handlers serialise those rows directly.
 *    Nothing renames anything in between.
 *  - **Timestamps are ISO strings, not Date objects.** `c.json()` stringifies a
 *    Date on the way out and `JSON.parse` does not revive it on the way in, so
 *    a `Date` in a response contract would be a lie on the client side.
 *
 * These modules are compiled by both tsconfig.app (DOM + vite/client) and
 * tsconfig.api (node), so nothing here may touch `window`, `process` or
 * `import.meta.env`.
 */

/* -------------------------------------------------------------------------- */
/* Identity                                                                    */
/* -------------------------------------------------------------------------- */

export const roleSchema = z.enum(['student', 'instructor', 'admin'])
export type Role = z.infer<typeof roleSchema>

/** Roles a person may hold at sign-up. `admin` is granted, never requested. */
export const signupRoleSchema = z.enum(['student', 'instructor'])
export type SignupRole = z.infer<typeof signupRoleSchema>

export const localeSchema = z.enum(['en', 'fil'])
export type Locale = z.infer<typeof localeSchema>

/**
 * Better Auth issues opaque **text** ids, and `profiles.id` references
 * `user.id`. Every id that points at a person is therefore text, not a uuid.
 *
 * Section 2 of the build plan types `classes.instructor_id`,
 * `enrollments.student_id`, `exercises.author_id` and `attempts.student_id` as
 * `uuid references profiles(id)` — those columns cannot hold a Better Auth id
 * and must be `text` in `api/db/schema.ts`. This schema is the correct shape.
 */
export const userIdSchema = z.string().min(1).max(64)
export type UserId = z.infer<typeof userIdSchema>

/** Rows we generate ourselves — classes, exercises, attempts. */
export const uuidSchema = z.uuid()

/* -------------------------------------------------------------------------- */
/* Scalars                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * `offset: true` so a handler that serialises with an explicit `+08:00` rather
 * than `Z` still validates. Both are legal timestamptz renderings and which one
 * you get depends on the driver.
 */
export const timestampSchema = z.iso.datetime({ offset: true })

/**
 * Note the `.pipe()`. In Zod 4 the checks on a string run in declaration order
 * and format validation is a check, so `z.email().trim()` rejects
 * `" a@b.com "` *before* it ever trims. Normalise first, then validate.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ error: 'Enter a valid email address.' }))

/**
 * Deliberately only a length floor. Composition rules ("one symbol, one digit")
 * push people toward `Password1!` and are worth less than length; the cap
 * exists because bcrypt-family hashes silently truncate long inputs.
 */
export const passwordSchema = z
  .string()
  .min(8, { error: 'Use at least 8 characters.' })
  .max(128, { error: 'That password is too long.' })

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, { error: 'Enter your full name.' })
  .max(120, { error: 'That name is too long.' })

/** Optional free-text field that treats "" from a cleared input as absent. */
export const optionalTextSchema = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()

/**
 * Makes a validated field optional in the way a *form* means it: blank counts as
 * not answered.
 *
 * `schema.optional()` alone is not enough, and the gap is a nasty one. A React
 * Hook Form field defaults to `''`, and an input the user clears goes back to
 * `''` — neither is `undefined`, so `studentNumberSchema.optional()` runs its
 * `.min(3)` against an empty string and fails. When the offending field is not
 * even rendered (an instructor has no student number) the error has nowhere to
 * appear, and the form silently does nothing when the button is pressed.
 *
 * That was a real bug on `/register`, found by the end-to-end suite. Every
 * optional field that carries its own constraints goes through this.
 *
 * A union rather than `z.preprocess`, deliberately: preprocess types its input as
 * `unknown`, which makes the whole form object unusable as a React Hook Form
 * field type. This keeps the input as `string | undefined`.
 */
export function blankAsAbsent<T extends z.ZodType>(schema: T) {
  return z
    .union([z.literal(''), schema])
    .optional()
    .transform((value) => (value === '' ? undefined : value))
}

export const studentNumberSchema = z.string().trim().min(3, { error: 'Enter your student number.' }).max(32)

export const sectionSchema = z.string().trim().min(1).max(32)

export const difficultySchema = z
  .int()
  .min(1, { error: 'Difficulty runs from 1 to 5.' })
  .max(5, { error: 'Difficulty runs from 1 to 5.' })
export type Difficulty = z.infer<typeof difficultySchema>

/* -------------------------------------------------------------------------- */
/* Class join codes                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Codes get read off a whiteboard and typed on a phone, so the alphabet drops
 * every confusable pair: no O/0, no I/1/L. The generator in the API must draw
 * from this exact string or codes will exist that the input schema rejects.
 */
export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const JOIN_CODE_LENGTH = 6

const joinCodePattern = new RegExp(`^[${JOIN_CODE_ALPHABET}]{${JOIN_CODE_LENGTH}}$`)

/** Canonical stored form, as it appears in responses. */
export const joinCodeSchema = z.string().regex(joinCodePattern)

/**
 * What a student types. Trims and upper-cases first — someone pasting
 * " k7m4qp " should not see an error. Phase 4 DoD requires the message be
 * useful and the field not be cleared, so the message names the shape.
 */
export const joinCodeInputSchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(
    z.string().regex(joinCodePattern, {
      error: `Join codes are ${JOIN_CODE_LENGTH} letters and numbers.`,
    }),
  )

/* -------------------------------------------------------------------------- */
/* JSON columns                                                                */
/* -------------------------------------------------------------------------- */

/**
 * For `jsonb` columns whose interior belongs to a later phase — board state
 * (Phase 10) and telemetry payloads (Phase 17). Validating the envelope now and
 * the interior later is the honest option; a guessed shape here would have to
 * be broken to be corrected.
 */
export const jsonValueSchema = z.json()
export type JsonValue = z.infer<typeof jsonValueSchema>

/* -------------------------------------------------------------------------- */
/* Envelopes                                                                   */
/* -------------------------------------------------------------------------- */

/** Response for a mutation with nothing to return. Never a bare 204. */
export const okSchema = z.object({ ok: z.literal(true) })
export type Ok = z.infer<typeof okSchema>

/**
 * Every list response is an object, never a bare array — an array has nowhere
 * to put the count, the cursor or a deprecation notice, and changing the shape
 * afterwards breaks every caller at once.
 */
export function listOf<T extends z.ZodTypeAny>(item: T) {
  return z.object({ items: z.array(item) })
}

export interface Paginated<T> {
  items: T[]
  page: number
  perPage: number
  total: number
  hasMore: boolean
}

export function pageOf<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.int().min(1),
    perPage: z.int().min(1),
    total: z.int().min(0),
    hasMore: z.boolean(),
  })
}

/**
 * Query strings are always strings, so the numeric fields coerce. Apply this
 * with `.extend()` on a route's own query schema rather than re-declaring the
 * paging fields per route.
 */
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
})
export type PageQuery = z.infer<typeof pageQuerySchema>
