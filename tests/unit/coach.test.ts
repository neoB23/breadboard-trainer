import { afterEach, describe, expect, it } from 'vitest'

import { coachAfterSubmit } from '../../api/ai/coach.ts'
import { buildDigest, type CoachDigest } from '../../api/ai/digest.ts'
import { checkGrounding } from '../../api/ai/grounding.ts'
import {
  chatJson,
  coachConfigFromEnv,
  extractJson,
  setCoachTransport,
  type CoachConfig,
} from '../../api/ai/provider.ts'
import { seriesLedBoard, shiftBoard } from '../../api/db/reference-boards.ts'
import { gradeSubmission } from '../../api/grading/submit.ts'
import { parseBoardState, serializeBoard, type PlacedPart } from '../../src/board/model.ts'
import { buildGoldenNetlist } from '../../src/board/netlist.ts'
import { z } from 'zod'
import type { Bom } from '../../shared/contracts/index.ts'

/**
 * The after-submit AI Coach, with no model anywhere near the test: the
 * transport is a fake, so every failure a real Qwen server can produce —
 * slow, down, chatty, wrong — is reproduced on demand and has to end in the
 * same place, the deterministic text.
 */

const BOM: Bom = [
  { id: 'r-220', type: 'resistor', label: 'Current-limiting resistor', value: '220Ω', quantity: 1 },
  { id: 'led-red', type: 'led', label: 'Indicator LED', value: 'Red 2V', quantity: 1 },
  { id: 'jumper', type: 'jumper', label: 'Jumper wire', value: null, quantity: 4 },
]
const GOLDEN = buildGoldenNetlist(parseBoardState(serializeBoard(seriesLedBoard()), BOM))

function digestFor(board: PlacedPart[], locale: 'en' | 'fil' = 'en'): CoachDigest {
  const judged = gradeSubmission(serializeBoard(board), BOM, GOLDEN)
  if (judged.graded === null) throw new Error('expected a graded board')
  return buildDigest(judged.graded.grade, judged.graded.findings, locale)
}

/** The ground wire left off: one finding, f1, "connect D1.K to the ground rail". */
const MISSING_GROUND = () => digestFor(shiftBoard(seriesLedBoard(), 3).filter((p) => p.id !== 'stu-w3'))
/** A rail short: the fix names the jumper, the question must not. */
const SHORTED = () =>
  digestFor([
    ...shiftBoard(seriesLedBoard(), 3),
    { id: 'x', bomItemId: 'jumper', type: 'jumper', label: null, value: null, holes: ['T18', 'B18'] },
  ])

const CONFIG: CoachConfig = {
  baseUrl: 'http://coach.test/v1',
  model: 'qwen3:8b',
  apiKey: null,
  timeoutMs: 200,
}

function reply(content: string, status = 200): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { role: 'assistant', content } }],
      usage: { prompt_tokens: 900, completion_tokens: 80 },
    }),
    { status, headers: { 'content-type': 'application/json' } },
  )
}

afterEach(() => setCoachTransport(null))

/* -------------------------------------------------------------------------- */

describe('the digest', () => {
  it('carries the finished result and nothing about who built it', () => {
    const digest = MISSING_GROUND()
    expect(digest.verdict).toBe('issues')
    expect(digest.focus).toBe('f1')
    expect(digest.findings[0]).toMatchObject({ kind: 'missing_link', pins: ['D1.K'] })
    expect(Object.keys(digest).sort()).toEqual([
      'context',
      'correct',
      'findings',
      'focus',
      'score',
      'verdict',
    ])
    expect(JSON.stringify(digest)).not.toMatch(/seed_|@|student|attempt|exercise/i)
  })

  it('is written in the student’s language', () => {
    const board = shiftBoard(seriesLedBoard(), 3).filter((p) => p.id !== 'stu-w3')
    expect(digestFor(board, 'en').findings[0]?.fix).toContain('Connect')
    expect(digestFor(board, 'fil').findings[0]?.fix).toContain('Ikonekta')
  })
})

