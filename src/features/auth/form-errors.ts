import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

import { isApiError, type ApiError } from '@/lib/api'
import { translate, type Locale } from '@/i18n'

/**
 * Turning one API failure into whatever the form can show.
 *
 * ---------------------------------------------------------------------------
 * NO RAW ERROR STRINGS, ANYWHERE
 *
 * Phase 3's DoD says every error path shows a readable message. `src/lib/api.ts`
 * already guarantees an `ApiError` carries a sentence written for a person —
 * the API's error middleware is the only thing that builds one, and it never
 * forwards a driver message or a stack. So the job here is only routing:
 *
 *   - `details` keyed by field  ->  inline, under that input
 *   - anything else             ->  one form-level Callout
 *
 * The one case that must not slip through is a thrown value that is *not* an
 * ApiError — a TypeError from a bug in a submit handler. `String(error)` there
 * would put "TypeError: x is not a function" in front of a student, so it is
 * logged and replaced with the generic sentence.
 * ---------------------------------------------------------------------------
 */

export interface FormFailure {
  /** Rendered in a fault-toned Callout above the submit button. */
  message: string
  /** Present when the server named a specific failure the screen can branch on. */
  code?: string
}

export interface ApplyOptions<T extends FieldValues> {
  setError: UseFormSetError<T>
  /** Fields this form actually renders. A `details` key not in here has nowhere to go. */
  fields: readonly Path<T>[]
  locale: Locale
}

/**
 * Routes an error onto the form and returns whatever is left over.
 *
 * Returns `null` when every message found a field to sit under — in that case
 * the form-level Callout stays hidden rather than repeating what is already
 * beside the inputs.
 */
export function applyApiError<T extends FieldValues>(
  error: unknown,
  { setError, fields, locale }: ApplyOptions<T>,
): FormFailure | null {
  if (!isApiError(error)) {
    console.error('[form] a submit handler threw something that was not an ApiError', error)
    return { message: translate(locale, 'error.generic') }
  }

  const placed = placeFieldErrors(error, setError, fields)

  // Field errors were shown and there is nothing else to say.
  if (placed && error.code === 'validation_failed') return null

  return { message: error.message, code: error.code }
}

function placeFieldErrors<T extends FieldValues>(
  error: ApiError,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): boolean {
  if (!error.details) return false

  let placed = false
  let first = true

  for (const [field, messages] of Object.entries(error.details)) {
    const message = messages?.[0]
    if (!message) continue
    if (!fields.includes(field as Path<T>)) continue

    setError(
      field as Path<T>,
      { type: 'server', message },
      // Focus the first one only. Moving focus for each in turn would land on
      // the last field rather than the first thing the person has to fix.
      first ? { shouldFocus: true } : undefined,
    )
    placed = true
    first = false
  }

  return placed
}
