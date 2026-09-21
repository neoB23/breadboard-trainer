import { eq } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  call,
  CookieJar,
  db,
  expireResetToken,
  lastMessageTo,
  linkFrom,
  resetRateLimits,
  seedOnce,
  SEED_EMAIL,
  SEED_PASSWORD,
  signIn,
  tokenFrom,
  user,
} from '../helpers/auth-harness.ts'

/**
 * The Phase 3 DoD's first box, driven all the way through:
 *
 *   register -> confirm email -> login -> refresh page -> still logged in -> logout
 *
 * Every request goes through the real middleware chain against a real Postgres,
 * carrying a real cookie that Better Auth issued. Nothing here is stubbed except
 * the SMTP hop — and the token in that email is the same token the production
 * transport would have delivered.
 */

beforeAll(async () => {
  await seedOnce()
})

beforeEach(() => {
  // Every test in this file signs in several times; the limiter would otherwise
  // carry counts across tests and the failures would look like auth bugs.
  resetRateLimits()
})

/* -------------------------------------------------------------------------- */
/* The journey                                                                */
/* -------------------------------------------------------------------------- */

describe('the full first-run journey', () => {
  const account = {
    fullName: 'Rowena Bautista',
    email: 'rowena@students.example.edu',
    password: 'correct-horse-battery',
    role: 'student' as const,
    studentNumber: '2022-01234',
  }

  it('registers without issuing a session', async () => {
    const reply = await call('/api/auth/register', { method: 'POST', body: account })

    expect(reply.status).toBe(201)
    const body = reply.body as { profile: { onboardedAt: null }; emailVerificationRequired: boolean }
    expect(body.emailVerificationRequired).toBe(true)
    // Phase 4 gates the onboarding wizard on exactly this being null.
    expect(body.profile.onboardedAt).toBeNull()

    // No cookie, because the address is not confirmed yet — a session here would
    // make the "check your email" screen a lie.
    expect(reply.setCookies).toHaveLength(0)
  })

  it('created the auth user and the profile together', async () => {
    const [row] = await db
      .select({ id: user.id, verified: user.emailVerified })
      .from(user)
      .where(eq(user.email, account.email))
      .limit(1)

    expect(row).toBeDefined()
    expect(row?.verified).toBe(false)

    // The profile is the half Better Auth knows nothing about. Its presence is
    // what "in the same transaction" buys.
    const me = await call('/api/auth/register', { method: 'POST', body: account })
    expect(me.status).toBe(409)
  })

  it('refuses sign-in until the address is confirmed', async () => {
    const reply = await call('/api/auth/login', {
      method: 'POST',
      body: { email: account.email, password: account.password },
    })

    expect(reply.status).toBe(403)
    expect((reply.body as { error: { code: string } }).error.code).toBe('email_not_verified')
    expect(reply.setCookies).toHaveLength(0)
  })

  it('emailed a verification link that points at the app, not the API', async () => {
    const message = lastMessageTo(account.email)
    expect(message).toBeDefined()

    const link = linkFrom(message?.text ?? '')
    // The screen at the other end has to be able to render three outcomes.
    // /api/auth/verify-email can only render JSON.
    expect(new URL(link).pathname).toBe('/verify-email')
    expect(new URL(link).searchParams.get('token')).toBeTruthy()
  })

  it('confirms the address when the link is redeemed', async () => {
    const message = lastMessageTo(account.email)
    const reply = await call('/api/auth/verify-email', {
      method: 'POST',
      body: { token: tokenFrom(message?.text ?? '') },
    })

    expect(reply.status).toBe(200)
    expect(reply.body).toEqual({ ok: true })
  })

  it('refuses the same link a second time', async () => {
    const message = lastMessageTo(account.email)
    const reply = await call('/api/auth/verify-email', {
      method: 'POST',
      body: { token: tokenFrom(message?.text ?? '') },
    })

    // The token is a stateless JWT and is still cryptographically valid; the
    // tombstone in api/auth/single-use.ts is what makes the link single-use.
    expect(reply.status).toBe(409)
  })

  it('keeps calling a forged link invalid, however many times it is tried', async () => {
    /**
     * The regression this guards is an ordering bug, and it only shows on the
     * *second* attempt: with the single-use claim taken before the token is
     * verified, a forged link gets a tombstone of its own on the first try and
     * then reports "already used" on the next — which is the one distinction
     * this endpoint exists to make, inverted.
     */
    const forged = 'eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImV2aWxAZXhhbXBsZS5jb20ifQ.not-a-real-signature'

    for (const attempt of [1, 2, 3]) {
      const reply = await call('/api/auth/verify-email', { method: 'POST', body: { token: forged } })
      expect(reply.status, `attempt ${attempt}`).toBe(400)
      expect((reply.body as { error: { code: string } }).error.code).toBe('invalid_token')
    }
  })

  it('signs in, survives a page refresh, and signs out', async () => {
    const jar = new CookieJar()

    const login = await call('/api/auth/login', {
      method: 'POST',
      body: { email: account.email, password: account.password },
      jar,
    })
    expect(login.status).toBe(200)

    // "Refresh the page" is exactly this: a fresh request carrying only the
    // cookie, with nothing held in memory from the sign-in.
    const me = await call('/api/auth/me', { jar })
    expect(me.status).toBe(200)
    expect((me.body as { user: { email: string } }).user.email).toBe(account.email)

    const out = await call('/api/auth/logout', { method: 'POST', jar })
    expect(out.status).toBe(200)

    const after = await call('/api/auth/me', { jar })
    expect(after.status).toBe(401)
  })
})

