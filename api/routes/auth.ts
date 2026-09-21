import { eq } from 'drizzle-orm'
import { Hono } from 'hono'

import {
  API_ERROR_CODES,
  changePasswordRequestSchema,
  forgotPasswordRequestSchema,
  loginRequestSchema,
  registerRequestSchema,
  resendVerificationRequestSchema,
  resetPasswordRequestSchema,
  verifyEmailRequestSchema,
  type AuthUser,
  type ChangePasswordResponse,
  type ForgotPasswordResponse,
  type LoginResponse,
  type LogoutResponse,
  type MeResponse,
  type RegisterResponse,
  type ResendVerificationResponse,
  type ResetPasswordResponse,
  type Session,
  type SessionResponse,
  type VerifyEmailResponse,
} from '../../shared/contracts/index.ts'
import { auth, RESET_TOKEN_TTL_SECONDS, VERIFICATION_TOKEN_TTL_SECONDS } from '../auth/auth.ts'
import { assertMayRegisterAs, createAccountWithProfile } from '../auth/registration.ts'
import { claimToken, sweepExpiredRedemptions } from '../auth/single-use.ts'
import { db } from '../db/client.ts'
import { profiles, user, verification } from '../db/schema.ts'
import { sessionOf, type AppEnv } from '../middleware/context.ts'
import { ApiException } from '../middleware/error.ts'
import {
  callerAddress,
  EMAIL_SEND_BY_ACCOUNT,
  EMAIL_SEND_BY_ADDRESS,
  enforce,
  LOGIN_BY_ACCOUNT,
  LOGIN_BY_ADDRESS,
  REGISTER_BY_ADDRESS,
  TOKEN_REDEEM_BY_ADDRESS,
} from '../middleware/rate-limit.ts'
import { loadSessionForUser, requireSession, setSessionProvider } from '../middleware/session.ts'
import { parseJsonBody } from '../middleware/validate.ts'
import { iso, toProfile } from './serializers.ts'

/**
 * Everything under `/api/auth`.
 *
 * ---------------------------------------------------------------------------
 * THIS FILE IS THE ONLY CALLER OF BETTER AUTH
 *
 * `api/auth/auth.ts` configures the instance; nothing else in the API imports
 * it. Every endpoint here is an explicit route rather than a mounted handler —
 * the reasoning is written out in that file, but the short version is that
 * Better Auth's own `/sign-up/email` would bypass both the invite gate and the
 * profile transaction, and its sign-in response body contains the session token,
 * which the contracts forbid.
 *
 * What crosses the boundary out of Better Auth is exactly one thing: the
 * `Set-Cookie` header. Never the token, never the body.
 * ---------------------------------------------------------------------------
 *
 * ---------------------------------------------------------------------------
 * `/api/auth` IS ON `PUBLIC_PREFIXES`
 *
 * It has to be — signing in cannot require being signed in. The consequence,
 * spelled out in `api/app.ts`, is that the default-deny middleware does **not**
 * cover this router. Two endpoints here need a session, and both apply
 * `requireSession` themselves:
 *
 *     GET  /api/auth/me
 *     POST /api/auth/change-password
 *
 * Forgetting that on a route added later means an endpoint that answers 200 to
 * an anonymous caller. `tests/api/auth-boundary.test.ts` asserts it for both.
 * ---------------------------------------------------------------------------
 */
export const authRoute = new Hono<AppEnv>()

/* -------------------------------------------------------------------------- */
/* The session provider                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Phase 2 left `middleware/session.ts` with a default provider that returns null
 * so every protected route answered 401. This is the line that replaces it.
 *
 * It runs at module load, and `api/app.ts` imports this router, so any process
 * with the app in it has the real provider installed. The two halves are
 * deliberately separate: Better Auth proves *who* is calling, and
 * `loadSessionForUser` answers *what they are* — the role and onboarding state
 * every guard downstream runs on. A user with no profile row resolves to null,
 * which is 401, because a half-created account must not be treated as signed in.
 */
