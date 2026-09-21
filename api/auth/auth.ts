import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { getCookies } from 'better-auth/cookies'
import { betterAuth } from 'better-auth/minimal'

import { db } from '../db/client.ts'
import { authTables } from '../db/auth-schema.ts'
import { passwordResetEmail, verificationEmail } from './email-templates.ts'
import { selectEmailTransport, type EmailTransport } from './email.ts'

/**
 * The Better Auth instance. One per process, created at module load.
 *
 * ---------------------------------------------------------------------------
 * WHY `better-auth/minimal`
 *
 * The default `better-auth` entry point drags in Kysely so it can talk to a
 * database directly. We hand it a Drizzle adapter instead, so Kysely would be
 * dead weight in a serverless function that is already close to the size limit.
 * `minimal` is the same `betterAuth()` with that path removed.
 * ---------------------------------------------------------------------------
 *
 * ---------------------------------------------------------------------------
 * WHY THE RAW HANDLER IS NOT MOUNTED
 *
 * The build plan says "mount the Better Auth handler in Hono at /api/auth/*".
 * This project mounts an explicit allow-list of its own routes instead, each one
 * calling `auth.api.*` underneath. Three reasons, all of them security rather
 * than taste:
 *
 *   1. `POST /sign-up/email` would be reachable. That endpoint creates an auth
 *      user with no `profiles` row and no invite-code check — exactly the two
 *      controls Phase 3 exists to put in place. A prefix deny-list is the
 *      "public prefix with holes in it" that `api/app.ts` already argues
 *      against.
 *   2. Better Auth returns `{ token: session.token }` in the sign-in and sign-up
 *      response bodies. `shared/contracts/auth.ts` forbids a token in any body;
 *      a token in a body is a token in `localStorage` within a week. Our
 *      handlers forward the `Set-Cookie` header and nothing else.
 *   3. The wire shapes would be Better Auth's rather than the contracts', so
 *      every screen would need a second error adapter.
 *
 * What is *not* given up: the credential handling, the session cookie, the
 * tokens, their expiry and their consumption are all still Better Auth's. This
 * file configures it; `api/routes/auth.ts` is the only thing that calls it.
 * ---------------------------------------------------------------------------
 */

/* -------------------------------------------------------------------------- */
/* Environment                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Where the browser thinks the app lives. Two jobs: Better Auth derives whether
 * to set `Secure` on the session cookie from this URL's protocol, and every link
 * this system emails is built against it.
 *
 * Defaults to the Vite dev server rather than the API port, because the links go
 * to a person who opens them in a browser, and the browser wants the SPA.
 */
export function appOrigin(): string {
  const configured = process.env['BETTER_AUTH_URL']?.trim() || process.env['APP_URL']?.trim()
  if (configured) return configured.replace(/\/+$/, '')

  const vercel = process.env['VERCEL_PROJECT_PRODUCTION_URL']?.trim() || process.env['VERCEL_URL']?.trim()
  if (vercel) return `https://${vercel}`

  return 'http://localhost:5173'
}

/**
 * The development secret, and the fencing around it.
 *
 * Better Auth refuses to start without a secret, which is correct — every
 * verification token in this system is an HS256 JWT signed with it, and a
 * predictable secret means anyone can mint one for any address. There is no
 * `.env` on a fresh clone, so a fixed development value is the difference
 * between "clone and run" and "clone and read a stack trace".
 *
 * It is fenced the same way `DEV_AUTH` is in `middleware/session.ts`: it throws
 * on a production-like runtime rather than warning, because a warning in a log
 * nobody reads is not a control.
 */
const DEV_SECRET = 'breadboard-trainer-development-secret-do-not-deploy'

