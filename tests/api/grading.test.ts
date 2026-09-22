import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { setCoachTransport } from '../../api/ai/provider.ts'
import { seriesLedBoard, shiftBoard } from '../../api/db/reference-boards.ts'
import { serializeBoard, type PlacedPart } from '../../src/board/model.ts'
import { findGoldenNetlist } from '../../shared/contracts/index.ts'
import { call, CRUZ, INSTRUCTOR, SANTOS, SEED, seedOnce } from '../helpers/harness.ts'

/**
 * Submit is where the auto score is decided, and the result page is where the
 * student reads it. Both are driven through the real app: the grade has to
 * come from the server's reading of the board, not the client's, and nothing
 * the student can reach may carry the reference circuit.
 */

beforeAll(async () => {
  await seedOnce()
})

afterEach(() => {
  setCoachTransport(null)
  delete process.env['COACH_BASE_URL']
  delete process.env['COACH_TIMEOUT_MS']
})

interface AttemptBody {
  attempt: { id: string; score: number | null; completed: boolean; gradedAt: string | null }
}

async function openAttempt(as: string, exerciseId = SEED.publishedExerciseId): Promise<string> {
  const reply = await call('/api/attempts', { method: 'POST', as, body: { exerciseId } })
  expect([200, 201]).toContain(reply.status)
  return (reply.body as AttemptBody).attempt.id
}

async function submit(as: string, board: PlacedPart[], extra: Record<string, unknown> = {}) {
  const id = await openAttempt(as)
  const reply = await call(`/api/attempts/${id}/submit`, {
    method: 'POST',
    as,
    body: { finalState: serializeBoard(board), durationMs: 60_000, ...extra },
  })
  return { id, reply }
}

const shifted = () => shiftBoard(seriesLedBoard(), 3)
const missingGround = () => shifted().filter((p) => p.id !== 'stu-w3')

describe('POST /api/attempts/:id/submit', () => {
  it('scores the reference circuit built elsewhere on the board at 100', async () => {
    const { reply } = await submit(CRUZ, shifted())
    expect(reply.status).toBe(200)
    const { attempt } = reply.body as AttemptBody
    expect(attempt.score).toBe(100)
    expect(attempt.completed).toBe(true)
    expect(attempt.gradedAt).not.toBeNull()
  })

  it('scores a missing ground wire at 77', async () => {
    const { reply } = await submit(CRUZ, missingGround())
    expect((reply.body as AttemptBody).attempt.score).toBe(77)
  })

  it('ignores the client’s claim that an empty board is complete', async () => {
    const { reply } = await submit(CRUZ, [], { completed: true })
    const { attempt } = reply.body as AttemptBody
    expect(attempt.completed).toBe(false)
    expect(attempt.score).toBe(0)
  })

  it('refuses a second submit with 409, from the database guard', async () => {
    const { id } = await submit(CRUZ, shifted())
    const again = await call(`/api/attempts/${id}/submit`, {
      method: 'POST',
      as: CRUZ,
      body: { finalState: serializeBoard([]), durationMs: 1 },
    })
    expect(again.status).toBe(409)

    const result = await call(`/api/attempts/${id}/result`, { as: CRUZ })
    expect((result.body as { grade: { score: number } }).grade.score).toBe(100)
  })

  it('carries no golden netlist and no reference board in its response', async () => {
    const { reply } = await submit(CRUZ, missingGround())
    expect(findGoldenNetlist(reply.body)).toBeNull()
  })
})

