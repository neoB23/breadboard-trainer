import type { ComponentType } from '@shared/contracts'

import {
  compareText,
  isPolar,
  normaliseValue,
  refineColours,
  type CanonNetlist,
  type PinRole,
  type Rail,
} from './netlist.ts'

/**
 * The comparator — how much of the instructor's circuit the student built.
 *
 * ---------------------------------------------------------------------------
 * WHAT A "CONNECTION" IS
 *
 * A reference net with k members (component pins, plus its rail if it sits on
 * one) takes k − 1 links to form — a spanning count, not pin pairs, so a big
 * ground net does not outweigh the rest of the circuit. Under a mapping of the
 * student's parts onto the reference's, every reference pin lands on some
 * student net, and:
 *
 *   required = Σ_R (|R| − 1)
 *   matched  = Σ_R Σ_S max(0, |R ∩ S| − 1)     how much of each net is joined
 *   extra    = Σ_S (labels(S) − 1)             merges the reference does not have
 *   ratio    = clamp(0, 1, (matched − extra) / required)
 *
 * labels(S) is the set of distinct reference nets among a student net's
 * members, where a student pin that maps to nothing counts as its own label.
 * A rail short therefore costs `extra`, and so does an extra part wired in.
 *
 * The metric has one property worth relying on: joining two student nets
 * whose label sets share s reference nets changes (matched − extra) by exactly
 * 2s − 1. A wire that completes part of a reference net scores at least +1; a
 * wire between unrelated nets scores exactly −1. Scores move the right way by
 * construction, which is what the grader's monotonicity promise stands on.
 *
 * ---------------------------------------------------------------------------
 * THE SEARCH
 *
 * The best mapping is found exactly: depth-first over reference components,
 * trying every same-type student part and every pin permutation, pruning with
 * an upper bound (each undecided reference pin can add at most one link, and
 * `extra` never shrinks as pins are assigned). The objective is lexicographic
 * — topology first, then right values, then fewest reversed parts — so a
 * swapped pair of resistor values keeps full circuit credit and loses marks on
 * the parts line instead, and each rubric line judges one thing.
 *
 * The search is bounded by a node budget counted in steps, never in time, so
 * it is deterministic on every machine. No seeded circuit comes near it. If a
 * board ever does, the best mapping found so far is returned with
 * `truncated: true`.
 * ---------------------------------------------------------------------------
 */

export const MAX_SEARCH_NODES = 200_000

export type Endpoint = { kind: 'rail'; rail: Rail } | { kind: 'pin'; partId: string; pinIndex: number }

export interface ComponentMatch {
  refKey: string
  studentPartId: string | null
  /** For each reference pin, the student's hole index it landed on. Empty when unplaced. */
  pins: number[]
}

export interface Comparison {
  required: number
  matched: number
  extra: number
  ratio: number
  truncated: boolean
  /** Search nodes visited — for logs, never for scoring. */
  searched: number
  mapping: ComponentMatch[]
  missingParts: { refKey: string; type: ComponentType; value: string | null; label: string | null }[]
  /** Joins the reference has and the student's board does not, in the student's own terms. */
  missingLinks: { a: Endpoint; b: Endpoint }[]
  /** Joins the student made that the reference does not have. */
  extraLinks: { a: Endpoint; b: Endpoint }[]
  wrongValues: { studentPartId: string; expected: string | null; actual: string | null }[]
  reversed: { studentPartId: string; type: ComponentType }[]
  /** Reference parts matched to a student part of the right value. */
  rightParts: number
  referenceParts: number
  /** Polar reference parts placed the right way round *and* wired into the circuit. */
  orientedPolar: number
  polarTotal: number
}

export interface CompareOptions {
  maxNodes?: number
}

/* -------------------------------------------------------------------------- */
/* Preparation                                                                */
/* -------------------------------------------------------------------------- */

interface PreparedSide {
  keys: string[]
  partIds: string[]
  types: ComponentType[]
  values: (string | null)[]
  displayValues: (string | null)[]
  labels: (string | null)[]
  holeIndex: number[][]
  /** Net index per canonical pin. */
  pinNets: number[][]
  nets: { rails: Rail[]; members: { comp: number; pin: number }[] }[]
  netOfRail: Map<Rail, number>
  colours: string[]
}

