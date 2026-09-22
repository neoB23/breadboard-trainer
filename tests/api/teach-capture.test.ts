import { beforeAll, describe, expect, it } from 'vitest'

import { seriesLedBoard, shiftBoard } from '../../api/db/reference-boards.ts'
import { serializeBoard, type PlacedPart } from '../../src/board/model.ts'
import { findGoldenNetlist, type Bom } from '../../shared/contracts/index.ts'
import { call, CRUZ, INSTRUCTOR, SEED, seedOnce } from '../helpers/harness.ts'

/**
 * Learn Mode capture, publishing and the scores list — the instructor's half
 * of the graded task, end to end: author an exercise, build the reference,
 * capture it (and be refused when it is not a circuit worth full marks),
 * publish it, watch a student's submission arrive with its score, and see it
 * marked stale when the reference is replaced.
 */

const BOM: Bom = [
  { id: 'r-220', type: 'resistor', label: 'Current-limiting resistor', value: '220Ω', quantity: 1 },
  { id: 'led-red', type: 'led', label: 'Indicator LED', value: 'Red 2V', quantity: 1 },
  { id: 'jumper', type: 'jumper', label: 'Jumper wire', value: null, quantity: 4 },
]

interface TeachBody {
  exercise: { id: string; hasReference: boolean; published: boolean; netlistVersion: number }
  referenceCleared?: boolean
}

let exerciseId = ''

beforeAll(async () => {
  await seedOnce()
  const created = await call('/api/teach/exercises', {
    method: 'POST',
    as: INSTRUCTOR,
    body: { title: 'Capture under test', difficulty: 1, classId: SEED.classId, bom: BOM },
  })
  expect(created.status).toBe(201)
  exerciseId = (created.body as TeachBody).exercise.id
})

const capture = (board: PlacedPart[], confirmReplace = false) =>
  call(`/api/teach/exercises/${exerciseId}/capture`, {
    method: 'POST',
    as: INSTRUCTOR,
    body: { board: serializeBoard(board), confirmReplace },
  })

const publish = (published: boolean) =>
  call(`/api/teach/exercises/${exerciseId}/publish`, { method: 'POST', as: INSTRUCTOR, body: { published } })

const jumper = (id: string, holes: string[]): PlacedPart => ({
  id,
  bomItemId: 'jumper',
  type: 'jumper',
  label: null,
  value: null,
  holes,
})

describe('authoring responses', () => {
  it('answer with the teacher view, never the netlist', async () => {
    const list = await call('/api/teach/exercises', { as: INSTRUCTOR })
    expect(findGoldenNetlist(list.body)).toBeNull()
    const mine = (list.body as { items: { id: string; hasReference: boolean }[] }).items.find(
      (item) => item.id === exerciseId,
    )
    expect(mine?.hasReference).toBe(false)
  })

  it('refuses to publish before a reference is captured', async () => {
    expect((await publish(true)).status).toBe(409)
  })
})

describe('POST /api/teach/exercises/:id/capture', () => {
  it.each([
    ['an empty board', [] as PlacedPart[], 'empty_board'],
    ['a rail short', [...seriesLedBoard(), jumper('x', ['T17', 'B17'])], 'short_circuit'],
    ['a lead touching nothing', seriesLedBoard().filter((p) => p.id !== 'ref-w1'), 'floating_lead'],
    ['a part left in the tray', seriesLedBoard().filter((p) => p.id !== 'ref-d1'), 'unused_bom_component'],
  ])('refuses %s with 422 and says why', async (_label, board, reason) => {
    const reply = await capture(board)
    expect(reply.status).toBe(422)
    const error = (reply.body as { error: { code: string; details: Record<string, string[]> } }).error
    expect(error.code).toBe('validation_failed')
    expect(Object.keys(error.details)).toContain(reason)
  })

  it('names the wire that shorts the rails', async () => {
    const reply = await capture([...seriesLedBoard(), jumper('x', ['T17', 'B17'])])
    expect(
      (reply.body as { error: { details: Record<string, string[]> } }).error.details['short_circuit'],
    ).toEqual(['W4'])
  })

  it('captures a correct circuit, derived on the server, and reports it captured', async () => {
    const reply = await capture(seriesLedBoard())
    expect(reply.status).toBe(200)
    expect(reply.body).toMatchObject({
      exercise: { hasReference: true, netlistVersion: 1 },
      invalidatedAttempts: 0,
    })
    expect(findGoldenNetlist(reply.body)).toBeNull()

    const detail = await call(`/api/teach/exercises/${exerciseId}`, { as: INSTRUCTOR })
    const golden = (
      detail.body as { exercise: { goldenNetlist: { version: number; components: unknown[] } } }
    ).exercise.goldenNetlist
    expect(golden.version).toBe(2)
    expect(golden.components).toHaveLength(2)
  })

  it('gives Learn Mode its board back', async () => {
    const reply = await call(`/api/teach/exercises/${exerciseId}/reference`, { as: INSTRUCTOR })
    expect(reply.status).toBe(200)
    const reference = (
      reply.body as { reference: { referenceBoard: { parts: unknown[] }; components: number } }
    ).reference
    expect(reference.referenceBoard.parts).toHaveLength(5)
    expect(reference.components).toBe(2)
  })

  it('will not replace a reference without being told twice', async () => {
    expect((await capture(seriesLedBoard())).status).toBe(409)
  })
})