/* -------------------------------------------------------------------------- */
/* No token ever leaves in a body                                             */
/* -------------------------------------------------------------------------- */

describe('the session token', () => {
  it('appears in no response body on any auth endpoint', async () => {
    const jar = new CookieJar()

    const replies = [
      await call('/api/auth/login', {
        method: 'POST',
        body: { email: SEED_EMAIL.cruz, password: SEED_PASSWORD },
        jar,
      }),
      await call('/api/auth/me', { jar }),
      await call('/api/auth/session', { jar }),
      await call('/api/auth/logout', { method: 'POST', jar }),
    ]

    // Better Auth returns `{ token: session.token }` from its own sign-in
    // handler. This is the assertion that our handlers never forward it — the
    // reason `api/routes/auth.ts` builds its own response instead of proxying.
    for (const reply of replies) {
      const serialised = JSON.stringify(reply.body)
      expect(serialised).not.toMatch(/"token"/)
      expect(serialised).not.toMatch(/session_token/)
    }
  })
})

/* -------------------------------------------------------------------------- */
/* Password reset                                                             */
/* -------------------------------------------------------------------------- */

describe('password reset', () => {
  const email = SEED_EMAIL.santos

  async function requestReset(): Promise<string> {
    const reply = await call('/api/auth/forgot-password', { method: 'POST', body: { email } })
    expect(reply.status).toBe(200)

    const message = lastMessageTo(email)
    expect(message).toBeDefined()
    return tokenFrom(message?.text ?? '')
  }

  it('answers identically for a registered and an unknown address', async () => {
    const known = await call('/api/auth/forgot-password', { method: 'POST', body: { email } })
    resetRateLimits()
    const unknown = await call('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: 'nobody@nowhere.example.edu' },
    })

    // An endpoint that answered differently would be an account-existence
    // oracle, and the screen copy is written to match this silence.
    expect(known.status).toBe(unknown.status)
    expect(known.body).toEqual(unknown.body)
  })

  it('sets a new password and revokes the old one', async () => {
    const token = await requestReset()
    const next = 'a-brand-new-password'

    const reset = await call('/api/auth/reset-password', {
      method: 'POST',
      body: { token, password: next },
    })
    expect(reset.status).toBe(200)

    resetRateLimits()
    const withNew = await call('/api/auth/login', { method: 'POST', body: { email, password: next } })
    expect(withNew.status).toBe(200)

    const withOld = await call('/api/auth/login', {
      method: 'POST',
      body: { email, password: SEED_PASSWORD },
    })
    expect(withOld.status).toBe(401)
  })

  it('refuses a reset token that has already been spent', async () => {
    const token = await requestReset()

    const first = await call('/api/auth/reset-password', {
      method: 'POST',
      body: { token, password: 'first-password-choice' },
    })
    expect(first.status).toBe(200)

    const second = await call('/api/auth/reset-password', {
      method: 'POST',
      body: { token, password: 'second-password-choice' },
    })
    expect(second.status).toBe(400)
    expect((second.body as { error: { code: string } }).error.code).toBe('invalid_token')
  })

  it('tells an expired link apart from a forged one', async () => {
    const token = await requestReset()
    // Moves the row's own expires_at — the same column the production path
    // reads. Nothing is stubbed and no test sleeps for an hour.
    await expireResetToken(token)

    const expired = await call('/api/auth/reset-password', {
      method: 'POST',
      body: { token, password: 'does-not-matter-here' },
    })
    expect(expired.status).toBe(410)
    expect((expired.body as { error: { code: string } }).error.code).toBe('expired_token')

    const forged = await call('/api/auth/reset-password', {
      method: 'POST',
      body: { token: 'this-token-never-existed', password: 'does-not-matter-here' },
    })
    expect(forged.status).toBe(400)
    expect((forged.body as { error: { code: string } }).error.code).toBe('invalid_token')

    // The distinction is the point: one of these screens offers a resend button
    // and the other does not.
    expect(expired.status).not.toBe(forged.status)
  })
})

