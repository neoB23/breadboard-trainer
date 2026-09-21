import { describe, expect, it } from 'vitest'

import {
  assignRefs,
  bomFullyPlaced,
  nodeOf,
  occupiedHoles,
  parseBoardState,
  parseHole,
  remainingFor,
  serializeBoard,
  type PlacedPart,
} from '../../src/board/model.ts'
import { analyseBoard } from '../../src/board/nets.ts'
import type { Bom, ComponentType } from '../../shared/contracts/index.ts'

/**
 * The board model, tested at the level the product teaches: five holes are one
 * node, the channel splits a column, a jumper bonds nets and a resistor does
 * not. Every case below is a sentence a lab instructor could say out loud.
 */

let nextId = 0

function part(type: ComponentType, holes: string[], bomItemId = `${type}-line`): PlacedPart {
  nextId += 1
  return { id: `p${nextId}`, bomItemId, type, label: null, value: null, holes }
}

const LED_CIRCUIT_BOM: Bom = [
  { id: 'r-220', type: 'resistor', label: 'Current-limiting resistor', value: '220Ω', quantity: 1 },
  { id: 'led-red', type: 'led', label: 'Indicator LED', value: 'Red 2V', quantity: 1 },
  { id: 'jumper', type: 'jumper', label: 'Jumper wire', value: null, quantity: 3 },
]

/**
 * The seeded first exercise, built correctly: +5V → jumper → resistor → LED
 * across the channel → jumper → ground. `holes[0]` of the LED is the anode.
 */
function ledCircuit(): PlacedPart[] {
  return [
    part('jumper', ['T2', 'U2r0'], 'jumper'),
    part('resistor', ['U2r1', 'U7r1'], 'r-220'),
    part('jumper', ['U7r2', 'U12r2'], 'jumper'),
    part('led', ['U12r3', 'L12r1'], 'led-red'),
    part('jumper', ['L12r4', 'B14'], 'jumper'),
  ]
}

/* -------------------------------------------------------------------------- */
/* Holes and nodes                                                            */
/* -------------------------------------------------------------------------- */

