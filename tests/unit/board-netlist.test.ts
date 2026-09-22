import { describe, expect, it } from 'vitest'

import { type PlacedPart } from '../../src/board/model.ts'
import {
  buildGoldenNetlist,
  extractNetlist,
  normaliseValue,
  validateReference,
  type CanonNetlist,
} from '../../src/board/netlist.ts'
import type { Bom, ComponentType } from '../../shared/contracts/index.ts'

/**
 * The canonical netlist. Its whole job is to forget where a circuit sits on
 * the board, so most of these cases build the same circuit two ways and
 * assert the two netlists are the same object.
 */

function part(
  id: string,
  type: ComponentType,
  holes: string[],
  bomItemId: string,
  value: string | null = null,
): PlacedPart {
  return { id, bomItemId, type, label: null, value, holes }
}

const BOM: Bom = [
  { id: 'r-220', type: 'resistor', label: 'Current-limiting resistor', value: '220Ω', quantity: 1 },
  { id: 'led-red', type: 'led', label: 'Indicator LED', value: 'Red 2V', quantity: 1 },
  { id: 'jumper', type: 'jumper', label: 'Jumper wire', value: null, quantity: 4 },
]

/** +5V → jumper → resistor → jumper → LED across the channel → jumper → ground. */
function seriesLed(): PlacedPart[] {
  return [
    part('w1', 'jumper', ['T2', 'U2r0'], 'jumper'),
    part('r1', 'resistor', ['U2r1', 'U7r1'], 'r-220', '220Ω'),
    part('w2', 'jumper', ['U7r2', 'U12r2'], 'jumper'),
    part('d1', 'led', ['U12r3', 'L12r1'], 'led-red', 'Red 2V'),
    part('w3', 'jumper', ['L12r4', 'B14'], 'jumper'),
  ]
}

/** Moves every hole `by` columns along. */
function shift(parts: PlacedPart[], by: number): PlacedPart[] {
  return parts.map((p) => ({
    ...p,
    holes: p.holes.map((hole) =>
      hole.replace(/^([ULTB])(\d+)/, (_, bank: string, col: string) => `${bank}${Number(col) + by}`),
    ),
  }))
}

/** Swaps the upper and lower banks — the circuit, mirrored across the channel. */
function mirror(parts: PlacedPart[]): PlacedPart[] {
  return parts.map((p) => ({
    ...p,
    holes: p.holes.map((hole) =>
      hole.startsWith('U') ? `L${hole.slice(1)}` : hole.startsWith('L') ? `U${hole.slice(1)}` : hole,
    ),
  }))
}

function withoutIdentity(netlist: CanonNetlist) {
  return {
    components: netlist.components.map(({ key, type, value, pins }) => ({ key, type, value, pins })),
    nets: netlist.nets,
  }
}

