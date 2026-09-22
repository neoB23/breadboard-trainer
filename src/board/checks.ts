import type { Bom } from '@shared/contracts'

import { parseHole, pinCountFor, remainingFor, type PlacedPart } from './model.ts'
import type { BoardAnalysis } from './nets.ts'

/**
 * The test run — what "Test the circuit" actually does.
 *
 * Each check is a sentence a lab instructor would say while leaning over the
 * board, and a failed one carries *where*: the refs involved and the columns
 * they sit at, so the report can point at the board instead of shrugging. The
 * score is the share of checks passed — a formative number, computed the same
 * way every time, which is what makes it fair.
 *
 * Everything here derives from `BoardAnalysis`; this module adds no new
 * electrical judgement, only the rubric. The same honesty note applies as in
 * `nets.ts`: these are connectivity checks, not a simulation — the solver that
 * measures voltages is Phase 16, and this rubric is built to be extended by
 * it, not replaced.
 */

export type CheckId = 'parts-placed' | 'no-shorts' | 'all-connected' | 'leds-light' | 'led-protected'

export interface CheckResult {
  id: CheckId
  ok: boolean
  /** Refs — R1, D1 — or tray labels involved when the check fails. */
  refs: string[]
  /** 1-based board columns where the trouble is, for pointing at the board. */
  columns: number[]
}

export interface TestReport {
  /** 0–100. Passed checks over applicable checks. */
  score: number
  passed: number
  total: number
  checks: CheckResult[]
}

export interface CheckOptions {
  /**
   * Free build has no bill of materials to finish — the tray is a shelf, not
   * a budget — so the completeness check does not apply there.
   */
  requireBom?: boolean
}

export function runChecks(
  parts: readonly PlacedPart[],
  bom: Bom,
  analysis: BoardAnalysis,
  options: CheckOptions = {},
): TestReport {
  const { requireBom = true } = options
  const checks: CheckResult[] = []

  /* ---- every part out of the tray ---------------------------------------- */

  if (requireBom) {
    const placeable = bom.filter((item) => pinCountFor(item.type) !== null)
    const remaining = remainingFor(placeable, parts)
    const missing = placeable.filter((item) => (remaining.get(item.id) ?? 0) > 0)
    checks.push({
      id: 'parts-placed',
      ok: missing.length === 0,
      refs: missing.map((item) => item.label ?? item.type),
      columns: [],
    })
  }

  /* ---- the rails are not shorted ------------------------------------------ */

  const short = analysis.warnings.find((warning) => warning.kind === 'rail-short')
  checks.push({
    id: 'no-shorts',
    ok: short === undefined,
    refs: short?.refs ?? [],
    columns:
      short === undefined
        ? []
        : columnsOf(parts.filter((part) => short.refs.includes(analysis.refs.get(part.id) ?? ''))),
  })

  /* ---- nothing floating ---------------------------------------------------- */

  const floating = parts.filter((part) => analysis.floating.has(part.id))
  checks.push({
    id: 'all-connected',
    ok: floating.length === 0,
    refs: floating.map((part) => analysis.refs.get(part.id) ?? part.type),
    columns: columnsOf(floating),
  })

  /* ---- every LED lights, safely ------------------------------------------- */

  const leds = parts.filter((part) => part.type === 'led')
  if (leds.length > 0 || bomWantsLed(bom, requireBom)) {
    const dark = leds.filter((led) => !analysis.litLeds.has(led.id))
    checks.push({
      id: 'leds-light',
      // An LED still in the tray cannot light; the check owns that case too,
      // so a bare board does not score a free pass on the exercise's point.
      ok: leds.length > 0 && dark.length === 0,
      refs: dark.map((led) => analysis.refs.get(led.id) ?? 'LED'),
      columns: columnsOf(dark),
    })

    const direct = analysis.warnings.filter((warning) => warning.kind === 'led-direct')
    checks.push({
      id: 'led-protected',
      ok: direct.length === 0,
      refs: direct.flatMap((warning) => warning.refs),
      columns: columnsOf(
        leds.filter((led) =>
          direct.some((warning) => warning.refs.includes(analysis.refs.get(led.id) ?? '')),
        ),
      ),
    })
  }

  const passed = checks.filter((check) => check.ok).length
  const total = checks.length

  return {
    score: total === 0 ? 0 : Math.round((passed / total) * 100),
    passed,
    total,
    checks,
  }
}

function bomWantsLed(bom: Bom, requireBom: boolean): boolean {
  return requireBom && bom.some((item) => item.type === 'led')
}

function columnsOf(parts: readonly PlacedPart[]): number[] {
  const columns = new Set<number>()
  for (const part of parts) {
    for (const holeId of part.holes) {
      const hole = parseHole(holeId)
      if (hole !== null) columns.add(hole.column + 1)
    }
  }
  return [...columns].sort((a, b) => a - b)
}
