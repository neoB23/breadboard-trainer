import type { Bom } from '@shared/contracts'

import { assignRefs, bomFullyPlaced, nodeOf, pinName, type NodeId, type PlacedPart } from './model.ts'
import { UnionFind } from './union-find.ts'

/**
 * Net extraction — the live half of what the landing page demonstrates.
 *
 * A net is a set of nodes bonded by *wire*: the clip under a column, the rail
 * strip, and every jumper the student has run. Components do not bond nets —
 * a resistor connects two nets *through itself* — which is why the maths here
 * is in two layers: a union-find over wire, then a graph of component edges
 * between the resulting nets for reachability.
 *
 * ---------------------------------------------------------------------------
 * WHAT "LIT" HONESTLY MEANS HERE
 *
 * This module decides connectivity, not conduction. An LED reads as lit when
 * its anode's net can be reached from +5V and its cathode's net can be reached
 * from ground through placed components — no Ohm's law, no operating points.
 * That is the right fidelity for a placement trainer and the wrong one for a
 * simulator, and the circuit solver that knows the difference is Phase 16's.
 * The one electrical judgement made anyway is the classic first-lab mistake:
 * an LED with nothing to limit its current gets a warning, because every
 * reference this product has would say the same. "Nothing to limit it" means
 * both of its legs reach their rails without passing through a resistor —
 * wire, other LEDs, diodes and transistors do not count as a limit, so two
 * LEDs in series across the rails are both flagged, and one behind a resistor
 * anywhere in its path is not.
 * ---------------------------------------------------------------------------
 */

/* -------------------------------------------------------------------------- */
/* Results                                                                    */
/* -------------------------------------------------------------------------- */

export interface NetRow {
  /** `+5V`, `GND`, or `N1`… in board order. */
  id: string
  /** Pin names on this net — `R1.1 · D1.A` — with the rail marker first. */
  members: string[]
  /** Every structural node the net covers. The board lights holes from this. */
  nodes: NodeId[]
}

export interface BoardWarning {
  kind: 'rail-short' | 'led-direct'
  /** Refs involved, for the message: `['W2']`, `['D1']`. */
  refs: string[]
}

export interface BoardAnalysis {
  nets: NetRow[]
  /** Display net id for every node that is on some net. */
  netOfNode: Map<NodeId, string>
  /** Net ids reachable from +5V through components — what the board lights. */
  powered: Set<string>
  /** Part ids of LEDs whose both sides reach their rails. */
  litLeds: Set<string>
  warnings: BoardWarning[]
  /** Ref for every placed part id, R1/D1/W1 style. */
  refs: Map<string, string>
  /** Parts with a pin on a net no rail can reach. Honest incompleteness. */
  floating: Set<string>
  /**
   * Every BOM line seated, nothing floating, no warnings, every LED lit.
   * What "Hand in" reports as `completed`.
   */
  complete: boolean
}

/** Lowest column a node sits at, for ordering nets the way the board reads. */
function columnOf(node: NodeId): number {
  if (node === 'vcc' || node === 'gnd') return -1
  return Number(node.slice(1))
}

/* -------------------------------------------------------------------------- */
/* The analysis                                                               */
/* -------------------------------------------------------------------------- */

