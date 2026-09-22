import { describe, expect, it } from 'vitest'

import { compareNetlists } from '../../src/board/compare.ts'
import { type PlacedPart } from '../../src/board/model.ts'
import { extractNetlist } from '../../src/board/netlist.ts'
import type { ComponentType } from '../../shared/contracts/index.ts'

/**
 * The comparator. The headline case is the first one: the instructor's
 * circuit built somewhere else on the board is the instructor's circuit, and
 * scores as such. Everything after it is a single mistake a first-year
 * student actually makes, and the exact score it must cost.
 */

function part(id: string, type: ComponentType, holes: string[], value: string | null = null): PlacedPart {
  return { id, bomItemId: `${type}-${value ?? 'x'}`, type, label: null, value, holes }
}

function seriesLed(): PlacedPart[] {
  return [
    part('w1', 'jumper', ['T2', 'U2r0']),
    part('r1', 'resistor', ['U2r1', 'U7r1'], '220Ω'),
    part('w2', 'jumper', ['U7r2', 'U12r2']),
    part('d1', 'led', ['U12r3', 'L12r1'], 'Red 2V'),
    part('w3', 'jumper', ['L12r4', 'B14']),
  ]
}

function shift(parts: PlacedPart[], by: number): PlacedPart[] {
  return parts.map((p) => ({
    ...p,
    holes: p.holes.map((hole) =>
      hole.replace(/^([ULTB])(\d+)/, (_, bank: string, col: string) => `${bank}${Number(col) + by}`),
    ),
  }))
}

const REFERENCE = extractNetlist(seriesLed())

function compare(student: PlacedPart[], reference = REFERENCE, options?: { maxNodes?: number }) {
  return compareNetlists(reference, extractNetlist(student), options)
}

describe('the comparator', () => {
  it('scores the reference circuit built elsewhere on the board as a perfect match', () => {
    const result = compare(shift(seriesLed(), 4))
    expect(result.ratio).toBe(1)
    expect(result.required).toBe(3)
    expect(result.matched).toBe(3)
    expect(result.extra).toBe(0)
    expect(result.missingLinks).toEqual([])
    expect(result.extraLinks).toEqual([])
    expect(result.reversed).toEqual([])
  })

  it('does not care which end of a resistor went in first', () => {
    const flipped = seriesLed().map((p) => (p.id === 'r1' ? { ...p, holes: ['U7r1', 'U2r1'] } : p))
    const result = compare(flipped)
    expect(result.ratio).toBe(1)
    expect(result.reversed).toEqual([])
  })

  it('costs one link for one missing wire, and says which two things to join', () => {
    const result = compare(seriesLed().filter((p) => p.id !== 'w3'))
    expect(result.matched).toBe(2)
    expect(result.ratio).toBeCloseTo(2 / 3)
    expect(result.missingLinks).toEqual([
      { a: { kind: 'rail', rail: 'gnd' }, b: { kind: 'pin', partId: 'd1', pinIndex: 1 } },
    ])
  })

  it('keeps full circuit credit for a reversed LED and reports the reversal instead', () => {
    const reversed = seriesLed().map((p) => (p.id === 'd1' ? { ...p, holes: ['L12r1', 'U12r3'] } : p))
    // Rewire so the reversed LED still sits in the same two nets.
    const result = compare(reversed)
    expect(result.ratio).toBe(1)
    expect(result.reversed).toEqual([{ studentPartId: 'd1', type: 'led' }])
    expect(result.orientedPolar).toBe(0)
  })

  it('charges a wire that bypasses the resistor as one extra join', () => {
    const result = compare([...seriesLed(), part('w9', 'jumper', ['U2r4', 'U7r4'])])
    expect(result.extra).toBe(1)
    expect(result.ratio).toBeCloseTo(2 / 3)
    expect(result.extraLinks).toHaveLength(1)
  })

  it('charges a rail short as an extra join between the rails', () => {
    const result = compare([...seriesLed(), part('w9', 'jumper', ['T17', 'B17'])])
    expect(result.extra).toBe(1)
    expect(result.extraLinks).toEqual([
      { a: { kind: 'rail', rail: 'vcc' }, b: { kind: 'rail', rail: 'gnd' } },
    ])
  })

  it('reports a part left in the tray, and scores only what it could still match', () => {
    const result = compare(seriesLed().filter((p) => p.id !== 'r1'))
    expect(result.missingParts).toEqual([{ refKey: 'c1', type: 'resistor', value: '220Ω', label: null }])
    expect(result.matched).toBe(1)
  })

  it('matches by type, so swapped resistor values keep the circuit and cost the parts line', () => {
    const reference = extractNetlist([
      part('w1', 'jumper', ['T1', 'U1r0']),
      part('ra', 'resistor', ['U1r1', 'U4r1'], '220Ω'),
      part('rb', 'resistor', ['U4r2', 'U8r1'], '1kΩ'),
      part('d1', 'led', ['U8r2', 'L8r1'], 'Red 2V'),
      part('w2', 'jumper', ['L8r2', 'B8']),
    ])
    const swapped = [
      part('w1', 'jumper', ['T1', 'U1r0']),
      part('ra', 'resistor', ['U1r1', 'U4r1'], '1kΩ'),
      part('rb', 'resistor', ['U4r2', 'U8r1'], '220Ω'),
      part('d1', 'led', ['U8r2', 'L8r1'], 'Red 2V'),
      part('w2', 'jumper', ['L8r2', 'B8']),
    ]
    const result = compare(swapped, reference)
    expect(result.ratio).toBe(1)
    expect(result.rightParts).toBe(1) // the LED
    expect(result.wrongValues).toHaveLength(2)
  })

  it('does not credit the orientation of a polar part that is not wired in', () => {
    const result = compare([part('d1', 'led', ['U12r3', 'L12r1'], 'Red 2V')])
    expect(result.orientedPolar).toBe(0)
    expect(result.polarTotal).toBe(1)
  })

  it('gives the same score whatever order the student placed parts in', () => {
    const forwards = compare(seriesLed().filter((p) => p.id !== 'w2'))
    const backwards = compare(
      seriesLed()
        .filter((p) => p.id !== 'w2')
        .reverse(),
    )
    expect(backwards.ratio).toBe(forwards.ratio)
    expect(backwards.matched).toBe(forwards.matched)
  })

  it('is deterministic when the search budget runs out', () => {
    const chain = (prefix: string): PlacedPart[] => [
      part(`${prefix}w`, 'jumper', ['T0', 'U0r0']),
      ...[0, 1, 2, 3, 4, 5].map((n) =>
        part(`${prefix}r${n}`, 'resistor', [`U${n * 3}r1`, `U${n * 3 + 3}r2`], '1kΩ'),
      ),
      part(`${prefix}g`, 'jumper', ['U18r4', 'B18']),
    ]
    const reference = extractNetlist(chain('a'))
    const scrambled = chain('b').reverse()
    const first = compare(scrambled, reference, { maxNodes: 3 })
    const second = compare(scrambled, reference, { maxNodes: 3 })
    expect(first.truncated).toBe(true)
    expect(second).toEqual(first)
    // With the real budget the same board is solved exactly.
    expect(compare(scrambled, reference).ratio).toBe(1)
  })
})

