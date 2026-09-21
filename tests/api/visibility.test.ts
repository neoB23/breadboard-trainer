import { beforeAll, describe, expect, it } from 'vitest'

import { call, CRUZ, DIZON, exerciseFixture, INSTRUCTOR, SEED, seedOnce } from '../helpers/harness.ts'

/**
 * Exercise visibility, enforced at the API rather than by the UI — Phase 6 DoD:
 * "Unpublished exercises are invisible to students (verified at the API level,
 * not just the UI)."
 *
 * Two separate rules are under test and they refuse differently on purpose:
 * an unpublished exercise is a 404 (the instructor's draft process is not the
 * student's business), while an exercise in a class the student is not in is a
 * 403 (it exists; you are not in that room).
 */

beforeAll(async () => {
  await seedOnce()
})

describe('the draft fixture', () => {
  it('really is unpublished and really is in the seeded class', async () => {
    const fixture = await exerciseFixture(SEED.draftExerciseId)
    expect(fixture.published).toBe(false)
    expect(fixture.classId).toBe(SEED.classId)
  })
})

describe('an unpublished exercise', () => {
  it('is a 404 for an enrolled student who asks for it directly', async () => {
    const reply = await call(`/api/exercises/${SEED.draftExerciseId}`, { as: CRUZ })

    expect(reply.status).toBe(404)
    expect(reply.body).not.toHaveProperty('exercise')
  })

  it('never appears in the student library listing', async () => {
    const reply = await call('/api/exercises?perPage=100', { as: CRUZ })

    expect(reply.status).toBe(200)
    const ids = (reply.body as { items: { id: string }[] }).items.map((item) => item.id)
    expect(ids).toContain(SEED.publishedExerciseId)
    expect(ids).not.toContain(SEED.draftExerciseId)
  })

  it('cannot be reached by asking for it as a class filter either', async () => {
    const reply = await call(`/api/exercises?classId=${SEED.classId}&perPage=100`, { as: CRUZ })

    expect(reply.status).toBe(200)
    const ids = (reply.body as { items: { id: string }[] }).items.map((item) => item.id)
    expect(ids).not.toContain(SEED.draftExerciseId)
  })

  it('cannot be attempted', async () => {
    const reply = await call('/api/attempts', {
      method: 'POST',
      as: CRUZ,
      body: { exerciseId: SEED.draftExerciseId },
    })
    expect(reply.status).toBe(404)
  })

  it('is visible to the instructor who owns it', async () => {
    const reply = await call(`/api/teach/exercises/${SEED.draftExerciseId}`, { as: INSTRUCTOR })
    expect(reply.status).toBe(200)
  })
})

describe('a class exercise and a student who is not enrolled', () => {
  it('is a 403 rather than data', async () => {
    // Dizon is seeded deliberately un-enrolled.
    const reply = await call(`/api/exercises/${SEED.publishedExerciseId}`, { as: DIZON })

    expect(reply.status).toBe(403)
    expect(reply.body).not.toHaveProperty('exercise')
  })

  it('does not appear in that student’s library', async () => {
    const reply = await call('/api/exercises?perPage=100', { as: DIZON })

    expect(reply.status).toBe(200)
    const ids = (reply.body as { items: { id: string }[] }).items.map((item) => item.id)
    expect(ids).not.toContain(SEED.publishedExerciseId)
  })
})
