import { eq } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { JOIN_CODE_LENGTH } from '../../shared/contracts/index.ts'
import {
  call,
  db,
  profiles,
  registerAndVerify,
  resetRateLimits,
  SEED,
  seedOnce,
  SEED_EMAIL,
  signIn,
  type CookieJar,
} from '../helpers/auth-harness.ts'

/**
 * Phase 4's DoD, at the API level:
 *
 *   - a new user is forced through onboarding exactly once
 *   - joining a class with a valid code creates the enrollment row
 *   - an invalid code shows a helpful error and does not clear the field
 *   - accessibility preferences persist to `profiles` and apply on load
 *
 * The "does not clear the field" half is a screen concern, but it is only
 * achievable if the API distinguishes the failures well enough to render beside
 * the input — so what is checked here is that each failure has its own code.
 */

beforeAll(async () => {
  await seedOnce()
})

beforeEach(() => {
  resetRateLimits()
})

/* -------------------------------------------------------------------------- */
/* Forced exactly once                                                        */
/* -------------------------------------------------------------------------- */

describe('onboarding', () => {
  let jar: CookieJar
  let userId: string

  beforeAll(async () => {
    const account = await registerAndVerify({
      fullName: 'Teodoro Villar',
      email: 'teodoro@students.example.edu',
      password: 'a-decent-length-password',
      studentNumber: '2023-00555',
    })
    jar = account.jar
    userId = account.userId
  })

  it('starts with onboardedAt null, which is what the redirect keys on', async () => {
    const me = await call('/api/auth/me', { jar })
    expect(me.status).toBe(200)
    expect((me.body as { profile: { onboardedAt: string | null } }).profile.onboardedAt).toBeNull()
  })

  it('stamps onboardedAt when the wizard finishes', async () => {
    const reply = await call('/api/profile/onboarding', {
      method: 'POST',
      body: { fullName: 'Teodoro Villar Jr.', studentNumber: '2023-00555', section: 'ECE-3B' },
      jar,
    })

    expect(reply.status).toBe(200)
    const profile = (reply.body as { profile: { onboardedAt: string | null; fullName: string } }).profile
    expect(profile.onboardedAt).not.toBeNull()
    expect(profile.fullName).toBe('Teodoro Villar Jr.')
  })

  it('is then never forced again — the flag stays set across a fresh session', async () => {
    // "Exactly once" is a property of the stored flag, not of a client-side
    // state machine, so the check is a new sign-in with a new cookie.
    const fresh = await signIn('teodoro@students.example.edu', 'a-decent-length-password')
    const me = await call('/api/auth/me', { jar: fresh })

    expect((me.body as { profile: { onboardedAt: string | null } }).profile.onboardedAt).not.toBeNull()
  })

  it('refuses to let a student finish without a student number', async () => {
    const other = await registerAndVerify({
      fullName: 'Ligaya Mendoza',
      email: 'ligaya@students.example.edu',
      password: 'another-fine-password',
      studentNumber: '2023-00777',
    })

    const reply = await call('/api/profile/onboarding', {
      method: 'POST',
      body: { fullName: 'Ligaya Mendoza' },
      jar: other.jar,
    })

    // The role comes from the session, never from the payload — there is no
    // `role` field in `onboardingRequestSchema`, so this rule can only live on
    // the server.
    expect(reply.status).toBe(400)
    expect((reply.body as { error: { details?: Record<string, string[]> } }).error.details).toHaveProperty(
      'studentNumber',
    )

    const [row] = await db
      .select({ onboardedAt: profiles.onboardedAt })
      .from(profiles)
      .where(eq(profiles.id, other.userId))
      .limit(1)
    expect(row?.onboardedAt).toBeNull()
  })

  it('does not let the wizard write a role', async () => {
    const reply = await call('/api/profile/onboarding', {
      method: 'POST',
      body: { fullName: 'Teodoro Villar Jr.', studentNumber: '2023-00555', role: 'instructor' },
      jar,
    })

    // Zod strips the unknown key rather than honouring it. Asserted because the
    // failure mode — a student promoting themselves through the one endpoint
    // every new account is forced through — is the worst one in the system.
    expect(reply.status).toBe(200)

    const [row] = await db
      .select({ role: profiles.role })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1)
    expect(row?.role).toBe('student')
  })
})

/* -------------------------------------------------------------------------- */
/* Joining a class                                                            */
/* -------------------------------------------------------------------------- */