function resolveSecret(): string {
  const configured = process.env['BETTER_AUTH_SECRET']?.trim()
  if (configured) return configured

  const onVercel = (process.env['VERCEL'] ?? process.env['VERCEL_ENV'] ?? '') !== ''
  if (process.env['NODE_ENV'] === 'production' || onVercel) {
    throw new Error(
      'BETTER_AUTH_SECRET is not set. It signs every session and every verification ' +
        'token; there is no safe default on a deployed runtime. Generate one with ' +
        '`openssl rand -base64 32` and set it in the environment.',
    )
  }

  console.warn(
    '[auth] BETTER_AUTH_SECRET is not set — using the shared development secret. ' +
      'Sessions and email links signed with it are not confidential. Local development only.',
  )
  return DEV_SECRET
}

/* -------------------------------------------------------------------------- */
/* Lifetimes                                                                  */
/* -------------------------------------------------------------------------- */

const SECONDS = 1
const MINUTES = 60 * SECONDS
const HOURS = 60 * MINUTES
const DAYS = 24 * HOURS

/**
 * A verification link has to survive a student reading their email that evening.
 * An hour — Better Auth's default — expires while they are still in the lab, and
 * "your link expired" on a first-run screen reads as the product being broken.
 */
export const VERIFICATION_TOKEN_TTL_SECONDS = 24 * HOURS

/**
 * A reset link is the opposite case. It is the one credential in the system that
 * arrives by email and grants a password change, so it stays short, and the
 * screen at the other end offers to send another.
 */
export const RESET_TOKEN_TTL_SECONDS = 1 * HOURS

/** Long enough that a term's worth of lab sessions does not mean weekly sign-ins. */
const SESSION_TTL_SECONDS = 7 * DAYS

/** How stale a session row may get before a request refreshes its expiry. */
const SESSION_UPDATE_AGE_SECONDS = 1 * DAYS

/* -------------------------------------------------------------------------- */
/* Email transport                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Chosen once, and swappable so the test suite can capture messages instead of
 * printing four framed blocks per file. Deliberately a module-level mutable
 * rather than a constructor argument: `auth` is a singleton created at import
 * time, and threading a transport through it would mean building the whole
 * instance per test.
 */
let transport: EmailTransport = selectEmailTransport()

export function setEmailTransport(next: EmailTransport): EmailTransport {
  const previous = transport
  transport = next
  return previous
}

export function currentEmailTransport(): EmailTransport {
  return transport
}

/**
 * The links in those emails point at the **SPA**, not at the API.
 *
 * Better Auth builds its own URL against `{baseURL}{basePath}` — for
 * verification that is `/api/auth/verify-email?token=…`, which would land on a
 * JSON endpoint. The token is handed to us separately, so the URL is rebuilt to
 * the screen that knows how to render success, an expired link and a forged one
 * as three different things.
 */
function appLink(path: string, token: string): string {
  const url = new URL(path, `${appOrigin()}/`)
  url.searchParams.set('token', token)
  return url.href
}

/* -------------------------------------------------------------------------- */
/* The instance                                                               */
/* -------------------------------------------------------------------------- */