setSessionProvider(async (c) => {
  const found = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!found) return null
  return loadSessionForUser(found.user.id)
})

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Better Auth's `user` row and this project's `profiles` row, together, in the
 * shape `sessionSchema` describes. One query, because the app shell needs both
 * on every page load and two round trips for one screen is one too many.
 *
 * Note what is *not* selected: nothing from `account`. The password hash lives
 * there and no projection that could reach it exists in this file.
 */
async function sessionPayload(userId: string): Promise<Session | null> {
  const [row] = await db
    .select({
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      userCreatedAt: user.createdAt,
      fullName: profiles.fullName,
      role: profiles.role,
      studentNumber: profiles.studentNumber,
      section: profiles.section,
      locale: profiles.locale,
      onboardedAt: profiles.onboardedAt,
      preferences: profiles.preferences,
      profileCreatedAt: profiles.createdAt,
    })
    .from(user)
    .innerJoin(profiles, eq(profiles.id, user.id))
    .where(eq(user.id, userId))
    .limit(1)

  // An inner join, so a missing row means a user with no profile — the
  // half-created state registration's transaction exists to prevent. Null here
  // becomes a 401 rather than a partially populated shell.
  if (!row) return null

  const authUser: AuthUser = {
    id: row.id,
    email: row.email,
    emailVerified: row.emailVerified,
    createdAt: iso(row.userCreatedAt),
  }

  return {
    user: authUser,
    profile: toProfile({
      id: row.id,
      fullName: row.fullName,
      role: row.role,
      studentNumber: row.studentNumber,
      section: row.section,
      locale: row.locale,
      onboardedAt: row.onboardedAt,
      preferences: row.preferences,
      createdAt: row.profileCreatedAt,
    }),
  }
}

/**
 * Copies the `Set-Cookie` headers Better Auth produced onto our response.
 *
 * `getSetCookie()` rather than `get('set-cookie')`: a sign-in sets more than one
 * cookie when "remember me" is off, and joining them with a comma — which is
 * what `get()` does — produces a header no browser will parse.
 *
 * This is the entire surface across which a session leaves Better Auth. There is
 * no code path in this file that reads a token out of a response body.
 */
function forwardCookies(c: Parameters<typeof sessionOf>[0], headers: Headers): void {
  for (const cookie of headers.getSetCookie()) {
    c.header('set-cookie', cookie, { append: true })
  }
}

/**
 * Better Auth throws `APIError` from `better-call`, which carries a numeric
 * `statusCode` and a `body` with its own `code`. Checked structurally rather
 * than with `instanceof`: two copies of the class exist in the dependency tree
 * (better-call's, and Better Auth's subclass of it) and an `instanceof` against
 * the wrong one silently falls through to a 500.
 */
interface AuthApiError {
  statusCode: number
  body?: { code?: string; message?: string }
}

function isAuthApiError(err: unknown): err is AuthApiError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    typeof (err as { statusCode: unknown }).statusCode === 'number'
  )
}

/**
 * Library failure to something a person can read.
 *
 * Every message here is written for the student in front of the screen. The
 * build plan's example is "That email isn't registered" rather than
 * "AuthApiError: invalid_credentials", and the second half of that is honoured
 * exactly — but not the first: telling an anonymous caller whether an address is
 * registered turns the sign-in form into an account-existence oracle, and Better
 * Auth deliberately returns one indistinguishable failure for a wrong address
 * and a wrong password. So the copy is human *and* silent on which half was
 * wrong.
 */
