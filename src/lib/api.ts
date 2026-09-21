import type { z } from 'zod'
import { z as zod } from 'zod'

import { API_ERROR_CODES, apiErrorBodySchema, type FieldErrors } from '@shared/contracts/errors.ts'
import { findGoldenNetlist } from '@shared/contracts/exercises.ts'

/**
 * The only way `src/` talks to the API.
 *
 * Three jobs, and nothing else: attach the session cookie, validate the
 * response against the contract the caller named, and make sure every failure
 * arrives as one `ApiError` with a code, a status and a sentence a person can
 * read. A screen that renders `error.message` should never produce
 * "TypeError: Failed to fetch" or a Zod issue dump.
 *
 * Browser-only by design — no node built-ins, no `process`, nothing that would
 * break the bundle. It never sees a connection string; the API is the entire
 * security boundary.
 */

/**
 * Single origin in dev (Vite proxies `/api` to the Hono server) and in prod
 * (`vercel.json` rewrites `/api/*` to the function), which is what keeps CORS
 * out of this project. Deliberately not configurable — an absolute base URL
 * would put it straight back in.
 */
const API_BASE = '/api'

/** Long enough for a cold serverless start, short enough to not feel hung. */
const DEFAULT_TIMEOUT_MS = 15_000

/* -------------------------------------------------------------------------- */
/* ApiError                                                                    */
/* -------------------------------------------------------------------------- */

export interface ApiErrorInit {
  code: string
  message: string
  status: number
  details?: FieldErrors
  cause?: unknown
}

/**
 * Every failure this module can produce, including the ones that never reached
 * the server. `status` is 0 for those — there was no response to have a status.
 */
export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: FieldErrors

  constructor(init: ApiErrorInit) {
    super(init.message, init.cause === undefined ? undefined : { cause: init.cause })
    this.name = 'ApiError'
    this.code = init.code
    this.status = init.status
    this.details = init.details
  }

  /** Session expired or absent — the cue to bounce to `/login`. */
  get isUnauthorized(): boolean {
    return this.status === 401 || this.code === API_ERROR_CODES.unauthorized
  }

  /** Authenticated but not allowed — render the 403 page, do not redirect. */
  get isForbidden(): boolean {
    return this.status === 403 || this.code === API_ERROR_CODES.forbidden
  }

  get isNotFound(): boolean {
    return this.status === 404 || this.code === API_ERROR_CODES.notFound
  }

  /** The request never landed. Worth a retry button rather than an apology. */
  get isTransport(): boolean {
    return this.status === 0
  }

  /** Field-level message for inline form errors, or null. */
  fieldError(field: string): string | null {
    return this.details?.[field]?.[0] ?? null
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError
}

/* -------------------------------------------------------------------------- */
/* Human fallbacks                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Used only when the server did not supply a message — a proxy 502, an HTML
 * error page, a dropped connection. A handler's own message always wins, since
 * it knows what the user was actually trying to do.
 */
function fallbackMessage(status: number): string {
  if (status === 400) return 'Something about that request was not valid.'
  if (status === 401) return 'Your session has expired. Sign in again to continue.'
  if (status === 403) return 'You do not have access to that.'
  if (status === 404) return 'We could not find that.'
  if (status === 409) return 'That conflicts with something that already exists.'
  if (status === 429) return 'Too many attempts. Wait a moment and try again.'
  if (status >= 500) return 'Something went wrong on our end. Try again in a moment.'
  return 'That did not work. Try again.'
}

function codeForStatus(status: number): string {
  if (status === 400) return API_ERROR_CODES.badRequest
  if (status === 401) return API_ERROR_CODES.unauthorized
  if (status === 403) return API_ERROR_CODES.forbidden
  if (status === 404) return API_ERROR_CODES.notFound
  if (status === 409) return API_ERROR_CODES.conflict
  if (status === 429) return API_ERROR_CODES.rateLimited
  return API_ERROR_CODES.internalError
}

/* -------------------------------------------------------------------------- */
/* Query strings                                                               */
/* -------------------------------------------------------------------------- */

export type QueryValue = string | number | boolean | null | undefined
export type QueryParams = Record<string, QueryValue | readonly QueryValue[]>

/**
 * `undefined` and `null` are dropped rather than sent as the strings
 * "undefined" and "null", so an unset filter is genuinely absent and the
 * server's `.optional()` sees what it expects. Arrays repeat the key.
 */
function toSearchParams(query: QueryParams): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    const values = Array.isArray(value) ? value : [value]
    for (const item of values as readonly QueryValue[]) {
      if (item === undefined || item === null) continue
      params.append(key, String(item))
    }
  }

  const serialised = params.toString()
  return serialised.length > 0 ? `?${serialised}` : ''
}

/* -------------------------------------------------------------------------- */
/* Request                                                                     */
/* -------------------------------------------------------------------------- */

export interface RequestOptions {
  query?: QueryParams
  signal?: AbortSignal
  headers?: Record<string, string>
  timeoutMs?: number
  /**
   * Opt out of the development-only golden netlist tripwire below. Set it on
   * the handful of instructor calls that legitimately carry a reference
   * circuit — `/api/teach/exercises/:id` and Learn Mode capture — and nowhere
   * else. Default-deny, so forgetting it is loud rather than silent.
   */
  allowGoldenNetlist?: boolean
}

interface RequestConfig extends RequestOptions {
  method: string
  body?: unknown
}

