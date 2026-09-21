import type { Context, ErrorHandler, NotFoundHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { z, ZodError } from 'zod'

import type { FieldErrors } from '../../shared/contracts/index.ts'

export interface ApiError {
  error: {
    code: string
    message: string
    details?: FieldErrors
  }
}

/**
 * A failure with a code the client is expected to branch on.
 *
 * `codeForStatus()` below covers the generic cases, but several flows need to
 * tell two failures with the same status apart: `/onboarding` must distinguish
 * `join_code_not_found` from `already_enrolled` from `class_archived` to keep
 * the field populated and say something useful (Phase 4 DoD), and
 * `/reset-password` must tell `expired_token` — which has a resend button —
 * from `invalid_token`, which does not.
 *
 * The vocabulary is `API_ERROR_CODES` in `shared/contracts/errors.ts`. Codes are
 * typed as plain strings on the wire on purpose, so adding one here does not
 * break a client that has not learned it yet.
 */
export class ApiException extends HTTPException {
  readonly code: string
  readonly details: FieldErrors | undefined

  constructor(status: ContentfulStatusCode, code: string, message: string, details?: FieldErrors) {
    super(status, { message })
    this.code = code
    this.details = details
  }
}

/**
 * Single exit point for failures.
 *
 * An unexpected error is logged in full and returned as a generic 500 — the
 * client never sees a stack trace or a driver message, because those leak
 * schema details. Anything the caller is allowed to act on must be thrown as an
 * HTTPException with a deliberate message.
 */
export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof ZodError) {
    return c.json<ApiError>(validationFailure(err), 400)
  }

  if (err instanceof ApiException) {
    return c.json<ApiError>(
      { error: { code: err.code, message: err.message, ...(err.details && { details: err.details }) } },
      err.status,
    )
  }

  if (err instanceof HTTPException) {
    return c.json<ApiError>({ error: { code: codeForStatus(err.status), message: err.message } }, err.status)
  }

  console.error('[api] unhandled error', err)
  return c.json<ApiError>(
    { error: { code: 'internal_error', message: 'Something went wrong on our end.' } },
    500,
  )
}

export const notFoundHandler: NotFoundHandler = (c: Context) =>
  c.json<ApiError>({ error: { code: 'not_found', message: 'No such endpoint.' } }, 404)

/**
 * Validation is the one failure with structure worth keeping. `validate.ts`
 * lets the raw ZodError through so the shape of a field error is decided here
 * and nowhere else — which is what lets the register and settings forms render
 * inline errors without a per-endpoint adapter.
 *
 * Keys are form field names, matching `fieldErrorsSchema` in the contracts.
 * Issues with no path — a `.refine()` over a whole object, say — land under
 * `_form`, because a message with no field still has to be shown somewhere.
 */
function validationFailure(err: ZodError): ApiError {
  const flat = z.flattenError(err)
  const details: FieldErrors = { ...flat.fieldErrors }
  if (flat.formErrors.length > 0) details['_form'] = [...flat.formErrors]

  return {
    error: {
      code: 'validation_failed',
      // The per-field messages are the useful half; this line is what a caller
      // renders when it has nowhere to put them.
      message: firstMessage(flat) ?? 'Check the highlighted fields.',
      details,
    },
  }
}

function firstMessage(flat: {
  formErrors: string[]
  fieldErrors: Record<string, string[] | undefined>
}): string | undefined {
  const [form] = flat.formErrors
  if (form !== undefined) return form

  for (const messages of Object.values(flat.fieldErrors)) {
    const [first] = messages ?? []
    if (first !== undefined) return first
  }
  return undefined
}

function codeForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'bad_request'
    case 401:
      return 'unauthorized'
    case 403:
      return 'forbidden'
    case 404:
      return 'not_found'
    case 409:
      return 'conflict'
    case 429:
      return 'rate_limited'
    default:
      return 'error'
  }
}