function translateAuthError(err: unknown, fallback: string): ApiException {
  if (!isAuthApiError(err)) {
    // Not from Better Auth at all — a driver fault, a bug. Let the error
    // middleware log it in full and answer a generic 500; a message we invented
    // here would hide it.
    return err instanceof ApiException ? err : new ApiException(500, API_ERROR_CODES.internalError, fallback)
  }

  const code = err.body?.code

  switch (code) {
    case 'INVALID_EMAIL_OR_PASSWORD':
    case 'INVALID_PASSWORD':
      return new ApiException(
        401,
        API_ERROR_CODES.invalidCredentials,
        'That email and password do not match an account.',
      )

    case 'EMAIL_NOT_VERIFIED':
      return new ApiException(
        403,
        API_ERROR_CODES.emailNotVerified,
        'Confirm your email address before signing in. We can send you another link.',
      )

    case 'TOKEN_EXPIRED':
      return new ApiException(
        410,
        API_ERROR_CODES.expiredToken,
        'That link has expired. Ask for a new one and it will arrive in a moment.',
      )

    case 'INVALID_TOKEN':
    case 'USER_NOT_FOUND':
    case 'INVALID_USER':
      return new ApiException(
        400,
        API_ERROR_CODES.invalidToken,
        'That link is not valid. It may have already been used — ask for a new one.',
      )

    case 'EMAIL_ALREADY_VERIFIED':
      return new ApiException(
        409,
        API_ERROR_CODES.conflict,
        'That email address is already confirmed. Sign in.',
      )

    case 'PASSWORD_TOO_SHORT':
      return new ApiException(400, API_ERROR_CODES.validationFailed, 'Use at least 8 characters.', {
        newPassword: ['Use at least 8 characters.'],
      })

    case 'PASSWORD_TOO_LONG':
      return new ApiException(400, API_ERROR_CODES.validationFailed, 'That password is too long.', {
        newPassword: ['That password is too long.'],
      })

    case 'USER_ALREADY_EXISTS':
    case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL':
      return new ApiException(409, API_ERROR_CODES.emailTaken, 'That email already has an account.')

    default:
      // An unmapped code still gets its status honoured, so a 4xx does not
      // become a 500 — but the message is ours, because Better Auth's is written
      // for a developer reading a log.
      console.warn(`[auth] unmapped Better Auth failure (${err.statusCode} ${code ?? 'no code'})`)
      return new ApiException(
        err.statusCode >= 400 && err.statusCode < 500 ? 400 : 500,
        API_ERROR_CODES.internalError,
        fallback,
      )
  }
}

/* -------------------------------------------------------------------------- */
/* GET /api/auth/session                                                      */
/* -------------------------------------------------------------------------- */

/**
 * 200 with `null` when signed out, never 401.
 *
 * A logged-out visitor on the landing page is the ordinary state, not an error
 * condition, and modelling it as a thrown error means every consumer writes a
 * catch that swallows real failures too. `/me` is the one that refuses.
 */
authRoute.get('/session', async (c) => {
  const session = c.get('session')
  if (!session) return c.json<SessionResponse>(null)

  return c.json<SessionResponse>(await sessionPayload(session.userId))
})

/* -------------------------------------------------------------------------- */
/* GET /api/auth/me                                                           */
/* -------------------------------------------------------------------------- */

/**
 * `requireSession` is applied **here**, on the route, not by the chain in
 * `app.ts` — `/api/auth` is a public prefix, so nothing upstream refuses an
 * anonymous caller. Without this line the endpoint answers 200 with `null` to
 * anyone, and the client's "am I signed in" check silently always says yes.
 */
authRoute.get('/me', requireSession, async (c) => {
  const session = sessionOf(c)
  const payload = await sessionPayload(session.userId)

  if (!payload) {
    // The session resolved but the join did not: the profile has been deleted
    // out from under a live session. Refusing is the only safe reading.
    throw new ApiException(401, API_ERROR_CODES.unauthorized, 'Sign in to continue.')
  }

  return c.json<MeResponse>(payload)
})

/* -------------------------------------------------------------------------- */
/* POST /api/auth/register                                                    */
/* -------------------------------------------------------------------------- */