function prepare(netlist: CanonNetlist): PreparedSide {
  const indexOfKey = new Map<string, number>()
  netlist.components.forEach((component, index) => indexOfKey.set(component.key, index))

  const pinNets: number[][] = netlist.components.map((component) => component.pins.map(() => -1))
  const nets: PreparedSide['nets'] = []
  const netOfRail = new Map<Rail, number>()

  netlist.nets.forEach((net) => {
    const index = nets.length
    const members: { comp: number; pin: number }[] = []
    for (const member of net.members) {
      const dot = member.lastIndexOf('.')
      const comp = indexOfKey.get(member.slice(0, dot))
      if (comp === undefined) continue
      const role = member.slice(dot + 1) as PinRole
      const pin = netlist.components[comp]?.pins.indexOf(role) ?? -1
      const row = pinNets[comp]
      if (pin < 0 || row === undefined || row[pin] !== -1) continue
      row[pin] = index
      members.push({ comp, pin })
    }
    nets.push({ rails: [...net.rails], members })
    for (const rail of net.rails) if (!netOfRail.has(rail)) netOfRail.set(rail, index)
  })

  // A pin the stored netlist forgot still has to be somewhere: give it a net of
  // its own, so a malformed row costs that pin, not the whole comparison.
  pinNets.forEach((row, comp) => {
    row.forEach((net, pin) => {
      if (net !== -1) return
      row[pin] = nets.length
      nets.push({ rails: [], members: [{ comp, pin }] })
    })
  })

  const values = netlist.components.map((component) => normaliseValue(component.value))
  const netRails = nets.map((net) => net.rails)
  const colours = refineColours(
    netlist.components.map((component, index) => ({
      type: component.type,
      value: values[index] ?? null,
      roles: component.pins,
      nets: pinNets[index] ?? [],
    })),
    netRails,
  ).components

  return {
    keys: netlist.components.map((component) => component.key),
    partIds: netlist.components.map((component) => component.partId),
    types: netlist.components.map((component) => component.type),
    values,
    displayValues: netlist.components.map((component) => component.value),
    labels: netlist.components.map((component) => component.label),
    holeIndex: netlist.components.map((component) => component.holeIndex),
    pinNets,
    nets,
    netOfRail,
    colours,
  }
}

const PERMUTATIONS: Record<number, number[][]> = {
  1: [[0]],
  2: [
    [0, 1],
    [1, 0],
  ],
  3: [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ],
}

function isIdentity(perm: readonly number[]): boolean {
  return perm.every((value, index) => value === index)
}

/* -------------------------------------------------------------------------- */
/* The comparison                                                             */
/* -------------------------------------------------------------------------- */

/** Weights of the lexicographic objective. Values and reversals are each ≤ 64. */
const TOPOLOGY_WEIGHT = 16_384
const VALUE_WEIGHT = 128

