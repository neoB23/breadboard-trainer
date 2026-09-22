import {
  FINDING_FOCUS_ORDER,
  MAX_FINDINGS,
  type Finding,
  type FindingEndpoint,
  type FindingKind,
} from '../../shared/contracts/index.ts'
import type { Comparison, Endpoint } from '../../src/board/compare.ts'
import { parseHole, type PlacedPart } from '../../src/board/model.ts'
import type { BoardAnalysis } from '../../src/board/nets.ts'

/**
 * What the student should look at first, after they hand in.
 *
 * Each finding speaks in the student's own terms — their refs, their columns —
 * and never in the reference's, so it points at *their* board rather than
 * describing the answer key. At most three are returned: a list of twelve
 * problems is a verdict, and three is something to act on. Fixing the first
 * one usually changes what the rest would have said anyway.
 *
 * A rail short also shows up in the comparator as an extra join between the
 * rails; it is reported once, as the short, because that is the version of
 * the sentence that tells a student why it matters.
 */

type Candidate = Omit<Finding, 'id'>

export function buildFindings(
  parts: readonly PlacedPart[],
  analysis: BoardAnalysis,
  comparison: Comparison | null,
): Finding[] {
  const byId = new Map(parts.map((part) => [part.id, part]))
  const refOf = (partId: string) => analysis.refs.get(partId) ?? '?'
  const partByRef = new Map(parts.map((part) => [analysis.refs.get(part.id) ?? '', part]))

  const columnsOfParts = (refs: readonly string[]): number[] => {
    const columns = new Set<number>()
    for (const ref of refs) {
      const part = partByRef.get(ref)
      if (!part) continue
      for (const holeId of part.holes) {
        const hole = parseHole(holeId)
        if (hole !== null) columns.add(hole.column + 1)
      }
    }
    return [...columns].sort((a, b) => a - b)
  }

  const endpointView = (endpoint: Endpoint): FindingEndpoint | null => {
    if (endpoint.kind === 'rail') return { kind: 'rail', rail: endpoint.rail }
    const part = byId.get(endpoint.partId)
    if (!part) return null
    const hole = parseHole(part.holes[endpoint.pinIndex] ?? '')
    if (hole === null) return null
    return {
      kind: 'pin',
      ref: refOf(part.id),
      pin: pinLabel(part, endpoint.pinIndex),
      column: hole.column + 1,
    }
  }

  const linkCandidate = (kind: FindingKind, a: Endpoint, b: Endpoint): Candidate | null => {
    const endpoints = [endpointView(a), endpointView(b)].filter(
      (endpoint): endpoint is FindingEndpoint => endpoint !== null,
    )
    if (endpoints.length !== 2) return null
    const refs = endpoints.flatMap((endpoint) => (endpoint.kind === 'pin' ? [endpoint.ref] : []))
    const columns = endpoints
      .flatMap((endpoint) => (endpoint.kind === 'pin' ? [endpoint.column] : []))
      .sort((x, y) => x - y)
    return { kind, refs, columns: [...new Set(columns)], endpoints, params: {} }
  }

  const candidates: Candidate[] = []

  /* ---- safety, from the board alone ----------------------------------- */

  const railShort = analysis.warnings.find((warning) => warning.kind === 'rail-short')
  if (railShort) {
    candidates.push({
      kind: 'rail_short',
      refs: railShort.refs,
      columns: columnsOfParts(railShort.refs),
      endpoints: [
        { kind: 'rail', rail: 'vcc' },
        { kind: 'rail', rail: 'gnd' },
      ],
      params: {},
    })
  }

  for (const warning of analysis.warnings) {
    if (warning.kind !== 'led-direct') continue
    candidates.push({
      kind: 'led_unprotected',
      refs: warning.refs,
      columns: columnsOfParts(warning.refs),
      endpoints: [],
      params: {},
    })
  }

  /* ---- against the reference ------------------------------------------ */

  if (comparison !== null) {
    for (const missing of comparison.missingParts) {
      const label = missing.label ?? missing.type
      candidates.push({
        kind: 'missing_part',
        refs: [],
        columns: [],
        endpoints: [],
        params: {
          part: missing.value ? `${label} (${missing.value})` : label,
          type: missing.type,
          value: missing.value ?? '',
        },
      })
    }

    for (const link of comparison.missingLinks) {
      // Lead with the student's own leg — "follow D1.K" — and point it at the
      // rail, rather than asking them to follow a rail that runs everywhere.
      const [a, b] = link.a.kind === 'rail' && link.b.kind === 'pin' ? [link.b, link.a] : [link.a, link.b]
      const candidate = linkCandidate('missing_link', a, b)
      if (candidate) candidates.push(candidate)
    }

    for (const link of comparison.extraLinks) {
      const railToRail = link.a.kind === 'rail' && link.b.kind === 'rail'
      if (railToRail && railShort) continue
      const candidate = linkCandidate('extra_link', link.a, link.b)
      if (candidate) candidates.push(candidate)
    }

    for (const reversed of comparison.reversed) {
      const ref = refOf(reversed.studentPartId)
      candidates.push({
        kind: 'polarity',
        refs: [ref],
        columns: columnsOfParts([ref]),
        endpoints: [],
        params: { type: reversed.type },
      })
    }

    for (const wrong of comparison.wrongValues) {
      const ref = refOf(wrong.studentPartId)
      candidates.push({
        kind: 'wrong_value',
        refs: [ref],
        columns: columnsOfParts([ref]),
        endpoints: [],
        params: { expected: wrong.expected ?? '', actual: wrong.actual ?? '' },
      })
    }
  }

  const rank = (kind: FindingKind) => FINDING_FOCUS_ORDER.indexOf(kind)
  const firstColumn = (candidate: Candidate) => candidate.columns[0] ?? Number.MAX_SAFE_INTEGER

  return candidates
    .map((candidate, order) => ({ candidate, order }))
    .sort(
      (a, b) =>
        rank(a.candidate.kind) - rank(b.candidate.kind) ||
        firstColumn(a.candidate) - firstColumn(b.candidate) ||
        a.order - b.order,
    )
    .slice(0, MAX_FINDINGS)
    .map(({ candidate }, index) => ({ id: `f${index + 1}`, ...candidate }))
}

/** `A`/`K` for a diode or LED, `C`/`B`/`E` for a transistor, `1`/`2` otherwise. */
export function pinLabel(part: PlacedPart, pinIndex: number): string {
  if (part.type === 'led' || part.type === 'diode') return pinIndex === 0 ? 'A' : 'K'
  if (part.type === 'transistor') return ['C', 'B', 'E'][pinIndex] ?? String(pinIndex + 1)
  return String(pinIndex + 1)
}