describe('joining a class by code', () => {
  let jar: CookieJar

  beforeAll(async () => {
    const account = await registerAndVerify({
      fullName: 'Bayani Ocampo',
      email: 'bayani@students.example.edu',
      password: 'yet-another-password',
      studentNumber: '2023-00888',
    })
    jar = account.jar
  })

  it('accepts the seeded code and creates the enrollment', async () => {
    const reply = await call('/api/classes/join', { method: 'POST', body: { code: SEED.joinCode }, jar })

    expect(reply.status).toBe(201)
    expect((reply.body as { class: { id: string } }).class.id).toBe(SEED.classId)

    const listed = await call('/api/classes', { jar })
    expect((listed.body as { items: { id: string }[] }).items.map((item) => item.id)).toContain(SEED.classId)
  })

  it('normalises what a student actually types', async () => {
    // A code read off a whiteboard and pasted from a phone arrives lower-cased
    // and padded. `joinCodeInputSchema` trims and upper-cases before validating,
    // so this must be the already-enrolled conflict rather than a format error.
    const reply = await call('/api/classes/join', {
      method: 'POST',
      body: { code: `  ${SEED.joinCode.toLowerCase()}  ` },
      jar,
    })

    expect(reply.status).toBe(409)
    expect((reply.body as { error: { code: string } }).error.code).toBe('already_enrolled')
  })

  it('gives each failure its own code, so the screen can keep the field populated', async () => {
    const notFound = await call('/api/classes/join', { method: 'POST', body: { code: 'ZZZZZZ' }, jar })
    expect(notFound.status).toBe(404)
    expect((notFound.body as { error: { code: string } }).error.code).toBe('join_code_not_found')
    expect((notFound.body as { error: { message: string } }).error.message).toMatch(/instructor/i)

    const malformed = await call('/api/classes/join', { method: 'POST', body: { code: 'nope' }, jar })
    expect(malformed.status).toBe(400)
    expect((malformed.body as { error: { code: string } }).error.code).toBe('validation_failed')
    expect((malformed.body as { error: { message: string } }).error.message).toContain(
      String(JOIN_CODE_LENGTH),
    )

    // Three distinct outcomes — a generic 400 for all of them would leave the
    // screen with nothing useful to say next to the input.
    expect(new Set([notFound.status, malformed.status]).size).toBe(2)
  })
})

/* -------------------------------------------------------------------------- */
/* Preferences                                                                */
/* -------------------------------------------------------------------------- */

describe('accessibility preferences', () => {
  it('persist to profiles and come back on the next sign-in', async () => {
    const jar = await signIn(SEED_EMAIL.cruz)

    const saved = await call('/api/profile', {
      method: 'PATCH',
      body: { preferences: { reducedMotion: true, largerText: true } },
      jar,
    })
    expect(saved.status).toBe(200)

    // A fresh cookie on a fresh session — this is the "follows a student to
    // another machine" claim, and the only honest way to check it.
    const elsewhere = await signIn(SEED_EMAIL.cruz)
    const me = await call('/api/auth/me', { jar: elsewhere })
    const preferences = (me.body as { profile: { preferences: Record<string, unknown> } }).profile.preferences

    expect(preferences['reducedMotion']).toBe(true)
    expect(preferences['largerText']).toBe(true)
  })

  it('merge rather than replace, so one toggle does not reset the others', async () => {
    const jar = await signIn(SEED_EMAIL.cruz)

    await call('/api/profile', { method: 'PATCH', body: { preferences: { highContrast: true } }, jar })
    const me = await call('/api/auth/me', { jar })
    const preferences = (me.body as { profile: { preferences: Record<string, unknown> } }).profile.preferences

    // The settings screen sends one switch at a time. A replace here would mean
    // the first client that forgets to send the whole object silently turns the
    // other three off.
    expect(preferences['highContrast']).toBe(true)
    expect(preferences['reducedMotion']).toBe(true)
    expect(preferences['largerText']).toBe(true)
  })

  it('carry a complete object even for a row written before the column existed', async () => {
    // `preferences` defaults to `{}`, and every field in `preferencesSchema` has
    // a default — which is what makes the column safe to widen in Part B.
    await db.update(profiles).set({ preferences: {} }).where(eq(profiles.id, SEED.students[1]))

    const jar = await signIn(SEED_EMAIL.santos)
    const me = await call('/api/auth/me', { jar })
    const preferences = (me.body as { profile: { preferences: Record<string, unknown> } }).profile.preferences

    expect(preferences).toEqual({
      theme: 'light',
      highContrast: false,
      reducedMotion: false,
      largerText: false,
    })
  })

  it('cannot be used to change a role', async () => {
    const jar = await signIn(SEED_EMAIL.cruz)

    const reply = await call('/api/profile', {
      method: 'PATCH',
      body: { fullName: 'Andrea Cruz', role: 'instructor' },
      jar,
    })

    expect(reply.status).toBe(200)
    expect((reply.body as { profile: { role: string } }).profile.role).toBe('student')

    // And the guard that actually matters still refuses.
    const teach = await call('/api/teach/exercises', { jar })
    expect(teach.status).toBe(403)
  })

  it('changes the locale, which is what the EN / Filipino toggle writes', async () => {
    const jar = await signIn(SEED_EMAIL.cruz)

    const reply = await call('/api/profile', { method: 'PATCH', body: { locale: 'fil' }, jar })
    expect(reply.status).toBe(200)
    expect((reply.body as { profile: { locale: string } }).profile.locale).toBe('fil')

    const rejected = await call('/api/profile', { method: 'PATCH', body: { locale: 'de' }, jar })
    expect(rejected.status).toBe(400)
  })
})