describe('the model adapter', () => {
  it('reads config from the environment, and is off without a base URL', () => {
    expect(coachConfigFromEnv({})).toBeNull()
    expect(coachConfigFromEnv({ COACH_BASE_URL: 'http://gpu:8000/v1/' })).toEqual({
      baseUrl: 'http://gpu:8000/v1',
      model: 'qwen3:8b',
      apiKey: null,
      timeoutMs: 8000,
    })
  })

  it('posts an OpenAI-compatible chat completion and returns parsed JSON', async () => {
    let sent: { url: string; init: RequestInit } | null = null
    setCoachTransport(async (url, init) => {
      sent = { url, init }
      return reply('{"ok":true}')
    })
    const result = await chatJson(
      { ...CONFIG, apiKey: 'k' },
      [{ role: 'user', content: 'hi' }],
      z.object({ ok: z.boolean() }),
    )
    expect(result).toMatchObject({
      ok: true,
      data: { ok: true },
      usage: { inputTokens: 900, outputTokens: 80 },
    })
    expect(sent!.url).toBe('http://coach.test/v1/chat/completions')
    expect(new Headers(sent!.init.headers).get('authorization')).toBe('Bearer k')
    expect(JSON.parse(String(sent!.init.body))).toMatchObject({ model: 'qwen3:8b', stream: false })
  })

  it('strips a thinking block and chatter around the JSON', () => {
    expect(extractJson('<think>let me see</think>\nSure! {"a":1} hope that helps')).toEqual({ a: 1 })
    expect(extractJson('no json here')).toBeNull()
  })

  it('never throws — every failure is a reason', async () => {
    const schema = z.object({ ok: z.boolean() })
    const messages = [{ role: 'user' as const, content: 'hi' }]

    setCoachTransport(async () => reply('not json at all'))
    expect(await chatJson(CONFIG, messages, schema)).toMatchObject({ ok: false, reason: 'malformed' })

    setCoachTransport(async () => reply('{"wrong":"shape"}'))
    expect(await chatJson(CONFIG, messages, schema)).toMatchObject({ ok: false, reason: 'malformed' })

    setCoachTransport(async () => reply('{}', 500))
    expect(await chatJson(CONFIG, messages, schema)).toMatchObject({ ok: false, reason: 'http', status: 500 })

    setCoachTransport(async () => {
      throw new TypeError('fetch failed')
    })
    expect(await chatJson(CONFIG, messages, schema)).toMatchObject({ ok: false, reason: 'network' })

    setCoachTransport(
      (_url, init) =>
        new Promise((_resolve, reject) =>
          init.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    )
    expect(await chatJson({ ...CONFIG, timeoutMs: 20 }, messages, schema)).toMatchObject({
      ok: false,
      reason: 'timeout',
    })
  })
})

describe('the grounding check', () => {
  const grounded = {
    findingId: 'f1',
    question: 'Where does current go after it leaves D1.K?',
    fix: 'Run a jumper from D1.K to the ground rail.',
  }

  it('passes wording that only restates the digest', () => {
    expect(checkGrounding({ suggestions: [grounded], praise: null }, MISSING_GROUND())).toEqual({ ok: true })
  })

  it.each([
    ['an invented part', { ...grounded, fix: 'Move R3 next to D1.K.' }],
    ['an invented value', { ...grounded, fix: 'Swap in a 10Ω resistor next to D1.K.' }],
    ['an invented column', { ...grounded, fix: 'Connect D1.K to column 99.' }],
    ['a link', { ...grounded, fix: 'See https://example.com for help.' }],
    ['an essay', { ...grounded, fix: 'word '.repeat(90) }],
  ])('rejects %s', (_label, suggestion) => {
    expect(checkGrounding({ suggestions: [suggestion], praise: null }, MISSING_GROUND()).ok).toBe(false)
  })

  it('rejects a finding the digest does not have, and the same finding twice', () => {
    const digest = MISSING_GROUND()
    expect(checkGrounding({ suggestions: [{ ...grounded, findingId: 'f9' }], praise: null }, digest).ok).toBe(
      false,
    )
    expect(checkGrounding({ suggestions: [grounded, grounded], praise: null }, digest).ok).toBe(false)
  })

  it('rejects a question that gives its own fix away', () => {
    const digest = SHORTED()
    expect(digest.findings[0]?.kind).toBe('rail_short')
    const jumper = digest.findings[0]?.refs[0] ?? ''
    const spoiled = { findingId: 'f1', question: `Is ${jumper} the problem?`, fix: `Remove ${jumper}.` }
    const hinted = {
      findingId: 'f1',
      question: 'What stops current going straight from +5V to ground?',
      fix: `Remove ${jumper}.`,
    }
    expect(checkGrounding({ suggestions: [spoiled], praise: null }, digest).ok).toBe(false)
    expect(checkGrounding({ suggestions: [hinted], praise: null }, digest)).toEqual({ ok: true })
  })

  it('rejects suggestions on a board that has nothing wrong', () => {
    const clean = digestFor(shiftBoard(seriesLedBoard(), 3))
    expect(clean.verdict).toBe('clean')
    expect(checkGrounding({ suggestions: [grounded], praise: 'Nice.' }, clean).ok).toBe(false)
    expect(
      checkGrounding({ suggestions: [], praise: 'Every connection matches. Well built.' }, clean),
    ).toEqual({ ok: true })
  })
})

describe('the coach', () => {
  it('serves the catalogue when no model is configured', async () => {
    const result = await coachAfterSubmit(MISSING_GROUND(), null)
    expect(result.view).toEqual({ source: 'rules', suggestions: [], praise: null })
    expect(result.meta).toMatchObject({ fellBack: true, reason: 'disabled' })
  })

  it('serves the model’s wording when it is grounded', async () => {
    setCoachTransport(async () =>
      reply(
        JSON.stringify({
          suggestions: [
            {
              findingId: 'f1',
              question: 'Where does current go after D1.K?',
              fix: 'Run a jumper from D1.K to the ground rail.',
            },
          ],
          praise: null,
        }),
      ),
    )
    const result = await coachAfterSubmit(MISSING_GROUND(), CONFIG)
    expect(result.view.source).toBe('model')
    expect(result.view.suggestions[0]?.fix).toContain('ground rail')
    expect(result.meta).toMatchObject({ groundingOk: true, fellBack: false, model: 'qwen3:8b' })
  })

  it('throws away every word of a message that fails the check', async () => {
    setCoachTransport(async () =>
      reply(
        JSON.stringify({
          suggestions: [
            { findingId: 'f1', question: 'Where does current go after D1.K?', fix: 'Use a 10Ω resistor.' },
          ],
          praise: null,
        }),
      ),
    )
    const result = await coachAfterSubmit(MISSING_GROUND(), CONFIG)
    expect(result.view).toEqual({ source: 'rules', suggestions: [], praise: null })
    expect(result.meta.groundingOk).toBe(false)
    expect(JSON.stringify(result.view)).not.toContain('10Ω')
  })

  it('sends the model the digest and nothing that identifies the student', async () => {
    let body = ''
    setCoachTransport(async (_url, init) => {
      body = String(init.body)
      return reply('{"suggestions":[],"praise":null}')
    })
    await coachAfterSubmit(MISSING_GROUND(), CONFIG)
    expect(body).toContain('missing_link')
    expect(body).not.toMatch(/Andrea|Cruz|seed_student|@students|2021-00417/)
  })
})