authRoute.post('/register', async (c) => {
  enforce(c, REGISTER_BY_ADDRESS, callerAddress(c), 'sign-ups from this connection')

  const body = await parseJsonBody(c, registerRequestSchema)

  // Before anything is written. The role on the body is a request, not a fact —
  // this is the line that decides whether it is granted.
  assertMayRegisterAs(body.role, body.inviteCode)

  const created = await createAccountWithProfile(body)

  /**
   * Outside the transaction, and after it. A mail relay being briefly down must
   * not roll back an account that was successfully created — the person can ask
   * for another link from the sign-in screen, whereas a rolled-back registration
   * leaves them retyping the form with no idea why.
   */
  try {
    await auth.api.sendVerificationEmail({ body: { email: created.email } })
  } catch (err) {
    console.error(`[auth] could not send the verification email for ${created.email}`, err)
  }

  const payload = await sessionPayload(created.userId)
  if (!payload) {
    // Unreachable: the transaction above wrote both rows. If it ever fires, the
    // write path is broken and a 500 is the honest answer.
    throw new Error(`registration for ${created.email} did not read back`)
  }

  return c.json<RegisterResponse>(
    {
      user: payload.user,
      profile: payload.profile,
      // Always true — `requireEmailVerification` is on, and `autoSignIn` is off,
      // so there is no cookie in this response and the client must not assume
      // one. Stated explicitly rather than inferred from a missing Set-Cookie.
      emailVerificationRequired: true,
    },
    201,
  )
})

/* -------------------------------------------------------------------------- */
/* POST /api/auth/login                                                       */
/* -------------------------------------------------------------------------- */

authRoute.post('/login', async (c) => {
  const body = await parseJsonBody(c, loginRequestSchema)

  /**
   * Two rules, because they stop different attacks. Per-account catches a
   * password list aimed at one student from many addresses; per-address catches
   * one machine spraying one password across the whole roster, which the
   * per-account counter would never see. Both are checked before the password is
   * ever verified, so a refused request costs no scrypt.
   */
  enforce(c, LOGIN_BY_ACCOUNT, body.email, 'sign-in attempts for that account')
  enforce(c, LOGIN_BY_ADDRESS, callerAddress(c), 'sign-in attempts from this connection')

  let headers: Headers
  let userId: string
  try {
    const result = await auth.api.signInEmail({
      body: {
        email: body.email,
        password: body.password,
        // Better Auth's flag is the inverse framing of ours: `rememberMe: false`
        // makes it a session cookie that dies with the browser. Lab machines are
        // shared, so the default in `loginRequestSchema` is false.
        rememberMe: body.rememberMe,
      },
      returnHeaders: true,
    })
    headers = result.headers
    userId = result.response.user.id
  } catch (err) {
    throw translateAuthError(err, 'We could not sign you in. Try again in a moment.')
  }

  const payload = await sessionPayload(userId)
  if (!payload) {
    // Credentials were right but there is no profile. That is the half-created
    // account state; refusing is safer than handing back a shell the whole app
    // would then 401 on.
    console.error(`[auth] user ${userId} signed in but has no profile row`)
    throw new ApiException(
      500,
      API_ERROR_CODES.internalError,
      'Your account is not set up correctly. Contact your instructor.',
    )
  }

  forwardCookies(c, headers)
  return c.json<LoginResponse>(payload)
})

/* -------------------------------------------------------------------------- */
/* POST /api/auth/logout                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Always succeeds. Signing out of a session that has already expired is not a
 * failure the person can do anything about, and an error here would leave the
 * client holding state it was trying to drop.
 */
authRoute.post('/logout', async (c) => {
  try {
    const result = await auth.api.signOut({
      headers: c.req.raw.headers,
      returnHeaders: true,
    })
    // The clearing `Set-Cookie` — max-age 0 — is the whole point of this call.
    forwardCookies(c, result.headers)
  } catch (err) {
    console.warn('[auth] sign-out did not complete cleanly', err)
  }

  return c.json<LogoutResponse>({ ok: true })
})

/* -------------------------------------------------------------------------- */
/* POST /api/auth/forgot-password                                             */
/* -------------------------------------------------------------------------- */

/**
 * Always `{ ok: true }`, whether or not the address is registered.
 *
 * The screen copy has to match — "if that address is registered, we have sent a
 * link" — or the endpoint's silence is undone by the sentence next to it.
 */
