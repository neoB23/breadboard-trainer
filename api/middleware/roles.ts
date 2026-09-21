import type { MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

import type { Role } from '../db/schema.ts'
import { type AppEnv, sessionOf } from './context.ts'

/**
 * Layer two of the three-layer authorisation model in section 2 of the build
 * plan: session (layer 1) proves who, role (this) proves what kind, and
 * `assertOwns()` in `ownership.ts` (layer 3) proves which rows.
 *
 * Role alone is never sufficient. `requireRole('instructor')` on /api/teach/*
 * stops a student reading any golden netlist; it does nothing to stop one
 * instructor reading another instructor's class. That is layer 3's job, and
 * every handler under this guard still calls it.
 *
 * `admin` satisfies every requirement. There is one admin path into this system
 * — an existing admin promoting an account — so this is not a privilege a
 * student can reach for; see the instructor invite gate in Phase 3.
 */
export function requireRole(...allowed: readonly Role[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const session = sessionOf(c)

    if (session.role !== 'admin' && !allowed.includes(session.role)) {
      // 403, not 404. The route exists and the caller is authenticated; hiding
      // that fact would only make a legitimate instructor's misconfiguration
      // look like a broken deploy.
      throw new HTTPException(403, {
        message: 'This area is for instructors.',
      })
    }

    await next()
  }
}