export function analyseBoard(parts: readonly PlacedPart[], bom: Bom): BoardAnalysis {
  const refs = assignRefs(parts)
  const wire = new UnionFind()

  // The rails always exist, even on an empty board.
  wire.find('vcc')
  wire.find('gnd')

  const nodesInPlay = new Set<NodeId>(['vcc', 'gnd'])
  for (const part of parts) {
    for (const hole of part.holes) {
      const node = nodeOf(hole)
      if (node !== null) nodesInPlay.add(node)
    }
  }

  // Layer one: jumpers are wire, and only jumpers.
  for (const part of parts) {
    if (part.type !== 'jumper') continue
    const [a, b] = part.holes.map((hole) => nodeOf(hole))
    if (a != null && b != null) wire.union(a, b)
  }

  /* ---- name the nets ----------------------------------------------------- */

  const nodesByRoot = new Map<NodeId, NodeId[]>()
  for (const node of nodesInPlay) {
    const root = wire.find(node)
    const group = nodesByRoot.get(root)
    if (group) group.push(node)
    else nodesByRoot.set(root, [node])
  }

  const vccRoot = wire.find('vcc')
  const gndRoot = wire.find('gnd')

  const plainRoots = [...nodesByRoot.keys()]
    .filter((root) => root !== vccRoot && root !== gndRoot)
    .sort((a, b) => {
      const groupA = nodesByRoot.get(a) ?? []
      const groupB = nodesByRoot.get(b) ?? []
      return Math.min(...groupA.map(columnOf)) - Math.min(...groupB.map(columnOf))
    })

  const netIdOfRoot = new Map<NodeId, string>()
  netIdOfRoot.set(vccRoot, '+5V')
  if (gndRoot !== vccRoot) netIdOfRoot.set(gndRoot, 'GND')
  plainRoots.forEach((root, index) => netIdOfRoot.set(root, `N${index + 1}`))

  const netOfNode = new Map<NodeId, string>()
  for (const node of nodesInPlay) {
    const id = netIdOfRoot.get(wire.find(node))
    if (id !== undefined) netOfNode.set(node, id)
  }

  /* ---- members ----------------------------------------------------------- */

  const membersByNet = new Map<string, string[]>()
  const wireOnlyByNet = new Map<string, string[]>()

  const netOfPin = (part: PlacedPart, pinIndex: number): string | null => {
    const hole = part.holes[pinIndex]
    if (hole === undefined) return null
    const node = nodeOf(hole)
    return node === null ? null : (netOfNode.get(node) ?? null)
  }

  for (const part of parts) {
    const ref = refs.get(part.id) ?? part.type
    for (let pin = 0; pin < part.holes.length; pin += 1) {
      const net = netOfPin(part, pin)
      if (net === null) continue
      const bucket = part.type === 'jumper' ? wireOnlyByNet : membersByNet
      const list = bucket.get(net)
      const name = pinName(part, ref, pin)
      if (list) list.push(name)
      else bucket.set(net, [name])
    }
  }

  const nets: NetRow[] = []
  for (const [root, nodes] of nodesByRoot) {
    const id = netIdOfRoot.get(root)
    if (id === undefined) continue

    // A rail nobody has touched yet is real but silent — listing an empty +5V
    // row on a bare board would be noise before the first part lands.
    const componentMembers = membersByNet.get(id) ?? []
    const wireMembers = wireOnlyByNet.get(id) ?? []
    if (componentMembers.length === 0 && wireMembers.length === 0) continue

    // Component pins when there are any; otherwise the wire ends themselves —
    // a jumper to nowhere is exactly the kind of thing worth seeing in the
    // readout. The rail is not repeated here: the row's id column already
    // says +5V or GND.
    const members = componentMembers.length > 0 ? componentMembers : wireMembers

    nets.push({ id, members, nodes: [...nodes].sort((a, b) => columnOf(a) - columnOf(b)) })
  }

  nets.sort((a, b) => netOrder(a.id) - netOrder(b.id))

  /* ---- reachability through components ----------------------------------- */

  const edges = new Map<string, Set<string>>()
  const link = (a: string, b: string) => {
    if (a === b) return
    const forward = edges.get(a)
    if (forward) forward.add(b)
    else edges.set(a, new Set([b]))
    const backward = edges.get(b)
    if (backward) backward.add(a)
    else edges.set(b, new Set([a]))
  }

  for (const part of parts) {
    if (part.type === 'jumper') continue
    const pinNets: string[] = []
    for (let pin = 0; pin < part.holes.length; pin += 1) {
      const net = netOfPin(part, pin)
      if (net !== null) pinNets.push(net)
    }
    // Every pin pair bridged. For a transistor this is connectivity, not
    // conduction — see the module note; the solver that knows better is
    // Phase 16.
    for (let i = 0; i < pinNets.length; i += 1) {
      for (let j = i + 1; j < pinNets.length; j += 1) {
        const a = pinNets[i]
        const b = pinNets[j]
        if (a !== undefined && b !== undefined) link(a, b)
      }
    }
  }

  const reach = (start: string): Set<string> => {
    const seen = new Set<string>([start])
    const queue = [start]
    while (queue.length > 0) {
      const current = queue.pop()
      if (current === undefined) break
      for (const next of edges.get(current) ?? []) {
        if (!seen.has(next)) {
          seen.add(next)
          queue.push(next)
        }
      }
    }
    return seen
  }

  const fromVcc = reach('+5V')
  const fromGnd = reach(netOfNode.get('gnd') ?? 'GND')

  /* ---- LEDs and warnings -------------------------------------------------- */

  const litLeds = new Set<string>()
  const warnings: BoardWarning[] = []

  if (wire.joined('vcc', 'gnd')) {
    warnings.push({ kind: 'rail-short', refs: shortingJumpers(parts, refs) })
  }

  // Current flows through wire and the semiconductors without being limited by
  // them — an LED, a diode or a switched-on transistor drops a little voltage,
  // but only a resistor sets the current. These are the edges an unprotected
  // LED's legs may reach their rails through.
  const unlimitedEdges: { partId: string; a: string; b: string }[] = []
  for (const part of parts) {
    if (part.type !== 'led' && part.type !== 'diode' && part.type !== 'transistor') continue
    for (let i = 0; i < part.holes.length; i += 1) {
      for (let j = i + 1; j < part.holes.length; j += 1) {
        const a = netOfPin(part, i)
        const b = netOfPin(part, j)
        if (a !== null && b !== null && a !== b) unlimitedEdges.push({ partId: part.id, a, b })
      }
    }
  }

  const reachesWithoutLimit = (from: string, to: string, excludedPartId: string): boolean => {
    if (from === to) return true
    const seen = new Set<string>([from])
    const queue = [from]
    while (queue.length > 0) {
      const current = queue.pop()
      if (current === undefined) break
      for (const edge of unlimitedEdges) {
        if (edge.partId === excludedPartId) continue
        const next = edge.a === current ? edge.b : edge.b === current ? edge.a : null
        if (next === null || seen.has(next)) continue
        if (next === to) return true
        seen.add(next)
        queue.push(next)
      }
    }
    return false
  }

  const gndNet = netOfNode.get('gnd') ?? 'GND'

  for (const part of parts) {
    if (part.type !== 'led') continue
    const anodeNet = netOfPin(part, 0)
    const cathodeNet = netOfPin(part, 1)
    if (anodeNet === null || cathodeNet === null) continue

    if (fromVcc.has(anodeNet) && fromGnd.has(cathodeNet)) litLeds.add(part.id)

    if (reachesWithoutLimit(anodeNet, '+5V', part.id) && reachesWithoutLimit(cathodeNet, gndNet, part.id)) {
      warnings.push({ kind: 'led-direct', refs: [refs.get(part.id) ?? 'D?'] })
    }
  }

  /* ---- floating parts and completion -------------------------------------- */

  const energised = new Set<string>([...fromVcc, ...fromGnd])
  const floating = new Set<string>()
  for (const part of parts) {
    if (part.type === 'jumper') continue
    for (let pin = 0; pin < part.holes.length; pin += 1) {
      const net = netOfPin(part, pin)
      if (net === null || !energised.has(net)) {
        floating.add(part.id)
        break
      }
    }
  }

  const leds = parts.filter((part) => part.type === 'led')
  const complete =
    parts.length > 0 &&
    bomFullyPlaced(bom, parts) &&
    floating.size === 0 &&
    warnings.length === 0 &&
    leds.every((led) => litLeds.has(led.id))

  const powered = new Set<string>(fromVcc)

  return { nets, netOfNode, powered, litLeds, warnings, refs, floating, complete }
}

