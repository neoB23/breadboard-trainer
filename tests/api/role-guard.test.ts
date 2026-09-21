import { beforeAll, describe, expect, it } from 'vitest'

import { findGoldenNetlist } from '../../shared/contracts/index.ts'
import { call, CRUZ, INSTRUCTOR, SEED, seedOnce } from '../helpers/harness.ts'

/**
 * Layer two: `/api/teach/*` is instructor-only.
 *
 * Phase 3 DoD: "`/api/teach/*` returns 403 for a student session even when
 * called directly with curl." `call()` is exactly that — the request goes
 * through the same middleware chain a curl would hit, with no UI in front of it.
 *
 * The guard is mounted on the subtree in `api/app.ts`, so this table is the
 * evidence that it covers every method and every route under it, including ones
 * that do not exist yet.
 */

beforeAll(async () => {
  await seedOnce()
})

const TEACH_ROUTES: readonly { method: string; path: string; body?: unknown }[] = [
  { method: 'GET', path: '/api/teach' },
  { method: 'GET', path: '/api/teach/classes' },
  { method: 'GET', path: `/api/teach/classes/${SEED.classId}` },
  { method: 'POST', path: '/api/teach/classes', body: { name: 'Mine now', term: '2026-1' } },
  { method: 'GET', path: '/api/teach/exercises' },
  { method: 'GET', path: `/api/teach/exercises/${SEED.publishedExerciseId}` },
  { method: 'GET', path: `/api/teach/exercises/${SEED.draftExerciseId}` },
  {
    method: 'POST',
    path: '/api/teach/exercises',
    body: { title: 'Mine now', difficulty: 1, bom: [] },
  },
  {
    method: 'PATCH',
    path: `/api/teach/exercises/${SEED.publishedExerciseId}`,
    body: { title: 'Renamed' },
  },
  {
    method: 'POST',
    path: `/api/teach/exercises/${SEED.publishedExerciseId}/publish`,
    body: { published: false },
  },
  {
    method: 'POST',
    path: `/api/teach/exercises/${SEED.publishedExerciseId}/capture`,
    body: { netlist: { version: 1 }, confirmReplace: true },
  },
  // Not a route Phase 2 registers. A student must still be refused rather than
  // told which instructor endpoints exist.
  { method: 'GET', path: '/api/teach/reports/anything' },
]

describe('a student session against /api/teach/*', () => {
  for (const route of TEACH_ROUTES) {
    it(`${route.method} ${route.path} -> 403`, async () => {
      const reply = await call(route.path, {
        method: route.method,
        as: CRUZ,
        ...(route.body !== undefined && { body: route.body }),
      })

      expect(reply.status).toBe(403)
      expect((reply.body as { error: { code: string } }).error.code).toBe('forbidden')
      expect(findGoldenNetlist(reply.body)).toBeNull()
    })
  }

  it('is refused before the handler runs, so nothing is written', async () => {
    await call('/api/teach/exercises', {
      method: 'POST',
      as: CRUZ,
      body: { title: 'Should not exist', difficulty: 1, bom: [] },
    })

    const asInstructor = await call('/api/teach/exercises', { as: INSTRUCTOR })
    const titles = (asInstructor.body as { items: { title: string }[] }).items.map((item) => item.title)
    expect(titles).not.toContain('Should not exist')
  })

  it('is a 403 and not a 401 — the caller is authenticated, just wrong', async () => {
    const anonymous = await call('/api/teach/exercises')
    expect(anonymous.status).toBe(401)

    const student = await call('/api/teach/exercises', { as: CRUZ })
    expect(student.status).toBe(403)
  })
})

describe('an instructor session against the same routes', () => {
  it('reads the authoring list', async () => {
    const reply = await call('/api/teach/exercises', { as: INSTRUCTOR })
    expect(reply.status).toBe(200)
  })

  it('reads their own exercise detail, netlist included', async () => {
    const reply = await call(`/api/teach/exercises/${SEED.publishedExerciseId}`, { as: INSTRUCTOR })
    expect(reply.status).toBe(200)
    expect(findGoldenNetlist(reply.body)).not.toBeNull()
  })
})