describe('publishing, submissions and stale scores', () => {
  it('publishes once captured, and the student sees the task without its reference', async () => {
    const published = await publish(true)
    expect(published.status).toBe(200)
    expect((published.body as TeachBody).exercise.published).toBe(true)

    const asStudent = await call(`/api/exercises/${exerciseId}`, { as: CRUZ })
    expect(asStudent.status).toBe(200)
    expect(findGoldenNetlist(asStudent.body)).toBeNull()
  })

  it('lists a student’s submission with its score', async () => {
    const started = await call('/api/attempts', { method: 'POST', as: CRUZ, body: { exerciseId } })
    const attemptId = (started.body as { attempt: { id: string } }).attempt.id
    const submitted = await call(`/api/attempts/${attemptId}/submit`, {
      method: 'POST',
      as: CRUZ,
      body: { finalState: serializeBoard(shiftBoard(seriesLedBoard(), 5)), durationMs: 30_000 },
    })
    expect((submitted.body as { attempt: { score: number } }).attempt.score).toBe(100)

    const list = await call(`/api/teach/exercises/${exerciseId}/submissions`, { as: INSTRUCTOR })
    expect(list.status).toBe(200)
    const items = (
      list.body as { items: { attemptId: string; score: number; fullName: string; stale: boolean }[] }
    ).items
    expect(items).toContainEqual(
      expect.objectContaining({ attemptId, score: 100, fullName: 'Andrea Cruz', stale: false }),
    )
  })

  it('marks earlier scores stale when the reference is replaced, and unpublishes', async () => {
    const replaced = await capture(seriesLedBoard(), true)
    expect(replaced.status).toBe(200)
    expect(replaced.body).toMatchObject({
      exercise: { netlistVersion: 2, published: false },
      invalidatedAttempts: 1,
    })

    const list = await call(`/api/teach/exercises/${exerciseId}/submissions`, { as: INSTRUCTOR })
    const items = (list.body as { items: { stale: boolean }[] }).items
    expect(items.every((item) => item.stale)).toBe(true)
  })

  it('clears the reference when the tray changes, so nobody is graded against parts they were never given', async () => {
    const reply = await call(`/api/teach/exercises/${exerciseId}`, {
      method: 'PATCH',
      as: INSTRUCTOR,
      body: { bom: [...BOM, { id: 'r-1k', type: 'resistor', label: 'Extra', value: '1kΩ', quantity: 1 }] },
    })
    expect(reply.status).toBe(200)
    expect(reply.body).toMatchObject({
      referenceCleared: true,
      exercise: { hasReference: false, published: false },
    })
  })

  it('does not report a cleared reference when only the title changes', async () => {
    const reply = await call(`/api/teach/exercises/${exerciseId}`, {
      method: 'PATCH',
      as: INSTRUCTOR,
      body: { title: 'Renamed task' },
    })
    expect((reply.body as TeachBody).referenceCleared).toBe(false)
  })
})