export function compareNetlists(
  referenceNetlist: CanonNetlist,
  studentNetlist: CanonNetlist,
  options: CompareOptions = {},
): Comparison {
  const maxNodes = options.maxNodes ?? MAX_SEARCH_NODES
  const ref = prepare(referenceNetlist)
  const stu = prepare(studentNetlist)

  const refCount = ref.types.length
  const stuCount = stu.types.length
  const refNetCount = ref.nets.length

  const required = ref.nets.reduce(
    (sum, net) => sum + Math.max(0, net.members.length + net.rails.length - 1),
    0,
  )

  /* ---- search state ------------------------------------------------------ */

  /** Student component → reference component, or −1. */
  const mappedTo = new Array<number>(stuCount).fill(-1)
  /** Student component → (student pin → reference pin). */
  const inverse: (number[] | null)[] = new Array<number[] | null>(stuCount).fill(null)
  /** Reference component → student component, −1 for unplaced, −2 undecided. */
  const assigned = new Array<number>(refCount).fill(-2)
  const permOfRef: (number[] | null)[] = new Array<number[] | null>(refCount).fill(null)

  const typeCount = (types: readonly ComponentType[]) => {
    const counts = new Map<ComponentType, number>()
    for (const type of types) counts.set(type, (counts.get(type) ?? 0) + 1)
    return counts
  }
  const refTypes = typeCount(ref.types)
  const stuTypes = typeCount(stu.types)
  const nullsLeft = new Map<ComponentType, number>()
  for (const [type, count] of refTypes) nullsLeft.set(type, Math.max(0, count - (stuTypes.get(type) ?? 0)))

  // Candidates per reference component: same type, structurally similar first.
  const candidates: number[][] = ref.types.map((type, i) =>
    stu.types
      .map((stuType, k) => ({ stuType, k }))
      .filter(({ stuType }) => stuType === type)
      .map(({ k }) => k)
      .sort((a, b) => {
        const colourA = stu.colours[a] === ref.colours[i] ? 0 : 1
        const colourB = stu.colours[b] === ref.colours[i] ? 0 : 1
        const valueA = stu.values[a] === ref.values[i] ? 0 : 1
        const valueB = stu.values[b] === ref.values[i] ? 0 : 1
        return colourA - colourB || valueA - valueB || a - b
      }),
  )

  const pinsFrom: number[] = new Array<number>(refCount + 1).fill(0)
  for (let i = refCount - 1; i >= 0; i -= 1)
    pinsFrom[i] = (pinsFrom[i + 1] ?? 0) + (ref.pinNets[i]?.length ?? 0)

  /* ---- evaluation --------------------------------------------------------- */

  const counts = new Map<number, number>()

  /**
   * (matched, extra) for the current assignment. `partial` leaves undecided
   * student parts out entirely, which is what keeps the bound valid; the full
   * evaluation gives every unmapped student pin a label of its own.
   */
  const evaluate = (partial: boolean): { matched: number; extra: number } => {
    let matched = 0
    let extra = 0
    let unique = refNetCount

    for (const net of stu.nets) {
      counts.clear()
      const bump = (label: number) => counts.set(label, (counts.get(label) ?? 0) + 1)

      for (const rail of net.rails) bump(ref.netOfRail.get(rail) ?? unique++)

      for (const { comp, pin } of net.members) {
        const i = mappedTo[comp] ?? -1
        if (i >= 0) {
          const j = inverse[comp]?.[pin] ?? -1
          bump(ref.pinNets[i]?.[j] ?? unique++)
        } else if (!partial) {
          bump(unique++)
        }
      }

      if (counts.size > 0) extra += counts.size - 1
      for (const [label, count] of counts) if (label < refNetCount) matched += count - 1
    }

    return { matched, extra }
  }

  /* ---- depth-first search ------------------------------------------------- */

  let best = Number.NEGATIVE_INFINITY
  let bestAssigned: number[] = []
  let bestPerms: (number[] | null)[] = []
  let searched = 0
  let truncated = false
  let valueMatches = 0
  let reversals = 0

  const visit = (depth: number): void => {
    searched += 1
    if (searched > maxNodes && best !== Number.NEGATIVE_INFINITY) {
      truncated = true
      return
    }

    if (depth === refCount) {
      const { matched, extra } = evaluate(false)
      const objective = (matched - extra) * TOPOLOGY_WEIGHT + valueMatches * VALUE_WEIGHT - reversals
      if (objective > best) {
        best = objective
        bestAssigned = [...assigned]
        bestPerms = permOfRef.map((perm) => (perm === null ? null : [...perm]))
      }
      return
    }

    if (best !== Number.NEGATIVE_INFINITY) {
      const { matched, extra } = evaluate(true)
      const bound =
        (matched + (pinsFrom[depth] ?? 0) - extra) * TOPOLOGY_WEIGHT +
        (valueMatches + (refCount - depth)) * VALUE_WEIGHT -
        reversals
      if (bound <= best) return
    }

    const i = depth
    const type = ref.types[i]
    if (type === undefined) return
    const pinCount = ref.pinNets[i]?.length ?? 0
    const perms = PERMUTATIONS[pinCount] ?? [[...Array(pinCount).keys()]]

    for (const k of candidates[i] ?? []) {
      if ((mappedTo[k] ?? -1) !== -1) continue
      const valueMatch = stu.values[k] === ref.values[i] ? 1 : 0

      for (const perm of perms) {
        const flip = isPolar(type) && !isIdentity(perm) ? 1 : 0
        const inv = new Array<number>(perm.length)
        perm.forEach((studentPin, refPin) => (inv[studentPin] = refPin))

        mappedTo[k] = i
        inverse[k] = inv
        assigned[i] = k
        permOfRef[i] = perm
        valueMatches += valueMatch
        reversals += flip

        visit(depth + 1)

        valueMatches -= valueMatch
        reversals -= flip
        mappedTo[k] = -1
        inverse[k] = null
        assigned[i] = -2
        permOfRef[i] = null

        if (truncated) return
      }
    }

    const left = nullsLeft.get(type) ?? 0
    if (left > 0) {
      nullsLeft.set(type, left - 1)
      assigned[i] = -1
      visit(depth + 1)
      assigned[i] = -2
      nullsLeft.set(type, left)
    }
  }

  visit(0)

  /* ---- replay the winner and describe it ---------------------------------- */

  mappedTo.fill(-1)
  inverse.fill(null)
  bestAssigned.forEach((k, i) => {
    const perm = bestPerms[i]
    if (k < 0 || perm === null || perm === undefined) return
    const inv = new Array<number>(perm.length)
    perm.forEach((studentPin, refPin) => (inv[studentPin] = refPin))
    mappedTo[k] = i
    inverse[k] = inv
  })

  const { matched, extra } = refCount === 0 ? { matched: 0, extra: 0 } : evaluate(false)

  const ratio =
    required === 0 ? (stuCount > 0 && refCount > 0 ? 1 : 0) : clamp01((matched - extra) / required)

  /* ---- labels per student pin, for engagement and link reporting ----------- */

  const studentPinLabel: number[][] = stu.pinNets.map((row) => row.map(() => -1))
  let uniqueLabel = refNetCount
  stu.pinNets.forEach((row, k) => {
    row.forEach((_, pin) => {
      const i = mappedTo[k] ?? -1
      const j = inverse[k]?.[pin] ?? -1
      const label = i >= 0 ? (ref.pinNets[i]?.[j] ?? -1) : -1
      const target = studentPinLabel[k]
      if (target) target[pin] = label >= 0 ? label : uniqueLabel++
    })
  })

  const railLabel = new Map<Rail, number>()
  for (const rail of ['vcc', 'gnd'] as const) railLabel.set(rail, ref.netOfRail.get(rail) ?? uniqueLabel++)

  const endpointOfStudentPin = (k: number, pin: number): Endpoint => ({
    kind: 'pin',
    partId: stu.partIds[k] ?? '',
    pinIndex: stu.holeIndex[k]?.[pin] ?? pin,
  })

  // A student pin is engaged when it shares a net with another member of the
  // same reference net — the part is actually wired into the circuit.
  const engaged = new Set<number>()
  for (const net of stu.nets) {
    const perLabel = new Map<number, number>()
    for (const rail of net.rails) {
      const label = railLabel.get(rail)
      if (label !== undefined) perLabel.set(label, (perLabel.get(label) ?? 0) + 1)
    }
    for (const { comp, pin } of net.members) {
      const label = studentPinLabel[comp]?.[pin] ?? -1
      perLabel.set(label, (perLabel.get(label) ?? 0) + 1)
    }
    for (const { comp, pin } of net.members) {
      const label = studentPinLabel[comp]?.[pin] ?? -1
      if (label < refNetCount && (perLabel.get(label) ?? 0) >= 2) engaged.add(comp)
    }
  }

  /* ---- parts ------------------------------------------------------------------ */

  const mapping: ComponentMatch[] = []
  const missingParts: Comparison['missingParts'] = []
  const wrongValues: Comparison['wrongValues'] = []
  const reversed: Comparison['reversed'] = []
  let rightParts = 0
  let orientedPolar = 0
  let polarTotal = 0

  for (let i = 0; i < refCount; i += 1) {
    const type = ref.types[i] ?? 'resistor'
    const k = bestAssigned[i] ?? -1
    const perm = bestPerms[i] ?? null
    if (isPolar(type)) polarTotal += 1

    if (k < 0 || perm === null) {
      mapping.push({ refKey: ref.keys[i] ?? '', studentPartId: null, pins: [] })
      missingParts.push({
        refKey: ref.keys[i] ?? '',
        type,
        value: ref.displayValues[i] ?? null,
        label: ref.labels[i] ?? null,
      })
      continue
    }

    const partId = stu.partIds[k] ?? ''
    mapping.push({
      refKey: ref.keys[i] ?? '',
      studentPartId: partId,
      pins: perm.map((studentPin) => stu.holeIndex[k]?.[studentPin] ?? studentPin),
    })

    if (stu.values[k] === ref.values[i]) rightParts += 1
    else
      wrongValues.push({
        studentPartId: partId,
        expected: ref.displayValues[i] ?? null,
        actual: stu.displayValues[k] ?? null,
      })

    if (isPolar(type)) {
      if (!isIdentity(perm)) reversed.push({ studentPartId: partId, type })
      else if (engaged.has(k)) orientedPolar += 1
    }
  }

  /* ---- missing links ------------------------------------------------------------ */

  const stuNetOfRail = stu.netOfRail
  const missingLinks: Comparison['missingLinks'] = []

  ref.nets.forEach((refNet) => {
    interface Fragment {
      rail: Rail | null
      firstPin: { i: number; j: number } | null
      endpoint: Endpoint
    }
    const fragments = new Map<string, Fragment>()

    const add = (key: string, candidate: Fragment) => {
      const existing = fragments.get(key)
      if (existing === undefined) {
        fragments.set(key, candidate)
        return
      }
      if (existing.rail === null && candidate.rail !== null) fragments.set(key, candidate)
    }

    for (const rail of refNet.rails) {
      const m = stuNetOfRail.get(rail)
      add(m === undefined ? `rail:${rail}` : `net:${m}`, {
        rail,
        firstPin: null,
        endpoint: { kind: 'rail', rail },
      })
    }

    for (const { comp: i, pin: j } of refNet.members) {
      const k = bestAssigned[i] ?? -1
      const perm = bestPerms[i]
      if (k < 0 || !perm) continue
      const studentPin = perm[j] ?? j
      const m = stu.pinNets[k]?.[studentPin]
      if (m === undefined) continue
      const key = `net:${m}`
      const existing = fragments.get(key)
      if (existing === undefined) {
        fragments.set(key, { rail: null, firstPin: { i, j }, endpoint: endpointOfStudentPin(k, studentPin) })
      } else if (existing.rail === null && existing.firstPin !== null) {
        const current = existing.firstPin
        if (i < current.i || (i === current.i && j < current.j)) {
          fragments.set(key, {
            rail: null,
            firstPin: { i, j },
            endpoint: endpointOfStudentPin(k, studentPin),
          })
        }
      }
    }

    if (fragments.size < 2) return

    const ordered = [...fragments.values()].sort((a, b) => {
      const railA = a.rail === null ? 2 : a.rail === 'vcc' ? 0 : 1
      const railB = b.rail === null ? 2 : b.rail === 'vcc' ? 0 : 1
      if (railA !== railB) return railA - railB
      const pinA = a.firstPin ?? { i: -1, j: -1 }
      const pinB = b.firstPin ?? { i: -1, j: -1 }
      return pinA.i - pinB.i || pinA.j - pinB.j
    })

    const [anchor, ...rest] = ordered
    if (anchor === undefined) return
    for (const fragment of rest) missingLinks.push({ a: anchor.endpoint, b: fragment.endpoint })
  })

  /* ---- extra links ---------------------------------------------------------------- */

  const extraLinks: Comparison['extraLinks'] = []

  for (const net of stu.nets) {
    interface Group {
      rail: Rail | null
      order: number
      endpoint: Endpoint
    }
    const groups = new Map<number, Group>()

    for (const rail of net.rails) {
      const label = railLabel.get(rail) ?? -1
      const existing = groups.get(label)
      if (existing === undefined || existing.rail === null) {
        groups.set(label, { rail, order: -1, endpoint: { kind: 'rail', rail } })
      }
    }

    for (const { comp, pin } of net.members) {
      const label = studentPinLabel[comp]?.[pin] ?? -1
      const order = comp * 8 + pin
      const existing = groups.get(label)
      if (existing === undefined) {
        groups.set(label, { rail: null, order, endpoint: endpointOfStudentPin(comp, pin) })
      } else if (existing.rail === null && order < existing.order) {
        groups.set(label, { rail: null, order, endpoint: endpointOfStudentPin(comp, pin) })
      }
    }

    if (groups.size < 2) continue

    const ordered = [...groups.values()].sort((a, b) => {
      const railA = a.rail === null ? 2 : a.rail === 'vcc' ? 0 : 1
      const railB = b.rail === null ? 2 : b.rail === 'vcc' ? 0 : 1
      return railA - railB || a.order - b.order
    })

    const [anchor, ...rest] = ordered
    if (anchor === undefined) continue
    for (const group of rest) extraLinks.push({ a: anchor.endpoint, b: group.endpoint })
  }

  return {
    required,
    matched,
    extra,
    ratio,
    truncated,
    searched,
    mapping,
    missingParts,
    missingLinks,
    extraLinks,
    wrongValues,
    reversed: reversed.sort((a, b) => compareText(a.studentPartId, b.studentPartId)),
    rightParts,
    referenceParts: refCount,
    orientedPolar,
    polarTotal,
  }
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.min(1, Math.max(0, value))
}