export const auth = betterAuth({
  appName: 'Breadboard Trainer',

  /**
   * Note the explicit `schema`. Without it the adapter falls back to
   * `db._.fullSchema`, which contains `exercises` — including the golden netlist
   * column. Naming the four tables here means the auth layer cannot reach the
   * rest of the database even by mistake.
   *
   * `transaction` is left at its default of false. Better Auth's email-and-
   * password path never needs one, and enabling it would call
   * `db.transaction()`, which throws outright on Drizzle's neon-http driver. The
   * one write in this system that genuinely must be atomic does its own — see
   * `supportsTransactions` in `api/db/client.ts`.
   */
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authTables,
  }),

  secret: resolveSecret(),

  /**
   * The origin, not the API path. Better Auth appends `basePath` itself, and —
   * more importantly — it reads this URL's protocol to decide whether the
   * session cookie gets `Secure` and the `__Secure-` name prefix. An https
   * `BETTER_AUTH_URL` therefore produces a Secure cookie without any further
   * configuration, and plain http on localhost does not, which is what lets curl
   * hold a session against the dev server.
   */
  baseURL: appOrigin(),
  basePath: '/api/auth',

  emailAndPassword: {
    enabled: true,

    /**
     * The reason this project has a verification flow at all. Without it, a
     * student can register with a colleague's address, or with one that does not
     * exist, and the roster stops being a roster.
     */
    requireEmailVerification: true,

    /**
     * No session at the end of registration. Two reasons: the account is not
     * verified yet, so a session would be a session that cannot do anything; and
     * `POST /api/auth/register` returning a signed-in cookie would make the
     * "check your email" screen a lie.
     */
    autoSignIn: false,

    // Mirrors `passwordSchema` in shared/contracts/common.ts. Both sides check,
    // and the server's check is the one that counts.
    minPasswordLength: 8,
    maxPasswordLength: 128,

    resetPasswordTokenExpiresIn: RESET_TOKEN_TTL_SECONDS,

    /**
     * Someone who has just proved control of the mailbox has, in the worst case,
     * just taken the account back from whoever was in it. Leaving that person's
     * other sessions alive would defeat the point of the reset.
     */
    revokeSessionsOnPasswordReset: true,

    async sendResetPassword({ user, token }) {
      await transport.send(
        passwordResetEmail(
          user.email,
          user.name,
          appLink('/reset-password', token),
          RESET_TOKEN_TTL_SECONDS / MINUTES,
        ),
      )
    },
  },

  emailVerification: {
    /**
     * Off, because this project never calls `signUpEmail` — registration is its
     * own handler so the profile row lands in the same transaction. That handler
     * asks for the verification email itself, after the transaction commits.
     */
    sendOnSignUp: false,

    /**
     * Off as well. Better Auth would otherwise send a fresh link on every
     * unverified sign-in attempt, which turns the login form into an unmetered
     * outbound mailer. `POST /api/auth/resend-verification` is the metered way to
     * ask for another, and the login screen offers it.
     */
    sendOnSignIn: false,

    /**
     * Verifying an address proves the mailbox, not the person at the keyboard —
     * the link may well be opened on a shared machine. So verification ends at a
     * screen that says "now sign in", never at a session.
     */
    autoSignInAfterVerification: false,

    expiresIn: VERIFICATION_TOKEN_TTL_SECONDS,

    async sendVerificationEmail({ user, token }) {
      await transport.send(
        verificationEmail(
          user.email,
          user.name,
          appLink('/verify-email', token),
          VERIFICATION_TOKEN_TTL_SECONDS / MINUTES,
        ),
      )
    },
  },

  session: {
    expiresIn: SESSION_TTL_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },

  advanced: {
    /**
     * The cookie ends up named `bbt.session_token`, or
     * `__Secure-bbt.session_token` once the origin is https. Its attributes come
     * from Better Auth's own defaults, which are exactly what Phase 3 requires:
     * `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, and `secure` tied to the
     * origin's protocol. They are deliberately *not* overridden here —
     * `defaultCookieAttributes` replaces rather than merges, and the safest
     * version of this configuration is the one with no chance to drop a flag.
     *
     * SameSite=Lax is also the CSRF control for this API. A cross-site POST does
     * not carry the cookie, the API sends no CORS headers, and every mutating
     * endpoint takes a JSON body — which a cross-origin form cannot produce
     * without a preflight the API will not answer.
     */
    cookiePrefix: 'bbt',
  },
})

/**
 * The session cookie as Better Auth will actually write it — derived from the
 * options above rather than restated, so this cannot drift from the header the
 * browser receives.
 *
 * Exported for two reasons. A test can assert `httpOnly` and `sameSite` on the
 * library's own computed value rather than on a regex over a `Set-Cookie`
 * string, and `getCookies()` can be re-run against a modified options object to
 * prove that an https origin produces `Secure` — which is the only way to check
 * that box from a machine with no TLS.
 */
export const sessionCookie = getCookies(auth.options).sessionToken

/**
 * The cookie attributes Better Auth would use for a given origin. The one input
 * that changes `secure` is the protocol of `baseURL`, so this takes an origin
 * and nothing else.
 */
export function sessionCookieForOrigin(origin: string) {
  return getCookies({ ...auth.options, baseURL: origin }).sessionToken
}