describe('holes and nodes', () => {
  it('bonds the five holes of one column half into one node', () => {
    expect(nodeOf('U4r0')).toBe('u4')
    expect(nodeOf('U4r4')).toBe('u4')
  })

  it('splits the same column across the centre channel', () => {
    expect(nodeOf('U12r4')).not.toBe(nodeOf('L12r0'))
  })

  it('makes each rail one node along its whole length', () => {
    expect(nodeOf('T0')).toBe(nodeOf('T19'))
    expect(nodeOf('B3')).toBe('gnd')
  })

  it('rejects holes that are not on the board', () => {
    expect(parseHole('U20r0')).toBeNull() // past the last column
    expect(parseHole('U4r5')).toBeNull() // past the last row
    expect(parseHole('X4r1')).toBeNull()
    expect(parseHole('')).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/* Nets                                                                       */
/* -------------------------------------------------------------------------- */

describe('net extraction', () => {
  it('a jumper bonds two nets into one; a resistor does not', () => {
    const jumperOnly = analyseBoard([part('jumper', ['U2r0', 'U7r0'])], [])
    expect(jumperOnly.netOfNode.get('u2')).toBe(jumperOnly.netOfNode.get('u7'))

    const resistorOnly = analyseBoard([part('resistor', ['U2r0', 'U7r0'])], [])
    expect(resistorOnly.netOfNode.get('u2')).not.toBe(resistorOnly.netOfNode.get('u7'))
  })

  it('names rail nets +5V and GND, and numbers the rest in board order', () => {
    const analysis = analyseBoard(ledCircuit(), LED_CIRCUIT_BOM)
    const ids = analysis.nets.map((net) => net.id)
    expect(ids).toEqual(['+5V', 'GND', 'N1'])
  })

  it('lists component pins as members, never repeating the rail id', () => {
    const analysis = analyseBoard(ledCircuit(), LED_CIRCUIT_BOM)
    const vcc = analysis.nets.find((net) => net.id === '+5V')
    // The supply jumper bonded u2 into the +5V net, so R1's first leg is on it.
    expect(vcc?.members).toContain('R1.1')
    expect(vcc?.members).not.toContain('+5V')

    const middle = analysis.nets.find((net) => net.id === 'N1')
    expect(middle?.members).toEqual(expect.arrayContaining(['R1.2', 'D1.A']))
  })
})

/* -------------------------------------------------------------------------- */
/* The payoff and the warnings                                                */
/* -------------------------------------------------------------------------- */

describe('lighting the LED', () => {
  it('lights the LED when both sides reach their rails', () => {
    const parts = ledCircuit()
    const analysis = analyseBoard(parts, LED_CIRCUIT_BOM)
    const led = parts.find((candidate) => candidate.type === 'led')
    expect(led && analysis.litLeds.has(led.id)).toBe(true)
    expect(analysis.complete).toBe(true)
  })

  it('does not light it while the ground return is missing', () => {
    const parts = ledCircuit().slice(0, 4) // no ground jumper
    const analysis = analyseBoard(parts, LED_CIRCUIT_BOM)
    expect(analysis.litLeds.size).toBe(0)
    expect(analysis.complete).toBe(false)
  })

  it('the classic fault: ground jumper on the wrong side of the channel', () => {
    const parts = ledCircuit()
    // Same column, wrong bank — exactly the landing page's fault.
    parts[4] = part('jumper', ['U14r4', 'B14'], 'jumper')
    const analysis = analyseBoard(parts, LED_CIRCUIT_BOM)
    expect(analysis.litLeds.size).toBe(0)
  })

  it('flags an LED wired straight across the rails', () => {
    const analysis = analyseBoard([part('led', ['T4', 'B4'], 'led-red')], LED_CIRCUIT_BOM)
    expect(analysis.warnings.some((warning) => warning.kind === 'led-direct')).toBe(true)
    // Lit — current would certainly flow — but never complete.
    expect(analysis.complete).toBe(false)
  })

  it('flags a jumper shorting the rails together', () => {
    const analysis = analyseBoard([part('jumper', ['T4', 'B4'])], [])
    expect(analysis.warnings.some((warning) => warning.kind === 'rail-short')).toBe(true)
  })

  it('marks a part no rail can reach as floating', () => {
    const analysis = analyseBoard([part('resistor', ['U4r0', 'U9r0'])], [])
    expect(analysis.floating.size).toBe(1)
  })
})

/* -------------------------------------------------------------------------- */
/* Refs and the tray                                                          */
/* -------------------------------------------------------------------------- */

describe('reference designators', () => {
  it('numbers each family independently, in placement order', () => {
    const parts = [
      part('resistor', ['U0r0', 'U1r0']),
      part('jumper', ['U2r0', 'U3r0']),
      part('resistor', ['U4r0', 'U5r0']),
      part('led', ['U6r0', 'L6r0']),
    ]
    const refs = assignRefs(parts)
    expect([...refs.values()]).toEqual(['R1', 'W1', 'R2', 'D1'])
  })
})

describe('the tray budget', () => {
  it('counts down per BOM line and clamps at zero', () => {
    const parts = [part('jumper', ['T2', 'U2r0'], 'jumper'), part('jumper', ['U3r0', 'U4r0'], 'jumper')]
    const remaining = remainingFor(LED_CIRCUIT_BOM, parts)
    expect(remaining.get('jumper')).toBe(1)
    expect(remaining.get('r-220')).toBe(1)

    const spent = remainingFor(LED_CIRCUIT_BOM, [...parts, ...parts])
    expect(spent.get('jumper')).toBe(0)
  })

  it('is fully placed only when every line is at zero', () => {
    expect(bomFullyPlaced(LED_CIRCUIT_BOM, ledCircuit())).toBe(true)
    expect(bomFullyPlaced(LED_CIRCUIT_BOM, ledCircuit().slice(1))).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/* Round-trips — what a refresh restores                                      */
/* -------------------------------------------------------------------------- */

describe('serialisation', () => {
  it('round-trips a board exactly', () => {
    const parts = ledCircuit()
    const restored = parseBoardState(serializeBoard(parts), LED_CIRCUIT_BOM)
    expect(restored.map((p) => ({ type: p.type, holes: p.holes }))).toEqual(
      parts.map((p) => ({ type: p.type, holes: p.holes })),
    )
  })

  it('drops a malformed part without losing the rest of the board', () => {
    const snapshot = serializeBoard(ledCircuit()) as { version: 1; parts: unknown[] }
    snapshot.parts.push({ id: 'evil', bomItemId: 'x', type: 'resistor', holes: ['U99r9', 'U1r0'] })
    snapshot.parts.push('not even an object')
    expect(parseBoardState(snapshot, LED_CIRCUIT_BOM)).toHaveLength(5)
  })

  it('refuses a snapshot that seats two legs in one hole', () => {
    const snapshot = serializeBoard([
      part('resistor', ['U2r1', 'U7r1']),
      part('resistor', ['U7r1', 'U9r1']), // U7r1 taken by the first
    ])
    expect(parseBoardState(snapshot, [])).toHaveLength(1)
  })

  it('reads occupancy from every leg of every part', () => {
    expect(occupiedHoles(ledCircuit()).has('U12r3')).toBe(true)
    expect(occupiedHoles(ledCircuit()).has('U12r0')).toBe(false)
  })

  it('returns an empty board for anything unrecognisable', () => {
    expect(parseBoardState(null, [])).toEqual([])
    expect(parseBoardState({ version: 99, parts: [] }, [])).toEqual([])
    expect(parseBoardState('a string', [])).toEqual([])
  })
})