async function request<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  config: RequestConfig,
): Promise<z.output<S>> {
  const { method, body, query, signal, headers, timeoutMs = DEFAULT_TIMEOUT_MS } = config
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}${query ? toSearchParams(query) : ''}`

  // AbortSignal.any() would be tidier but is newer than the browsers a school
  // lab runs, so the caller's signal and the timeout are linked by hand.
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const forwardAbort = () => controller.abort()
  signal?.addEventListener('abort', forwardAbort, { once: true })

  let response: Response
  try {
    response = await fetch(url, {
      method,
      // The session lives in an httpOnly cookie. Without this it is not sent
      // and every authenticated request silently 401s.
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (cause) {
    if (timedOut) {
      throw new ApiError({
        code: API_ERROR_CODES.timeout,
        message: 'That took too long. Check your connection and try again.',
        status: 0,
        cause,
      })
    }
    if (signal?.aborted) {
      throw new ApiError({
        code: API_ERROR_CODES.aborted,
        message: 'Request cancelled.',
        status: 0,
        cause,
      })
    }
    throw new ApiError({
      code: API_ERROR_CODES.networkError,
      message: 'Could not reach the server. Check your connection and try again.',
      status: 0,
      cause,
    })
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', forwardAbort)
  }

  // Read as text first: a 502 from the platform is an HTML page, and calling
  // response.json() on it throws a SyntaxError that tells the user nothing.
  const text = await response.text()
  let raw: unknown
  let jsonOk = true
  if (text.trim().length > 0) {
    try {
      raw = JSON.parse(text)
    } catch {
      jsonOk = false
    }
  }

  if (!response.ok) {
    throw toApiError(response.status, jsonOk ? raw : undefined)
  }

  if (!jsonOk) {
    throw new ApiError({
      code: API_ERROR_CODES.invalidResponse,
      message: 'The server sent something we could not read.',
      status: response.status,
    })
  }

  // Guarded at the call site, not inside the function: with the check one level
  // down, the argument expression `config.allowGoldenNetlist` survives
  // minification as a property read, and `tests/bundle/client-secrets.test.ts`
  // correctly refuses to see the words "golden netlist" anywhere in a student's
  // bundle. Wrapping the whole statement lets it be dropped outright.
  if (import.meta.env.DEV) guardGoldenNetlist(url, raw, config.allowGoldenNetlist === true)

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    // The Zod issue list is a developer artefact — it names internal fields and
    // means nothing to a student, so it goes to the console and the thrown
    // message stays human.
    console.error(`[api] ${method} ${url} did not match its contract\n${zod.prettifyError(parsed.error)}`)
    throw new ApiError({
      code: API_ERROR_CODES.invalidResponse,
      message: 'The server sent something unexpected. Try again in a moment.',
      status: response.status,
      cause: parsed.error,
    })
  }

  return parsed.data as z.output<S>
}

/** Turn a non-2xx body into an ApiError, however malformed that body is. */
function toApiError(status: number, raw: unknown): ApiError {
  const parsed = apiErrorBodySchema.safeParse(raw)
  if (parsed.success) {
    return new ApiError({
      code: parsed.data.error.code,
      message: parsed.data.error.message,
      status,
      details: parsed.data.error.details,
    })
  }
  return new ApiError({ code: codeForStatus(status), message: fallbackMessage(status), status })
}

/**
 * Fourth line of defence on the golden netlist rule, and the only one that runs
 * against a live server with real data.
 *
 * Development only: it costs a walk of every response, which is not a price
 * worth paying in production, and by then the projections, the contracts and
 * the response-shape test have all had their say. What this catches is the case
 * they cannot — a handler that was correct when the test was written and picked
 * up a whole-row select later.
 */
function guardGoldenNetlist(url: string, payload: unknown, allowed: boolean): void {
  if (!import.meta.env.DEV || allowed) return

  const at = findGoldenNetlist(payload)
  if (at !== null) {
    console.error(
      `[api] GOLDEN NETLIST LEAK — ${url} returned a golden netlist at ${at}.\n` +
        'A student-facing handler must select exerciseStudentColumns. If this endpoint is ' +
        'instructor-only, pass { allowGoldenNetlist: true }.',
    )
  }
}

/* -------------------------------------------------------------------------- */
/* Verbs                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Every call names the contract it expects, so the return type comes from the
 * schema and no endpoint is typed by hand:
 *
 *   const { profile } = await api.get('/profile', profileResponseSchema)
 *   await api.post('/auth/login', loginResponseSchema, credentials)
 *
 * Endpoints that return nothing still answer `{ ok: true }` — pass `okSchema`.
 */
export const api = {
  get: <S extends z.ZodTypeAny>(path: string, schema: S, options?: RequestOptions) =>
    request(path, schema, { ...options, method: 'GET' }),

  post: <S extends z.ZodTypeAny>(path: string, schema: S, body?: unknown, options?: RequestOptions) =>
    request(path, schema, { ...options, method: 'POST', body }),

  patch: <S extends z.ZodTypeAny>(path: string, schema: S, body?: unknown, options?: RequestOptions) =>
    request(path, schema, { ...options, method: 'PATCH', body }),

  put: <S extends z.ZodTypeAny>(path: string, schema: S, body?: unknown, options?: RequestOptions) =>
    request(path, schema, { ...options, method: 'PUT', body }),

  del: <S extends z.ZodTypeAny>(path: string, schema: S, options?: RequestOptions) =>
    request(path, schema, { ...options, method: 'DELETE' }),
}

export type Api = typeof api
