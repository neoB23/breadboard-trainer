import { eq } from 'drizzle-orm'
import type { Context, MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

import { db } from '../db/client.ts'
import { profiles } from '../db/schema.ts'
import type { AppEnv, AppSession } from './context.ts'

/**
 * Session resolution — the seam Better Auth drops into in Phase 3.
 *
 * The rest of the API knows only `AppSession`. How that session is proved is
 * behind `SessionProvider`, so Phase 3 is a single call:
 *
 *   // api/routes/auth.ts
 *   setSessionProvider(async (c) => {
 *     const found = await auth.api.getSession({ headers: c.req.raw.headers })
 *     return found ? loadSessionForUser(found.user.id) : null
 *   })
 *
 * and nothing else in api/ changes.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE IS NO FAKE USER
 *
 * The obvious way to make handlers testable before auth exists is to have the
 * resolver hand back a hardcoded student. That is precisely the code that
 * survives into production, because it never fails loudly — it just quietly
 * authenticates everybody as the same person.
 *
 * So the default provider returns null, which means every protected route is
 * 401 until Phase 3 installs a real one. The development provider below is the
 * only alternative, and it is fenced three ways:
 *
 *   1. It is off unless DEV_AUTH=1 is explicitly set.
 *   2. It throws at startup if that flag is seen on a production-like runtime —
 *      NODE_ENV=production, or any Vercel deployment at all, preview included.
 *      A misconfigured deploy fails every request with a 500 rather than
 *      serving one identity to the whole class.
 *   3. It invents nothing. It reads an id and looks up a real `profiles` row;
 *      an unknown id is null, which is 401. It is impersonation of a seeded
 *      account, not a synthetic session.
 * ---------------------------------------------------------------------------
 */

export type SessionProvider = (c: Context<AppEnv>) => Promise<AppSession | null>

/** Header the development provider reads, so several identities can be exercised in one dev server. */
export const DEV_USER_HEADER = 'x-dev-user'

let installed: SessionProvider | undefined
let fallback: SessionProvider | undefined

/** Phase 3 calls this once, at module load of the auth route. */
export function setSessionProvider(next: SessionProvider): void {
  installed = next
  fallback = undefined
}

/**
 * Loads the application half of a session for an already-authenticated user id.
 * Better Auth proves *who* the caller is; this answers *what they are*, which
 * is the half every role and ownership check in this API runs on.
 *
 * Returns null when no profile row exists. That is a real state — registration
 * creates the auth user and the profile in one transaction (Phase 3 task 5),
 * so a user without a profile is a half-created account and must not be treated
 * as signed in.
 */
export async function loadSessionForUser(userId: string): Promise<AppSession | null> {
  const [row] = await db
    .select({
      id: profiles.id,
      role: profiles.role,
      fullName: profiles.fullName,
      locale: profiles.locale,
      onboardedAt: profiles.onboardedAt,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1)

  if (!row) return null

  return {
    userId: row.id,
    role: row.role,
    fullName: row.fullName,
    locale: row.locale,
    onboardedAt: row.onboardedAt,
  }
}

/**
 * Never throws and never short-circuits. Anonymous is a legitimate outcome —
 * `/api/health` and, from Phase 3, `GET /api/auth/session` both need it.
 * Refusal is `requireSession`'s job, one layer down.
 */
export const resolveSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set('session', await currentProvider()(c))
  await next()
}

/** Default-deny. app.ts applies this to everything outside a short public allowlist. */
export const requireSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('session')) {
    throw new HTTPException(401, { message: 'Sign in to continue.' })
  }
  await next()
}

/* -------------------------------------------------------------------------- */
/* Provider selection                                                         */
/* -------------------------------------------------------------------------- */

function currentProvider(): SessionProvider {
  if (installed) return installed
  fallback ??= selectFallbackProvider()
  return fallback
}

function selectFallbackProvider(): SessionProvider {
  if (process.env['DEV_AUTH'] === '1') {
    assertNotProductionLike()
    console.warn(
      '[auth] DEV_AUTH=1 — sessions are being impersonated from the ' +
        `${DEV_USER_HEADER} header or DEV_AUTH_USER. Local development only.`,
    )
    return devSessionProvider
  }

  console.warn(
    '[auth] no session provider installed — every protected route will answer 401. ' +
      'Phase 3 fixes this by calling setSessionProvider() with the Better Auth adapter.',
  )
  return async () => null
}

const devSessionProvider: SessionProvider = async (c) => {
  const userId = c.req.header(DEV_USER_HEADER)?.trim() || process.env['DEV_AUTH_USER']?.trim()
  if (!userId) return null
  return loadSessionForUser(userId)
}

/**
 * Thrown rather than logged. A deploy that reaches this has DEV_AUTH set in a
 * real environment, and a warning in a log nobody reads is not a control.
 */
function assertNotProductionLike(): void {
  const onVercel = (process.env['VERCEL'] ?? process.env['VERCEL_ENV'] ?? '') !== ''
  if (process.env['NODE_ENV'] === 'production' || onVercel) {
    throw new Error(
      'DEV_AUTH=1 is set on a production-like runtime (NODE_ENV=production or a Vercel ' +
        'deployment). Impersonated sessions must never leave a developer machine. Unset it.',
    )
  }
}
