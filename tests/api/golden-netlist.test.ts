import { Hono } from 'hono'
import { beforeAll, describe, expect, it } from 'vitest'

import { exerciseInstructorColumns, exerciseStudentColumns, type Role } from '../../api/db/schema.ts'
import type { AppEnv } from '../../api/middleware/context.ts'
import { goldenNetlistTripwire } from '../../api/middleware/golden-netlist.ts'
import { findGoldenNetlist } from '../../shared/contracts/index.ts'
import {
  call,
  createAttemptFor,
  CRUZ,
  exerciseFixture,
  INSTRUCTOR,
  SEED,
  seedOnce,
} from '../helpers/harness.ts'

/**
 * THE GOLDEN NETLIST RULE — build plan section 2, risk register row 1.
 *
 * A student who can read `golden_netlist` can pass every exercise without
 * building anything, which invalidates the premise of the trainer. So these
 * tests are deliberately structural rather than spot checks: `findGoldenNetlist`
 * walks the entire response tree, so a netlist embedded three levels down inside
 * an attempt result fails just as loudly as one at the top level.
 */

beforeAll(async () => {
  await seedOnce()
})

describe('the seed fixture is what these tests assume', () => {
  it('has a published exercise that really does carry a golden netlist', async () => {
    const fixture = await exerciseFixture(SEED.publishedExerciseId)
    expect(fixture.published).toBe(true)
    // Without this the leak tests below would pass against a null column and
    // prove nothing at all.
    expect(fixture.hasGoldenNetlist).toBe(true)
  })
})

describe('the student projection', () => {
  it('omits goldenNetlist, and the instructor projection keeps it', () => {
    expect(Object.keys(exerciseStudentColumns)).not.toContain('goldenNetlist')
    expect(Object.keys(exerciseInstructorColumns)).toContain('goldenNetlist')
  })
})

describe('student-facing responses', () => {
  it('GET /api/exercises/:id returns an object with no golden_netlist key', async () => {
    const reply = await call(`/api/exercises/${SEED.publishedExerciseId}`, { as: CRUZ })

    expect(reply.status).toBe(200)
    expect(findGoldenNetlist(reply.body)).toBeNull()

    const exercise = (reply.body as { exercise: Record<string, unknown> }).exercise
    expect(exercise['title']).toBe('Series LED with current-limiting resistor')
    expect(Object.keys(exercise)).not.toContain('goldenNetlist')
    expect(Object.keys(exercise)).not.toContain('golden_netlist')
  })

  it('GET /api/exercises (the list) carries no golden netlist', async () => {
    const reply = await call('/api/exercises', { as: CRUZ })

    expect(reply.status).toBe(200)
    expect((reply.body as { items: unknown[] }).items.length).toBeGreaterThan(0)
    expect(findGoldenNetlist(reply.body)).toBeNull()
  })

  it('GET /api/attempts/:id/result carries no golden netlist in the embedded exercise', async () => {
    const attemptId = await createAttemptFor(CRUZ, SEED.publishedExerciseId)
    const reply = await call(`/api/attempts/${attemptId}/result`, { as: CRUZ })

    expect(reply.status).toBe(200)
    expect(findGoldenNetlist(reply.body)).toBeNull()
  })

  it('the instructor authoring list carries a boolean, not the netlist itself', async () => {
    const reply = await call('/api/teach/exercises', { as: INSTRUCTOR })

    expect(reply.status).toBe(200)
    expect(findGoldenNetlist(reply.body)).toBeNull()

    const items = (reply.body as { items: { id: string; hasGoldenNetlist: boolean }[] }).items
    const published = items.find((item) => item.id === SEED.publishedExerciseId)
    expect(published?.hasGoldenNetlist).toBe(true)
  })
})

/**
 * The negative control. Without it, every assertion above would still pass if
 * `findGoldenNetlist` were broken or the seeded netlist were null — the tests
 * would be green and the rule unenforced.
 */
describe('the detector actually detects', () => {
  it('an instructor detail response DOES contain the netlist', async () => {
    const reply = await call(`/api/teach/exercises/${SEED.publishedExerciseId}`, { as: INSTRUCTOR })

    expect(reply.status).toBe(200)
    expect(findGoldenNetlist(reply.body)).not.toBeNull()
  })

  it('finds the key at any depth and under either casing', () => {
    expect(findGoldenNetlist({ a: { b: [{ goldenNetlist: { version: 1 } }] } })).toBe(
      '$.a.b[0].goldenNetlist',
    )
    expect(findGoldenNetlist({ exercise: { golden_netlist: null } })).toBe('$.exercise.golden_netlist')
    expect(findGoldenNetlist({ exercise: { title: 'x', bom: [] } })).toBeNull()
  })
})

/**
 * Defence in depth. The projections are the real control; this proves the
 * backstop fires if a future handler ever selects a whole exercise row on a
 * student-reachable path.
 */
describe('the response tripwire', () => {
  /** Everything but the role, which is the only field the tripwire branches on. */
  const ANONYMOUS_SHAPE = {
    userId: 'tripwire-fixture',
    fullName: 'Tripwire Fixture',
    locale: 'en',
    onboardedAt: null,
  } as const

  const leaky = new Hono<AppEnv>()
  leaky.onError((_err, c) => c.json({ error: 'blocked' }, 500))
  leaky.use('*', goldenNetlistTripwire)
  leaky.use('*', async (c, next) => {
    const role = c.req.header('x-role')
    c.set('session', role === undefined ? null : { ...ANONYMOUS_SHAPE, role: role as Role })
    await next()
  })
  leaky.get('/leak', (c) => c.json({ exercise: { title: 'x', goldenNetlist: { version: 1 } } }))

  it('destroys a student response that contains a netlist', async () => {
    const res = await leaky.request('/leak', { headers: { 'x-role': 'student' } })
    expect(res.status).toBe(500)
    await expect(res.json()).resolves.not.toHaveProperty('exercise')
  })

  it('lets the same response through for an instructor', async () => {
    const res = await leaky.request('/leak', { headers: { 'x-role': 'instructor' } })
    expect(res.status).toBe(200)
    expect(findGoldenNetlist(await res.json())).not.toBeNull()
  })
})
