import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'

import type { Role } from '../db/schema.ts'

/**
 * The per-request context every handler in this API shares.
 *
 * There is exactly one variable — the session — and it is nullable, because the
 * variable is set by `resolveSession` on *every* request including anonymous
 * ones. Modelling it as non-null would require a second Env type and a second
 * Hono instance to mount it on, and the two would drift.
 *
 * Handlers do not read `c.get('session')` directly. They call `sessionOf(c)`,
 * which narrows the null away by throwing 401. That throw is unreachable in
 * practice — `requireSession` has already run — and that is the point: the
 * accessor is a backstop for the day someone mounts a router outside the
 * default-deny chain in app.ts.
 */

export interface AppSession {
  readonly userId: string
  readonly role: Role
  readonly fullName: string
  readonly locale: string
  /** Null until onboarding completes. Phase 4 gates on exactly this. */
  readonly onboardedAt: Date | null
}

export interface AppEnv {
  Variables: {
    session: AppSession | null
  }
}

export function sessionOf(c: Context<AppEnv>): AppSession {
  const session = c.get('session')
  if (!session) {
    throw new HTTPException(401, { message: 'Sign in to continue.' })
  }
  return session
}

/** True when the caller may act on data that is not theirs. */
export function isAdmin(session: AppSession): boolean {
  return session.role === 'admin'
}
