import type { Grade, GradeLine } from '../../shared/contracts/index.ts'
import type { Comparison } from '../../src/board/compare.ts'

/**
 * The auto score: a pure function of what the comparator found and what the
 * safety checks saw. No database, no network, no clock — everything arrives
 * as arguments, which is what makes the same board score byte-identically
 * every time and a disputed grade reproducible on demand.
 *
 * | Line     | Points | From                                                       |
 * |----------|--------|------------------------------------------------------------|
 * | circuit  |   70   | the comparator's link ratio against the reference          |
 * | parts    |   10   | reference parts matched to a student part of the same value |
 * | polarity |   10   | polar parts the right way round and wired in               |
 * | safety   |   10   | no rail short (−10), no unprotected LED (−5 each)          |
 *
 * The lines are independent on purpose. A reversed LED keeps its circuit
 * credit and loses its polarity point; swapped resistor values keep the
 * circuit and lose the parts points. A student reading the breakdown should
 * be able to tell what went wrong from which line moved.
 *
 * An empty board scores zero on every line. Nothing built means nothing
 * safe to credit, either.
 */

export interface SafetyReport {
  railShort: boolean
  /** Refs of LEDs with nothing limiting their current. */
  unprotectedLeds: string[]
}

export interface GradeInput {
  comparison: Comparison
  safety: SafetyReport
  /** Components on the student's board (jumpers excluded). */
  placedComponents: number
}

const CIRCUIT_POINTS = 70
const PARTS_POINTS = 10
const POLARITY_POINTS = 10
const SAFETY_POINTS = 10

export function grade({ comparison, safety, placedComponents }: GradeInput): Grade {
  const empty = placedComponents === 0
  const lines: GradeLine[] = [
    circuitLine(comparison, empty),
    partsLine(comparison, empty),
    polarityLine(comparison, empty),
    safetyLine(safety, empty),
  ]
  const score = Math.min(
    100,
    lines.reduce((sum, line) => sum + line.earned, 0),
  )
  return { score, max: 100, lines }
}

function circuitLine(comparison: Comparison, empty: boolean): GradeLine {
  const earned = empty ? 0 : Math.round(CIRCUIT_POINTS * comparison.ratio)
  const code =
    earned === CIRCUIT_POINTS
      ? 'grade.circuit.full'
      : earned === 0
        ? 'grade.circuit.none'
        : 'grade.circuit.partial'
  return {
    id: 'circuit',
    earned,
    possible: CIRCUIT_POINTS,
    reason: {
      code,
      params: {
        linked: Math.max(0, comparison.matched - comparison.extra),
        total: comparison.required,
        extra: comparison.extra,
      },
    },
  }
}

function partsLine(comparison: Comparison, empty: boolean): GradeLine {
  const total = comparison.referenceParts
  const right = comparison.rightParts
  const earned = empty || total === 0 ? 0 : Math.round((PARTS_POINTS * right) / total)
  const missing = comparison.missingParts.length
  const wrongValue = comparison.wrongValues.length
  const code =
    earned === PARTS_POINTS
      ? 'grade.parts.full'
      : missing > 0
        ? 'grade.parts.missing'
        : wrongValue > 0
          ? 'grade.parts.wrongValue'
          : 'grade.parts.none'
  return {
    id: 'parts',
    earned,
    possible: PARTS_POINTS,
    reason: { code, params: { right, total, missing, wrongValue } },
  }
}

function polarityLine(comparison: Comparison, empty: boolean): GradeLine {
  const total = comparison.polarTotal
  if (total === 0) {
    return {
      id: 'polarity',
      earned: empty ? 0 : POLARITY_POINTS,
      possible: POLARITY_POINTS,
      reason: { code: empty ? 'grade.polarity.empty' : 'grade.polarity.noPolarParts', params: {} },
    }
  }

  const right = comparison.orientedPolar
  const earned = empty ? 0 : Math.round((POLARITY_POINTS * right) / total)
  const reversed = comparison.reversed.length
  const code =
    earned === POLARITY_POINTS
      ? 'grade.polarity.full'
      : reversed > 0
        ? 'grade.polarity.reversed'
        : 'grade.polarity.notWired'
  return {
    id: 'polarity',
    earned,
    possible: POLARITY_POINTS,
    reason: { code, params: { right, total, reversed } },
  }
}

function safetyLine(safety: SafetyReport, empty: boolean): GradeLine {
  if (empty) {
    return {
      id: 'safety',
      earned: 0,
      possible: SAFETY_POINTS,
      reason: { code: 'grade.safety.empty', params: {} },
    }
  }

  const unprotected = [...safety.unprotectedLeds].sort()
  const earned = Math.max(0, SAFETY_POINTS - (safety.railShort ? 10 : 0) - 5 * unprotected.length)
  const code = safety.railShort
    ? 'grade.safety.railShort'
    : unprotected.length > 0
      ? 'grade.safety.unprotected'
      : 'grade.safety.full'
  return {
    id: 'safety',
    earned,
    possible: SAFETY_POINTS,
    reason: { code, params: { refs: unprotected.join(', '), count: unprotected.length } },
  }
}
