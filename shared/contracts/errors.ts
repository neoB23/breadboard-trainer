import { z } from 'zod'

/**
 * The single failure shape. `api/middleware/error.ts` is the only place the API
 * builds one, and `src/lib/api.ts` is the only place the client reads one, so
 * a screen never has to handle more than one error type.
 */

/**
 * Codes the API emits today. `codeForStatus()` in the error middleware produces
 * the first block; handlers throw the rest with a deliberate message.
 *
 * The wire schema below types `code` as a plain string on purpose. Handlers
 * will keep adding specific codes, and a client that hard-fails on an unknown
 * one would turn every new server-side error into an unparseable response —
 * exactly when the user most needs to be told something useful.
 */
export const API_ERROR_CODES = {
  badRequest: 'bad_request',
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  notFound: 'not_found',
  conflict: 'conflict',
  rateLimited: 'rate_limited',
  internalError: 'internal_error',

  /** Field-level validation failed; `details` carries the per-field messages. */
  validationFailed: 'validation_failed',

  /* Auth (Phase 3) */
  invalidCredentials: 'invalid_credentials',
  emailTaken: 'email_taken',
  emailNotVerified: 'email_not_verified',
  invalidToken: 'invalid_token',
  expiredToken: 'expired_token',
  /** Self-registration as instructor without a valid INSTRUCTOR_INVITE_CODE. */
  invalidInviteCode: 'invalid_invite_code',

  /* Classes (Phase 4) */
  joinCodeNotFound: 'join_code_not_found',
  alreadyEnrolled: 'already_enrolled',
  classArchived: 'class_archived',

  /* Exercises */
  exerciseNotPublished: 'exercise_not_published',

  /* Raised by the client, never by the server. See src/lib/api.ts. */
  networkError: 'network_error',
  timeout: 'timeout',
  aborted: 'aborted',
  /** A 2xx body that did not match the contract the caller asked for. */
  invalidResponse: 'invalid_response',
} as const

export type KnownApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES]

export function isKnownApiErrorCode(code: string): code is KnownApiErrorCode {
  return (Object.values(API_ERROR_CODES) as string[]).includes(code)
}

/**
 * Field-level messages keyed by form field name, for inline errors on register,
 * login and the profile forms (Phase 3 requires these). The error middleware
 * does not populate it yet — when it does, the key must match the form field,
 * not the column.
 */
export const fieldErrorsSchema = z.record(z.string(), z.array(z.string()))
export type FieldErrors = z.infer<typeof fieldErrorsSchema>

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.string().min(1),
    /**
     * Written for a person, not a log. "That email isn't registered", never
     * "AuthApiError: invalid_credentials" — the client renders this verbatim.
     */
    message: z.string().min(1),
    details: fieldErrorsSchema.optional(),
  }),
})

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>
