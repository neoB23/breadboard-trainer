import { describe, expect, it } from 'vitest'

import { runChecks } from '../../src/board/checks.ts'
import { type PlacedPart } from '../../src/board/model.ts'
import { analyseBoard } from '../../src/board/nets.ts'
import type { Bom, ComponentType } from '../../shared/contracts/index.ts'

/**
 * The test rubric. The score has to be the same number for the same board
 * every time, and a failed check has to say where — refs and columns — or the
 * report is a shrug with a percentage on it.
 */

let nextId = 0

function part(type: ComponentType, holes: string[], bomItemId = `${type}-line`): PlacedPart {
  nextId += 1
  return { id: `p${nextId}`, bomItemId, type, label: null, value: null, holes }
}

const BOM: Bom = [
  { id: 'r-220', type: 'resistor', label: 'Current-limiting resistor', value: '220Ω', quantity: 1 },
  { id: 'led-red', type: 'led', label: 'Indicator LED', value: 'Red 2V', quantity: 1 },
  { id: 'jumper', type: 'jumper', label: 'Jumper wire', value: null, quantity: 3 },
]

function correctCircuit(): PlacedPart[] {
  return [
    part('jumper', ['T2', 'U2r0'], 'jumper'),
    part('resistor', ['U2r1', 'U7r1'], 'r-220'),
    part('jumper', ['U7r2', 'U12r2'], 'jumper'),
    part('led', ['U12r3', 'L12r1'], 'led-red'),
    part('jumper', ['L12r4', 'B14'], 'jumper'),
  ]
}

function report(parts: PlacedPart[], options?: { requireBom?: boolean }) {
  return runChecks(parts, BOM, analyseBoard(parts, BOM), options)
}

describe('the score', () => {
  it('is 100 for the correct circuit', () => {
    const result = report(correctCircuit())
    expect(result.score).toBe(100)
    expect(result.passed).toBe(result.total)
  })

  it('is not 100 for a bare board — and the parts check names what is missing', () => {
    const result = report([])
    expect(result.score).toBeLessThan(100)
    const partsCheck = result.checks.find((check) => check.id === 'parts-placed')
    expect(partsCheck?.ok).toBe(false)
    expect(partsCheck?.refs).toContain('Indicator LED')
  })

  it('an unlit LED fails its check and the report says which columns to look at', () => {
    const parts = correctCircuit().slice(0, 4) // no ground return
    const result = report(parts)
    const litCheck = result.checks.find((check) => check.id === 'leds-light')
    expect(litCheck?.ok).toBe(false)
    expect(litCheck?.refs).toEqual(['D1'])
    expect(litCheck?.columns).toContain(13) // column 12, 1-based
  })

  it('a rail short fails no-shorts and floats nothing else past it', () => {
    const parts = [...correctCircuit(), part('jumper', ['T16', 'B16'], 'jumper')]
    const result = report(parts)
    expect(result.checks.find((check) => check.id === 'no-shorts')?.ok).toBe(false)
    expect(result.score).toBeLessThan(100)
  })

  it('an unprotected LED fails led-protected even though it lights', () => {
    const parts = [part('led', ['T4', 'B4'], 'led-red')]
    const result = report(parts)
    expect(result.checks.find((check) => check.id === 'leds-light')?.ok).toBe(true)
    const protectedCheck = result.checks.find((check) => check.id === 'led-protected')
    expect(protectedCheck?.ok).toBe(false)
    expect(protectedCheck?.refs).toEqual(['D1'])
    expect(protectedCheck?.columns).toContain(5)
  })

  it('names only the wire that shorts the rails, not every jumper on the board', () => {
    const parts = [...correctCircuit(), part('jumper', ['T16', 'B16'], 'jumper')]
    const shortCheck = report(parts).checks.find((check) => check.id === 'no-shorts')
    expect(shortCheck?.refs).toEqual(['W4'])
    expect(shortCheck?.columns).toEqual([17])
  })

  it('flags two LEDs in series across the rails — neither has anything limiting it', () => {
    const parts = [part('led', ['T3', 'U3r0'], 'led-red'), part('led', ['U3r1', 'B3'], 'led-red')]
    const protectedCheck = report(parts, { requireBom: false }).checks.find(
      (check) => check.id === 'led-protected',
    )
    expect(protectedCheck?.ok).toBe(false)
    expect(protectedCheck?.refs).toEqual(['D1', 'D2'])
  })

  it('does not flag an LED with a resistor anywhere in its path', () => {
    const parts = [
      part('led', ['T3', 'U3r0'], 'led-red'),
      part('resistor', ['U3r1', 'U8r0'], 'r-220'),
      part('jumper', ['U8r1', 'B8'], 'jumper'),
    ]
    const protectedCheck = report(parts, { requireBom: false }).checks.find(
      (check) => check.id === 'led-protected',
    )
    expect(protectedCheck?.ok).toBe(true)
  })

  it('free build skips the bill-of-materials check but keeps the electrical ones', () => {
    const result = report([part('resistor', ['U4r0', 'U9r0'])], { requireBom: false })
    expect(result.checks.some((check) => check.id === 'parts-placed')).toBe(false)
    expect(result.checks.find((check) => check.id === 'all-connected')?.ok).toBe(false)
  })

  it('scores identical boards identically', () => {
    expect(report(correctCircuit())).toEqual(report(correctCircuit()))
  })
})
