import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { output, ZodType } from 'zod'

/**
 * Request parsing. Every handler takes its input through one of these three, so
 * no handler ever touches an unvalidated value.
 *
 * Failures are re-thrown as the raw ZodError and mapped to a 400
 * `validation_failed` with per-field `details` by the error middleware — one
 * place that decides what a validation failure looks like on the wire, which is
 * what lets `src/lib/api.ts` render inline field errors without special-casing
 * per endpoint.
 */

export async function parseJsonBody<S extends ZodType>(c: Context, schema: S): Promise<output<S>> {
  let raw: unknown
  try {
    raw = await c.req.json()
  } catch {
    // A malformed body is the caller's mistake, not ours — without this it
    // surfaces as a 500 and looks like a server fault in the logs.
    throw new HTTPException(400, { message: 'Send a JSON request body.' })
  }
  return schema.parse(raw)
}

/**
 * Query strings are flat `Record<string, string>`, which is why the paging and
 * numeric fields in `shared/contracts` coerce rather than expecting numbers.
 */
export function parseQuery<S extends ZodType>(c: Context, schema: S): output<S> {
  return schema.parse(c.req.query())
}

/**
 * Path parameters are validated too. `GET /api/attempts/not-a-uuid` must be a
 * 400, and letting it through means a driver-level cast error — which the error
 * middleware correctly refuses to show the caller, leaving them a blank 500.
 */
export function parseParam<S extends ZodType>(c: Context, name: string, schema: S): output<S> {
  return schema.parse(c.req.param(name))
}