function netOrder(id: string): number {
  if (id === '+5V') return 0
  if (id === 'GND') return 1
  return 2 + Number(id.slice(1))
}

/**
 * The jumpers that actually short the rails: the shortest wire path from the
 * top rail to the bottom one, in the order a finger would trace it. Naming
 * every jumper on the board — which is what "the rails are shorted" used to
 * point at — sends a student to check wires that are perfectly fine.
 */
function shortingJumpers(parts: readonly PlacedPart[], refs: Map<string, string>): string[] {
  const adjacency = new Map<NodeId, { next: NodeId; partId: string }[]>()
  const addEdge = (from: NodeId, to: NodeId, partId: string) => {
    const list = adjacency.get(from)
    if (list) list.push({ next: to, partId })
    else adjacency.set(from, [{ next: to, partId }])
  }

  for (const part of parts) {
    if (part.type !== 'jumper') continue
    const [a, b] = part.holes.map((hole) => nodeOf(hole))
    if (a == null || b == null || a === b) continue
    addEdge(a, b, part.id)
    addEdge(b, a, part.id)
  }

  const cameFrom = new Map<NodeId, { previous: NodeId; partId: string }>()
  const seen = new Set<NodeId>(['vcc'])
  const queue: NodeId[] = ['vcc']

  while (queue.length > 0) {
    const node = queue.shift()
    if (node === undefined || node === 'gnd') break
    for (const edge of adjacency.get(node) ?? []) {
      if (seen.has(edge.next)) continue
      seen.add(edge.next)
      cameFrom.set(edge.next, { previous: node, partId: edge.partId })
      queue.push(edge.next)
    }
  }

  const path: string[] = []
  let cursor: NodeId = 'gnd'
  while (cursor !== 'vcc') {
    const step = cameFrom.get(cursor)
    if (step === undefined) return path.reverse()
    path.push(refs.get(step.partId) ?? 'W?')
    cursor = step.previous
  }
  return path.reverse()
}