/* -------------------------------------------------------------------------- */
/* The 2s − 1 property                                                        */
/* -------------------------------------------------------------------------- */

/** mulberry32 — a seeded PRNG, so a failure here is reproducible. */
function random(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomHole(next: () => number, taken: Set<string>): string {
  for (;;) {
    const bank = next() < 0.4 ? (next() < 0.5 ? 'T' : 'B') : next() < 0.5 ? 'U' : 'L'
    const column = Math.floor(next() * 20)
    const hole =
      bank === 'T' || bank === 'B' ? `${bank}${column}` : `${bank}${column}r${Math.floor(next() * 5)}`
    if (!taken.has(hole)) {
      taken.add(hole)
      return hole
    }
  }
}

describe('the link metric', () => {
  it('never falls by more than one when a single wire is added', () => {
    const next = random(20260922)
    for (let trial = 0; trial < 60; trial += 1) {
      const board = seriesLed().filter(() => next() < 0.7)
      const taken = new Set(board.flatMap((p) => p.holes))
      const before = compare(board)
      const wire = part(`x${trial}`, 'jumper', [randomHole(next, taken), randomHole(next, taken)])
      const after = compare([...board, wire])
      expect(after.matched - after.extra).toBeGreaterThanOrEqual(before.matched - before.extra - 1)
    }
  })

  it('climbs steadily as the reference wires go back in, one at a time', () => {
    const wires = seriesLed().filter((p) => p.type === 'jumper')
    const parts = seriesLed().filter((p) => p.type !== 'jumper')
    let previous = compare(parts).ratio
    for (const wire of wires) {
      parts.push(wire)
      const now = compare(parts).ratio
      expect(now).toBeGreaterThanOrEqual(previous)
      previous = now
    }
    expect(previous).toBe(1)
  })
})