authRoute.post('/forgot-password', async (c) => {
  const body = await parseJsonBody(c, forgotPasswordRequestSchema)

  enforce(c, EMAIL_SEND_BY_ACCOUNT, body.email, 'reset requests for that address')
  enforce(c, EMAIL_SEND_BY_ADDRESS, callerAddress(c), 'reset requests from this connection')

  try {
    await auth.api.requestPasswordReset({ body: { email: body.email } })
  } catch (err) {
    // Swallowed on purpose. Better Auth already answers identically for a known
    // and an unknown address; surfacing a failure here would reintroduce the
    // difference this endpoint exists to remove.
    console.error(`[auth] password reset request for ${body.email} failed`, err)
  }

  return c.json<ForgotPasswordResponse>({ ok: true })
})

/* -------------------------------------------------------------------------- */
/* POST /api/auth/reset-password                                              */
/* -------------------------------------------------------------------------- */

authRoute.post('/reset-password', async (c) => {
  enforce(c, TOKEN_REDEEM_BY_ADDRESS, callerAddress(c), 'attempts from this connection')

  const body = await parseJsonBody(c, resetPasswordRequestSchema)

  /**
   * Read the token's row *before* redeeming it, purely to tell two failures
   * apart afterwards.
   *
   * Better Auth consumes the row with a delete and returns the same
   * `INVALID_TOKEN` for expired, forged and already-used — but `/reset-password`
   * has to distinguish them: an expired link gets a "send me another" button, a
   * forged one does not. Reading first is the only moment the difference is
   * still visible.
   *
   * If the lookup finds nothing this does not refuse; the redeem below is still
   * attempted, so a future change to how the identifier is stored degrades to
   * "always says invalid" rather than "never lets anyone reset".
   */
  const expired = await resetTokenIsExpired(body.token)

  try {
    await auth.api.resetPassword({
      body: { token: body.token, newPassword: body.password },
    })
  } catch (err) {
    if (expired && isAuthApiError(err) && err.body?.code === 'INVALID_TOKEN') {
      throw new ApiException(
        410,
        API_ERROR_CODES.expiredToken,
        'That reset link has expired. Ask for a new one and it will arrive in a moment.',
      )
    }
    throw translateAuthError(err, 'We could not reset your password. Ask for a new link.')
  }

  return c.json<ResetPasswordResponse>({ ok: true })
})

/**
 * True when a reset token's row exists and its expiry has passed. False for a
 * token that is live, already consumed, or never existed — the three cases that
 * are all honestly `invalid_token`.
 */
async function resetTokenIsExpired(token: string): Promise<boolean> {
  const [row] = await db
    .select({ expiresAt: verification.expiresAt })
    .from(verification)
    .where(eq(verification.identifier, `reset-password:${token}`))
    .limit(1)

  return row !== undefined && row.expiresAt.getTime() <= Date.now()
}

/* -------------------------------------------------------------------------- */
/* POST /api/auth/verify-email                                                */
/* -------------------------------------------------------------------------- */

authRoute.post('/verify-email', async (c) => {
  enforce(c, TOKEN_REDEEM_BY_ADDRESS, callerAddress(c), 'attempts from this connection')

  const body = await parseJsonBody(c, verifyEmailRequestSchema)

  /**
   * Verified first, claimed second. The order matters in both directions.
   *
   * A verification token is a stateless JWT — Better Auth stores nothing and
   * therefore consumes nothing, so without a claim the same link keeps returning
   * success until it expires (see `api/auth/single-use.ts`). But claiming
   * *before* verifying would mean a forged token gets a tombstone of its own, so
   * the second attempt at a link that was never valid reports "already used"
   * instead of "not valid" — which is exactly the distinction this endpoint
   * exists to make, inverted.
   */
  try {
    await auth.api.verifyEmail({ query: { token: body.token } })
  } catch (err) {
    throw translateAuthError(err, 'We could not confirm that link. Ask for a new one.')
  }

  const claim = await claimToken(body.token, new Date(Date.now() + VERIFICATION_TOKEN_TTL_SECONDS * 1000))
  if (!claim.claimed) {
    // The token is genuine and still in date — it has simply been spent. The
    // address is confirmed either way, so this is a conflict rather than a
    // failure, and the copy says so.
    throw new ApiException(
      409,
      API_ERROR_CODES.conflict,
      'That link has already been used. Your email is confirmed — sign in.',
    )
  }

  // Housekeeping, never a reason to fail: there is no scheduler on a serverless
  // deployment, so the redeem path is the only place this can happen.
  void sweepExpiredRedemptions()

  return c.json<VerifyEmailResponse>({ ok: true })
})