describe('GET /api/attempts/:id/result', () => {
  it('shows the owner the grade, the findings and the feedback straight after submit', async () => {
    const { id } = await submit(CRUZ, missingGround())
    const reply = await call(`/api/attempts/${id}/result`, { as: CRUZ })
    expect(reply.status).toBe(200)

    const body = reply.body as {
      grade: { score: number; lines: { id: string; earned: number }[] }
      findings: { id: string; kind: string }[]
      feedback: { source: string }
      stale: boolean
    }
    expect(body.grade.score).toBe(77)
    expect(body.grade.lines.map((line) => line.id)).toEqual(['circuit', 'parts', 'polarity', 'safety'])
    expect(body.findings[0]).toMatchObject({ id: 'f1', kind: 'missing_link' })
    expect(body.feedback.source).toBe('rules')
    expect(body.stale).toBe(false)
  })

  it('never carries the reference — not the netlist, not its board, not its keys', async () => {
    const { id } = await submit(CRUZ, missingGround())
    const reply = await call(`/api/attempts/${id}/result`, { as: CRUZ })
    expect(findGoldenNetlist(reply.body)).toBeNull()
    const raw = JSON.stringify(reply.body)
    expect(raw).not.toMatch(/"c\d+\.|referenceBoard|golden/i)
  })

  it('is refused to another student and open to the instructor who teaches it', async () => {
    const { id } = await submit(CRUZ, missingGround())
    expect((await call(`/api/attempts/${id}/result`, { as: SANTOS })).status).toBe(403)
    const asInstructor = await call(`/api/attempts/${id}/result`, { as: INSTRUCTOR })
    expect(asInstructor.status).toBe(200)
    expect((asInstructor.body as { grade: { score: number } }).grade.score).toBe(77)
  })

  it('shows nothing graded for an attempt still open', async () => {
    const id = await openAttempt(SANTOS)
    const reply = await call(`/api/attempts/${id}/result`, { as: SANTOS })
    expect(reply.body).toMatchObject({ grade: null, findings: [], feedback: null, stale: false })
  })
})

describe('the AI coach at submit', () => {
  const answer = (fix: string) => async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                suggestions: [
                  { findingId: 'f1', question: 'Where does current go after it leaves D1.K?', fix },
                ],
                praise: null,
              }),
            },
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )

  it('serves grounded wording from the model', async () => {
    process.env['COACH_BASE_URL'] = 'http://coach.test/v1'
    setCoachTransport(answer('Run a jumper from D1.K to the ground rail.'))

    const { id } = await submit(CRUZ, missingGround())
    const body = (await call(`/api/attempts/${id}/result`, { as: CRUZ })).body as {
      feedback: { source: string; suggestions: { fix: string }[] }
    }
    expect(body.feedback.source).toBe('model')
    expect(body.feedback.suggestions[0]?.fix).toBe('Run a jumper from D1.K to the ground rail.')
  })

  it('never lets ungrounded wording reach the student', async () => {
    process.env['COACH_BASE_URL'] = 'http://coach.test/v1'
    setCoachTransport(answer('Swap in a 10Ω resistor next to D1.K.'))

    const { id } = await submit(CRUZ, missingGround())
    const reply = await call(`/api/attempts/${id}/result`, { as: CRUZ })
    expect((reply.body as { feedback: { source: string } }).feedback.source).toBe('rules')
    expect(JSON.stringify(reply.body)).not.toContain('10Ω')
  })

  it('still grades, and falls back, when the model never answers', async () => {
    process.env['COACH_BASE_URL'] = 'http://coach.test/v1'
    process.env['COACH_TIMEOUT_MS'] = '30'
    setCoachTransport(
      (_url, init) =>
        new Promise((_resolve, reject) =>
          init.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    )

    const { id, reply } = await submit(CRUZ, missingGround())
    expect((reply.body as AttemptBody).attempt.score).toBe(77)
    const result = await call(`/api/attempts/${id}/result`, { as: CRUZ })
    expect((result.body as { feedback: { source: string } }).feedback.source).toBe('rules')
  })

  it('does not tell the model who the student is', async () => {
    process.env['COACH_BASE_URL'] = 'http://coach.test/v1'
    let sent = ''
    setCoachTransport(async (_url, init) => {
      sent = String(init.body)
      return new Response(
        JSON.stringify({ choices: [{ message: { content: '{"suggestions":[],"praise":null}' } }] }),
        {
          status: 200,
        },
      )
    })

    const { id } = await submit(CRUZ, missingGround())
    expect(sent).toContain('missing_link')
    expect(sent).not.toMatch(/Andrea|Cruz|seed_student|@students|2021-00417/)
    expect(sent).not.toContain(id)
    expect(sent).not.toContain(SEED.publishedExerciseId)
  })
})
