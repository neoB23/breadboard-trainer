import { beforeAll, describe, expect, it } from 'vitest'

import { call, createAttemptFor, CRUZ, SANTOS, SEED, seedOnce } from '../helpers/harness.ts'

/**
 * Layer three of the authorisation model: which rows.
 *
 * Phase 2 DoD, in as many words: "Requesting another student's attempt returns
 * 403, not data." Session and role middleware both pass cleanly here — Cruz and
 * Santos are both authenticated students — so the only thing standing between
 * them is `ownership.ts`.
 */

let cruzAttempt = ''
let santosAttempt = ''

beforeAll(async () => {
  await seedOnce()
  cruzAttempt = await createAttemptFor(CRUZ, SEED.publishedExerciseId)
  santosAttempt = await createAttemptFor(SANTOS, SEED.publishedExerciseId)
})

describe("a student reading another student's attempt", () => {
  it('GET /api/attempts/:id returns 403, not data', async () => {
    const reply = await call(`/api/attempts/${santosAttempt}`, { as: CRUZ })

    expect(reply.status).toBe(403)
    expect(reply.body).not.toHaveProperty('attempt')
    expect((reply.body as { error: { code: string } }).error.code).toBe('forbidden')
  })

  it('GET /api/attempts/:id/result returns 403', async () => {
    const reply = await call(`/api/attempts/${santosAttempt}/result`, { as: CRUZ })
    expect(reply.status).toBe(403)
  })

  it('PATCH /api/attempts/:id returns 403 and does not write', async () => {
    const reply = await call(`/api/attempts/${santosAttempt}`, {
      method: 'PATCH',
      as: CRUZ,
      body: { hintsUsed: 99 },
    })
    expect(reply.status).toBe(403)

    const owner = await call(`/api/attempts/${santosAttempt}`, { as: SANTOS })
    expect(owner.status).toBe(200)
    expect((owner.body as { attempt: { hintsUsed: number } }).attempt.hintsUsed).toBe(0)
  })

  it('POST /api/attempts/:id/submit returns 403', async () => {
    const reply = await call(`/api/attempts/${santosAttempt}/submit`, {
      method: 'POST',
      as: CRUZ,
      body: {
        finalState: {},
        durationMs: 1000,
        hintsUsed: 0,
        faultsEncountered: 0,
        faultsSelfResolved: 0,
        completed: true,
      },
    })
    expect(reply.status).toBe(403)
  })

  it('cannot widen the list filter to another student', async () => {
    const reply = await call(`/api/attempts?studentId=${SANTOS}`, { as: CRUZ })
    expect(reply.status).toBe(403)
  })

  it('the unfiltered list is silently scoped to the caller', async () => {
    const reply = await call('/api/attempts', { as: CRUZ })

    expect(reply.status).toBe(200)
    const items = (reply.body as { items: { id: string; studentId?: string }[] }).items
    expect(items.map((item) => item.id)).toContain(cruzAttempt)
    expect(items.map((item) => item.id)).not.toContain(santosAttempt)
  })
})

describe('a student reading their own attempt', () => {
  it('gets 200 and the row', async () => {
    const reply = await call(`/api/attempts/${cruzAttempt}`, { as: CRUZ })

    expect(reply.status).toBe(200)
    expect((reply.body as { attempt: { id: string } }).attempt.id).toBe(cruzAttempt)
  })
})

describe('the session layer', () => {
  it('answers 401 without a session', async () => {
    expect((await call(`/api/attempts/${cruzAttempt}`)).status).toBe(401)
    expect((await call('/api/exercises')).status).toBe(401)
  })

  it('answers 401 for an id with no profiles row', async () => {
    expect((await call('/api/exercises', { as: 'not_a_real_user' })).status).toBe(401)
  })

  it('leaves /api/health public', async () => {
    const reply = await call('/api/health')
    expect(reply.status).toBe(200)
    expect((reply.body as { status: string }).status).toBe('ok')
  })
})