/* -------------------------------------------------------------------------- */
/* POST /api/auth/resend-verification                                         */
/* -------------------------------------------------------------------------- */

/**
 * The "we can send you another link" button on the sign-in and expired-link
 * screens.
 *
 * Rate-limited harder than sign-in, because the cost of getting this wrong lands
 * in somebody else's inbox rather than in the caller's own time. Like
 * `/forgot-password`, it answers the same way for every address.
 */
authRoute.post('/resend-verification', async (c) => {
  const body = await parseJsonBody(c, resendVerificationRequestSchema)

  enforce(c, EMAIL_SEND_BY_ACCOUNT, body.email, 'requests for that address')
  enforce(c, EMAIL_SEND_BY_ADDRESS, callerAddress(c), 'requests from this connection')

  try {
    await auth.api.sendVerificationEmail({ body: { email: body.email } })
  } catch (err) {
    // Better Auth refuses with EMAIL_ALREADY_VERIFIED for an address that is
    // already confirmed. Surfacing that would answer "does this address have an
    // unverified account here", which is the question this endpoint declines.
    console.warn(`[auth] resend of the verification email for ${body.email} did not send`, err)
  }

  return c.json<ResendVerificationResponse>({ ok: true })
})

/* -------------------------------------------------------------------------- */
/* POST /api/auth/change-password                                             */
/* -------------------------------------------------------------------------- */

/**
 * `/settings`. `requireSession` again applied on the route — see the note at the
 * top of this file about `/api/auth` being a public prefix.
 *
 * The current password is required even though the caller is already signed in.
 * A shared lab machine with a live session is the ordinary case here, and
 * without this an unattended browser is a password change away from being a
 * stolen account.
 */
authRoute.post('/change-password', requireSession, async (c) => {
  const session = sessionOf(c)
  const body = await parseJsonBody(c, changePasswordRequestSchema)

  enforce(c, LOGIN_BY_ACCOUNT, session.userId, 'password attempts for this account')

  let headers: Headers
  try {
    const result = await auth.api.changePassword({
      body: {
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
        /**
         * Every other browser is signed out. If the old password had leaked,
         * changing it while leaving the leaker's session alive achieves nothing;
         * the caller's own session is preserved by the fresh cookie below.
         */
        revokeOtherSessions: true,
      },
      headers: c.req.raw.headers,
      returnHeaders: true,
    })
    headers = result.headers
  } catch (err) {
    if (isAuthApiError(err) && err.body?.code === 'INVALID_PASSWORD') {
      throw new ApiException(400, API_ERROR_CODES.invalidCredentials, 'That is not your current password.', {
        currentPassword: ['That is not your current password.'],
      })
    }
    throw translateAuthError(err, 'We could not change your password. Try again in a moment.')
  }

  forwardCookies(c, headers)
  return c.json<ChangePasswordResponse>({ ok: true })
})

/**
 * Re-exported so a test can install the real provider after the harness has
 * swapped in its own. Importing this module is what installs it, but a test file
 * that also imports the Phase 2 harness gets the harness's provider instead —
 * module evaluation order decides, and depending on it would be fragile.
 */
export function installBetterAuthSessionProvider(): void {
  setSessionProvider(async (c) => {
    const found = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!found) return null
    return loadSessionForUser(found.user.id)
  })
}

/** Exposed for the reset-link copy, which has to name the same window. */
export { RESET_TOKEN_TTL_SECONDS }
