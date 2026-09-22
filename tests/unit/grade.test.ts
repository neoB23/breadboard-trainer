import { describe, expect, it } from 'vitest'

import { seriesLedBoard, shiftBoard } from '../../api/db/reference-boards.ts'
import { gradeSubmission } from '../../api/grading/submit.ts'
import { parseBoardState, serializeBoard, type PlacedPart } from '../../src/board/model.ts'
import { buildGoldenNetlist } from '../../src/board/netlist.ts'
import type { Bom } from '../../shared/contracts/index.ts'

/**
 * The auto score, end to end from a board: the four lines, the numbers each
 * mistake costs, and the two promises the grade makes — the same board always
 * scores the same, and fixing something never lowers the mark.
 */

const BOM: Bom = [
  { id: 'r-220', type: 'resistor', label: 'Current-limiting resistor', value: '220Ω', quantity: 1 },
  { id: 'led-red', type: 'led', label: 'Indicator LED', value: 'Red 2V', quantity: 1 },
  { id: 'jumper', type: 'jumper', label: 'Jumper wire', value: null, quantity: 4 },
]

const GOLDEN = buildGoldenNetlist(parseBoardState(serializeBoard(seriesLedBoard()), BOM))

function score(board: PlacedPart[]) {
  const judged = gradeSubmission(serializeBoard(board), BOM, GOLDEN)
  if (judged.graded === null) throw new Error('expected a graded submission')
  return judged.graded
}

function lines(board: PlacedPart[]): Record<string, number> {
  return Object.fromEntries(score(board).grade.lines.map((line) => [line.id, line.earned]))
}

const student = () => shiftBoard(seriesLedBoard(), 3)

describe('the auto score', () => {
  it('gives the reference, built elsewhere, full marks and nothing to fix', () => {
    const graded = score(student())
    expect(graded.grade.score).toBe(100)
    expect(graded.findings).toEqual([])
  })

  it('costs a missing ground wire a third of the circuit line: 77', () => {
    const graded = score(student().filter((p) => p.id !== 'stu-w3'))
    expect(lines(student().filter((p) => p.id !== 'stu-w3'))).toEqual({
      circuit: 47,
      parts: 10,
      polarity: 10,
      safety: 10,
    })
    expect(graded.grade.score).toBe(77)
    expect(graded.findings[0]?.kind).toBe('missing_link')
    expect(graded.findings[0]?.endpoints).toEqual([
      { kind: 'pin', ref: 'D1', pin: 'K', column: 16 },
      { kind: 'rail', rail: 'gnd' },
    ])
  })

  it('keeps a reversed LED’s circuit credit and takes its polarity point', () => {
    const reversed = student().map((p) => (p.id === 'stu-d1' ? { ...p, holes: [...p.holes].reverse() } : p))
    expect(lines(reversed)).toEqual({ circuit: 70, parts: 10, polarity: 0, safety: 10 })
    expect(score(reversed).findings.map((finding) => finding.kind)).toEqual(['polarity'])
  })

  it('takes every safety point for a rail short and reports the short first', () => {
    const shorted = [
      ...student(),
      {
        id: 'x',
        bomItemId: 'jumper',
        type: 'jumper' as const,
        label: null,
        value: null,
        holes: ['T18', 'B18'],
      },
    ]
    const graded = score(shorted)
    expect(lines(shorted).safety).toBe(0)
    expect(graded.findings[0]?.kind).toBe('rail_short')
    // The short is not reported a second time as an extra join between the rails.
    expect(graded.findings.filter((finding) => finding.kind === 'extra_link')).toEqual([])
  })

  it('scores an empty board zero on every line', () => {
    expect(lines([])).toEqual({ circuit: 0, parts: 0, polarity: 0, safety: 0 })
  })

  it('reports a part left in the tray by its tray label', () => {
    const graded = score(student().filter((p) => p.id !== 'stu-r1'))
    expect(graded.findings.find((finding) => finding.kind === 'missing_part')?.params['part']).toBe(
      'Current-limiting resistor (220Ω)',
    )
  })

  it('never returns more than three findings', () => {
    const graded = score(
      student()
        .filter((p) => p.type !== 'jumper')
        .map((p) => (p.id === 'stu-d1' ? { ...p, holes: [...p.holes].reverse() } : p)),
    )
    expect(graded.findings.length).toBeLessThanOrEqual(3)
    expect(graded.findings.map((finding) => finding.id)).toEqual(graded.findings.map((_, i) => `f${i + 1}`))
  })

  it('is byte-identical for the same board', () => {
    const board = student().filter((p) => p.id !== 'stu-w2')
    expect(JSON.stringify(score(board))).toBe(JSON.stringify(score(board)))
  })

  it('never goes down as the reference wires go back in', () => {
    const wires = student().filter((p) => p.type === 'jumper')
    const board = student().filter((p) => p.type !== 'jumper')
    let previous = score(board).grade.score
    for (const wire of wires) {
      board.push(wire)
      const now = score(board).grade.score
      expect(now).toBeGreaterThanOrEqual(previous)
      previous = now
    }
    expect(previous).toBe(100)
  })

  it('does not grade against the pre-comparator placeholder', () => {
    const judged = gradeSubmission(serializeBoard(student()), BOM, { version: 1, placeholder: true })
    expect(judged.graded).toBeNull()
    // Still judged complete: the spare fourth jumper is a budget, not a requirement.
    expect(judged.completed).toBe(true)
  })
})