describe('the canonical netlist', () => {
  it('does not know which columns a circuit was built on', () => {
    expect(extractNetlist(shift(seriesLed(), 3))).toEqual(extractNetlist(seriesLed()))
  })

  it('does not know which side of the channel it was built on', () => {
    expect(extractNetlist(mirror(seriesLed()))).toEqual(extractNetlist(seriesLed()))
  })

  it('collapses jumpers: one long wire and a chain of short ones are the same circuit', () => {
    const chained = seriesLed()
      .filter((p) => p.id !== 'w3')
      .concat([
        part('w3', 'jumper', ['L12r4', 'L16r0'], 'jumper'),
        part('w4', 'jumper', ['L16r1', 'B18'], 'jumper'),
      ])
    expect(extractNetlist(chained)).toEqual(extractNetlist(seriesLed()))
  })

  it('names rails and pin roles, and nothing about holes', () => {
    const netlist = extractNetlist(seriesLed())
    expect(netlist.components.map((c) => c.type)).toEqual(['led', 'resistor'])
    expect(netlist.nets).toEqual([
      { rails: ['vcc'], members: ['c1.1'] },
      { rails: ['gnd'], members: ['c0.K'] },
      { rails: [], members: ['c0.A', 'c1.2'] },
    ])
    expect(JSON.stringify(netlist.nets)).not.toMatch(/U\d|L\d|T\d|B\d/)
  })

  it('stores the same circuit the same way whatever order it was placed in', () => {
    const reversed = [...seriesLed()].reverse()
    expect(withoutIdentity(extractNetlist(reversed))).toEqual(withoutIdentity(extractNetlist(seriesLed())))
  })

  it('treats a resistor turned end for end as the same resistor', () => {
    const flipped = seriesLed().map((p) => (p.id === 'r1' ? { ...p, holes: ['U7r1', 'U2r1'] } : p))
    expect(extractNetlist(flipped).nets).toEqual(extractNetlist(seriesLed()).nets)
  })

  it('treats an LED turned round as a different circuit', () => {
    const reversed = seriesLed().map((p) => (p.id === 'd1' ? { ...p, holes: ['L12r1', 'U12r3'] } : p))
    expect(extractNetlist(reversed).nets).not.toEqual(extractNetlist(seriesLed()).nets)
  })

  it('packs the reference board alongside the netlist for Learn Mode to reload', () => {
    const golden = buildGoldenNetlist(seriesLed())
    expect(golden.version).toBe(2)
    expect(golden.referenceBoard.parts).toHaveLength(5)
    expect(golden.components).toHaveLength(2)
  })
})

describe('value normalisation', () => {
  it('absorbs spacing, case and the ways of writing ohm and micro', () => {
    expect(normaliseValue(' 220 Ω ')).toBe(normaliseValue('220ohm'))
    expect(normaliseValue('10uF')).toBe(normaliseValue('10 µF'))
    expect(normaliseValue('10μF')).toBe(normaliseValue('10µF'))
    expect(normaliseValue('')).toBeNull()
    expect(normaliseValue(null)).toBeNull()
    expect(normaliseValue('1kΩ')).not.toBe(normaliseValue('220Ω'))
  })
})

describe('reference validation', () => {
  it('accepts a correct, complete circuit', () => {
    expect(validateReference(seriesLed(), BOM)).toEqual([])
  })

  it('refuses an empty board — jumpers alone are not a circuit', () => {
    expect(validateReference([part('w1', 'jumper', ['T2', 'U2r0'], 'jumper')], BOM)).toEqual([
      { reason: 'empty_board', labels: [] },
    ])
  })

  it('refuses a rail short, naming the wire that causes it', () => {
    const issues = validateReference([...seriesLed(), part('w9', 'jumper', ['T17', 'B17'], 'jumper')], BOM)
    expect(issues).toContainEqual({ reason: 'short_circuit', labels: ['W4'] })
  })

  it('refuses an unprotected LED as a short', () => {
    const parts = [
      part('d1', 'led', ['T4', 'B4'], 'led-red'),
      part('r1', 'resistor', ['U9r0', 'U12r0'], 'r-220'),
    ]
    const issues = validateReference(parts, BOM)
    expect(issues.find((issue) => issue.reason === 'short_circuit')?.labels).toEqual(['D1'])
  })

  it('refuses a part hanging off nothing', () => {
    const issues = validateReference([...seriesLed().filter((p) => p.id !== 'w1')], BOM)
    expect(issues.map((issue) => issue.reason)).toContain('floating_lead')
  })

  it('refuses a board that leaves a tray part unused, but not an unused jumper', () => {
    const issues = validateReference(
      seriesLed().filter((p) => p.id !== 'd1'),
      BOM,
    )
    expect(issues).toContainEqual({ reason: 'unused_bom_component', labels: ['Indicator LED'] })
    // The fourth jumper in the tray is never required.
    expect(validateReference(seriesLed(), BOM).some((issue) => issue.reason === 'unused_bom_component')).toBe(
      false,
    )
  })
})