/* -------------------------------------------------------------------------- */
/* Changing a password while signed in                                        */
/* -------------------------------------------------------------------------- */

describe('changing a password from /settings', () => {
  it('requires the current one, and keeps the caller signed in', async () => {
    const email = SEED_EMAIL.dizon
    const jar = await signIn(email)

    const wrong = await call('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword: 'not-my-password', newPassword: 'a-perfectly-fine-one' },
      jar,
    })
    expect(wrong.status).toBe(400)
    expect((wrong.body as { error: { code: string } }).error.code).toBe('invalid_credentials')

    const right = await call('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword: SEED_PASSWORD, newPassword: 'a-perfectly-fine-one' },
      jar,
    })
    expect(right.status).toBe(200)

    // The caller's own session survives — every other one is revoked.
    const me = await call('/api/auth/me', { jar })
    expect(me.status).toBe(200)
  })
})

/* -------------------------------------------------------------------------- */
/* Blank optional fields                                                      */
/* -------------------------------------------------------------------------- */

describe('an optional field left blank', () => {
  /**
   * The regression: `studentNumberSchema.optional()` rejects `""`, and a React
   * Hook Form field that is not rendered still submits one. On `/register` that
   * produced a form which silently did nothing when the button was pressed —
   * validation failed on a field that was not on screen, so the error had
   * nowhere to appear.
   *
   * Caught by the Playwright suite; asserted here because a contract bug should
   * fail in the fast tests too.
   */
  it('is accepted as absent rather than refused', async () => {
    const reply = await call('/api/auth/register', {
      method: 'POST',
      body: {
        fullName: 'Corazon Ilagan',
        email: 'corazon@students.example.edu',
        password: 'a-perfectly-ordinary-password',
        role: 'student',
        studentNumber: '2026-04321',
        // Both blank, as an untouched input submits them.
        section: '',
        inviteCode: '',
      },
    })

    expect(reply.status).toBe(201)
    expect((reply.body as { profile: { section: string | null } }).profile.section).toBeNull()
  })

  it('does not let a blank invite code count as presenting one', async () => {
    process.env['INSTRUCTOR_INVITE_CODE'] = 'the-real-code-2026'

    const reply = await call('/api/auth/register', {
      method: 'POST',
      body: {
        fullName: 'Hopeful Faculty',
        email: 'hopeful@faculty.example.edu',
        password: 'a-perfectly-ordinary-password',
        role: 'instructor',
        inviteCode: '',
      },
    })

    // 400 from the contract — an instructor must supply one — and emphatically
    // not a 201 because the empty string was mistaken for a code.
    expect(reply.status).toBe(400)
  })
})
