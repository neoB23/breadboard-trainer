import { eq } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { sessionCookie, sessionCookieForOrigin } from '../../api/auth/auth.ts'
import { profiles } from '../../api/db/schema.ts'
import {
  call,
  CookieJar,
  db,
  resetRateLimits,
  seedOnce,
  SEED_EMAIL,
  SEED_PASSWORD,
  signIn,
} from '../helpers/auth-harness.ts'

/**
 * The security boundary, proved by request rather than by reading the code.
 *
 * Three claims are load-bearing for the whole system and each one is checked
 * here against a live cookie:
 *
 *   1. `/api/auth` is a public prefix, so default-deny does **not** cover it.
 *      The endpoints inside it that need a session apply `requireSession`
 *      themselves — and if one ever stops doing so, it answers 200 to anonymous.
 *   2. `/api/teach/*` is 403 for a student and 401 for nobody.
 *   3. Self-registration cannot produce an instructor.
 */

beforeAll(async () => {
  await seedOnce()
})

beforeEach(() => {
  resetRateLimits()
})

/* -------------------------------------------------------------------------- */
/* The public prefix, and the holes it would otherwise leave                  */
/* -------------------------------------------------------------------------- */

describe('endpoints inside the public /api/auth prefix', () => {
  /**
   * The specific regression this guards. `api/app.ts` skips `requireSession` for
   * anything under `/api/auth`, so these two are protected only by the
   * `requireSession` written on their own routes. Deleting that middleware from
   * either one leaves a clean build, a green type check, and an endpoint that
   * hands a profile to an anonymous caller.
   */
  const MUST_REFUSE_ANONYMOUS: readonly { method: string; path: string; body?: unknown }[] = [
    { method: 'GET', path: '/api/auth/me' },
    {
      method: 'POST',
      path: '/api/auth/change-password',
      body: { currentPassword: 'whatever-it-is', newPassword: 'whatever-comes-next' },
    },
  ]

  for (const route of MUST_REFUSE_ANONYMOUS) {
    it(`${route.method} ${route.path} -> 401 with no cookie`, async () => {
      const reply = await call(route.path, {
        method: route.method,
        ...(route.body !== undefined && { body: route.body }),
      })

      expect(reply.status).toBe(401)
      expect(JSON.stringify(reply.body)).not.toMatch(/"email"/)
    })
  }

  it('GET /api/auth/session answers 200 with null instead, which is not the same thing', async () => {
    const reply = await call('/api/auth/session')

    // Deliberately different from /me: a logged-out visitor on the landing page
    // is an ordinary state, not an error. The distinction only holds if /me
    // genuinely refuses, which the two cases above assert.
    expect(reply.status).toBe(200)
    expect(reply.body).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/* Default-deny still covers everything else                                  */
/* -------------------------------------------------------------------------- */

describe('a request with no cookie at all', () => {
  const PROTECTED = [
    '/api/exercises',
    '/api/classes',
    '/api/attempts',
    '/api/profile',
    '/api/teach',
    '/api/teach/exercises',
    '/api/teach/classes',
  ] as const

  for (const path of PROTECTED) {
    it(`GET ${path} -> 401`, async () => {
      const reply = await call(path)
      expect(reply.status).toBe(401)
    })
  }
})

/* -------------------------------------------------------------------------- */
/* Role                                                                       */
/* -------------------------------------------------------------------------- */

describe('a real student session', () => {
  it('is 403 on /api/teach/* and 401 without the cookie', async () => {
    const jar = await signIn(SEED_EMAIL.cruz)

    const asStudent = await call('/api/teach/exercises', { jar })
    expect(asStudent.status).toBe(403)
    expect((asStudent.body as { error: { code: string } }).error.code).toBe('forbidden')

    const anonymous = await call('/api/teach/exercises')
    expect(anonymous.status).toBe(401)

    // 403 and 401 are different answers on purpose: one says "not you", the
    // other says "nobody". Collapsing them would make a legitimate instructor's
    // expired session look like a permissions problem.
    expect(asStudent.status).not.toBe(anonymous.status)
  })

  it('reaches /api/teach/* once the same journey is taken as an instructor', async () => {
    const jar = await signIn(SEED_EMAIL.instructor)
    const reply = await call('/api/teach/exercises', { jar })

    // The counterpart to the case above — without this, a guard that refused
    // everybody would pass the 403 test.
    expect(reply.status).toBe(200)
  })
})

/* -------------------------------------------------------------------------- */
/* The instructor gate                                                        */
/* -------------------------------------------------------------------------- */

describe('self-registration as an instructor', () => {
  const base = {
    fullName: 'Mallory Faculty',
    password: 'let-me-read-the-answers',
    role: 'instructor' as const,
  }

  it('is refused with no invite code', async () => {
    // Caught by the contract before it reaches the gate — but the gate is what
    // the next two cases prove, and this one proves a client cannot simply omit
    // the field.
    const reply = await call('/api/auth/register', {
      method: 'POST',
      body: { ...base, email: 'mallory-a@students.example.edu' },
    })

    expect(reply.status).toBe(400)
    await expectNoProfile('mallory-a@students.example.edu')
  })

  it('is refused with a wrong invite code', async () => {
    process.env['INSTRUCTOR_INVITE_CODE'] = 'the-real-code-2026'

    const reply = await call('/api/auth/register', {
      method: 'POST',
      body: { ...base, email: 'mallory-b@students.example.edu', inviteCode: 'not-the-real-code' },
    })

    expect(reply.status).toBe(403)
    expect((reply.body as { error: { code: string } }).error.code).toBe('invalid_invite_code')
    await expectNoProfile('mallory-b@students.example.edu')
  })

  it('is refused when no invite code is configured at all', async () => {
    // Fails closed. The usual default — "no secret configured, skip the check" —
    // would mean an unconfigured deployment issues faculty accounts to anyone.
    delete process.env['INSTRUCTOR_INVITE_CODE']

    const reply = await call('/api/auth/register', {
      method: 'POST',
      body: { ...base, email: 'mallory-c@students.example.edu', inviteCode: 'any-code-at-all' },
    })

    expect(reply.status).toBe(403)
    await expectNoProfile('mallory-c@students.example.edu')
  })

  it('cannot be reached by sending role on a student registration', async () => {
    process.env['INSTRUCTOR_INVITE_CODE'] = 'the-real-code-2026'

    // The attack the gate exists to stop, in its laziest form: register as a
    // student and hope something downstream trusts a field on the body.
    const reply = await call('/api/auth/register', {
      method: 'POST',
      body: {
        fullName: 'Sneaky Student',
        email: 'sneaky@students.example.edu',
        password: 'just-a-normal-password',
        role: 'student',
        studentNumber: '2022-09999',
        inviteCode: 'the-real-code-2026',
      },
    })

    expect(reply.status).toBe(201)
    expect((reply.body as { profile: { role: string } }).profile.role).toBe('student')
  })

  it('succeeds with the configured code, and only then', async () => {
    process.env['INSTRUCTOR_INVITE_CODE'] = 'the-real-code-2026'

    const reply = await call('/api/auth/register', {
      method: 'POST',
      body: { ...base, email: 'genuine@faculty.example.edu', inviteCode: 'the-real-code-2026' },
    })

    // Without this the three refusals above would also pass against a gate that
    // refuses everybody, which would be a different bug.
    expect(reply.status).toBe(201)
    expect((reply.body as { profile: { role: string } }).profile.role).toBe('instructor')
  })
})

async function expectNoProfile(email: string): Promise<void> {
  const { user } = await import('../../api/db/schema.ts')
  const rows = await db
    .select({ id: profiles.id, role: profiles.role })
    .from(profiles)
    .innerJoin(user, eq(user.id, profiles.id))
    .where(eq(user.email, email))

  // A refused registration must leave nothing behind — not a user, not a
  // profile, and certainly not an instructor one.
  expect(rows).toHaveLength(0)
}

/* -------------------------------------------------------------------------- */
/* The cookie                                                                 */
/* -------------------------------------------------------------------------- */

describe('the session cookie', () => {
  it('is httpOnly and SameSite=Lax on the wire', async () => {
    const jar = new CookieJar()
    const reply = await call('/api/auth/login', {
      method: 'POST',
      body: { email: SEED_EMAIL.cruz, password: SEED_PASSWORD },
      jar,
    })

    const header = reply.setCookies.find((cookie) => cookie.startsWith(`${sessionCookie.name}=`))
    expect(header).toBeDefined()
    expect(header).toMatch(/;\s*HttpOnly/i)
    expect(header).toMatch(/;\s*SameSite=Lax/i)
    expect(header).toMatch(/;\s*Path=\//i)
  })

  it('gains Secure and the __Secure- prefix on an https origin', async () => {
    /**
     * The DoD box says the cookie is "httpOnly and Secure". Secure is derived
     * from the protocol of `baseURL`, and this machine has no TLS — so rather
     * than assert on a header that cannot be produced here, this recomputes the
     * cookie through Better Auth's own `getCookies()` for an https origin.
     *
     * That is the same function the running instance used, so a configuration
     * change that dropped Secure in production would fail here.
     */
    const secure = sessionCookieForOrigin('https://trainer.example.edu')

    expect(secure.attributes.secure).toBe(true)
    expect(secure.attributes.httpOnly).toBe(true)
    expect(secure.attributes.sameSite).toBe('lax')
    expect(secure.name.startsWith('__Secure-')).toBe(true)

    // And plain http does not, which is what lets curl and the dev server work.
    const insecure = sessionCookieForOrigin('http://localhost:5173')
    expect(insecure.attributes.secure).toBe(false)
    expect(insecure.attributes.httpOnly).toBe(true)
  })

  it('is cleared by logout rather than merely forgotten by the client', async () => {
    const jar = await signIn(SEED_EMAIL.cruz)
    const out = await call('/api/auth/logout', { method: 'POST', jar })

    const cleared = out.setCookies.find((cookie) => cookie.startsWith(`${sessionCookie.name}=`))
    expect(cleared).toBeDefined()
    expect(cleared).toMatch(/Max-Age=0/i)
    expect(jar.has(sessionCookie.name)).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/* Rate limiting                                                              */
/* -------------------------------------------------------------------------- */

describe('the rate limiter', () => {
  it('refuses sign-in after the window fills, and says how long to wait', async () => {
    const email = 'ratelimit-probe@students.example.edu'
    const statuses: number[] = []

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const reply = await call('/api/auth/login', {
        method: 'POST',
        body: { email, password: 'wrong-password-here' },
      })
      statuses.push(reply.status)
    }

    // Not "some request eventually 429s" — the first ten are the configured
    // limit and the eleventh is the refusal.
    expect(statuses.slice(0, 10).every((status) => status === 401)).toBe(true)
    expect(statuses[10]).toBe(429)

    const refused = await call('/api/auth/login', {
      method: 'POST',
      body: { email, password: 'wrong-password-here' },
    })
    expect(refused.status).toBe(429)
    expect(refused.headers.get('retry-after')).toBeTruthy()
    expect((refused.body as { error: { message: string } }).error.message).toMatch(/try again in/i)
  })

  it('refuses reset requests far sooner, because they cost someone else an inbox', async () => {
    resetRateLimits()
    const email = SEED_EMAIL.cruz
    const statuses: number[] = []

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const reply = await call('/api/auth/forgot-password', { method: 'POST', body: { email } })
      statuses.push(reply.status)
    }

    expect(statuses.slice(0, 3).every((status) => status === 200)).toBe(true)
    expect(statuses[3]).toBe(429)
  })
})
