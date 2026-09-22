import type { Bom, ComponentType } from '@shared/contracts'

import { nodeOf, pinCountFor, remainingFor, type BoardState, type NodeId, type PlacedPart } from './model.ts'
import { analyseBoard } from './nets.ts'
import { UnionFind } from './union-find.ts'

/**
 * The canonical netlist — a circuit with the board taken away.
 *
 * `nets.ts` answers "what is connected on *this* board": its net names are
 * `N1`, `N2` in column order, so the same circuit built three columns to the
 * right reads differently. That is right for the live readout and useless for
 * judging, because the product's headline promise is that a correct circuit
 * built somewhere else on the board is still correct.
 *
 * So this module forgets columns entirely. A netlist here is:
 *
 *   - **components** — every part except jumpers, with its type, value and pin
 *     roles (`1/2` for a resistor, `A/K` for an LED, `C/B/E` for a transistor);
 *   - **nets** — which component pins are bonded by wire, and which rail (if
 *     any) each net sits on. Jumpers are wire, so they collapse away: a circuit
 *     with one long jumper and a circuit with three short ones are the same
 *     circuit.
 *
 * Nothing in the result mentions a hole or a column, so position independence
 * is true by construction rather than by test. The order of components and nets
 * is made canonical with a few rounds of colour refinement, so the same circuit
 * placed in a different order stores identically too.
 *
 * `compare.ts` judges a student's netlist against a reference one. This module
 * also validates a reference before it may be captured, and packs it for
 * storage in `exercises.golden_netlist` — together with the board it was built
 * on, so Learn Mode can put the instructor's circuit back on the board later.
 */

/* -------------------------------------------------------------------------- */
/* Pins                                                                       */
/* -------------------------------------------------------------------------- */

export type PinRole = '1' | '2' | 'A' | 'K' | 'C' | 'B' | 'E'
export type Rail = 'vcc' | 'gnd'

/** Null for parts that are not components in a netlist — jumpers are wire. */
export function pinRolesFor(type: ComponentType): PinRole[] | null {
  switch (type) {
    case 'resistor':
    case 'capacitor':
      return ['1', '2']
    case 'led':
    case 'diode':
      return ['A', 'K']
    case 'transistor':
      return ['C', 'B', 'E']
    case 'jumper':
    case 'ic':
      return null
  }
}

/**
 * Legs that may trade places without changing the circuit. Capacitors count as
 * symmetric here: the shelf's electrolytic is polar in real life, but nothing
 * on this board can tell which way round it went yet, and marking a student
 * down for a distinction the trainer never taught would be unfair.
 */
export function isSymmetric(type: ComponentType): boolean {
  return type === 'resistor' || type === 'capacitor'
}

/** Parts whose orientation is part of the answer. */
export function isPolar(type: ComponentType): boolean {
  return type === 'led' || type === 'diode' || type === 'transistor'
}

/**
 * Values are display strings from the tray ("220Ω", "10 µF"). Both sides of a
 * comparison come from the same bill of materials, so this only has to absorb
 * the harmless differences — spacing, case, the three ways of writing ohm and
 * micro — not parse units.
 */
export function normaliseValue(value: string | null): string | null {
  if (value === null) return null
  const compact = value.trim().replace(/\s+/g, '').toLowerCase()
  if (compact.length === 0) return null
  return compact.replace(/ohms?|Ω|ω/g, 'ω').replace(/[μu](?=f)/g, 'µ')
}

/* -------------------------------------------------------------------------- */
/* The netlist                                                                */
/* -------------------------------------------------------------------------- */

export interface CanonComponent {
  /** `c0`, `c1` … in canonical order. Stable for the same circuit. */
  key: string
  /** The placed part this came from — the instructor's on a reference, the student's on an attempt. */
  partId: string
  bomItemId: string
  type: ComponentType
  /** As placed. `normaliseValue` of it is what comparisons use. */
  value: string | null
  label: string | null
  /** Canonical pin order. */
  pins: PinRole[]
  /** For each canonical pin, the index into the placed part's `holes`. */
  holeIndex: number[]
}

export interface CanonNet {
  /** The rails this net sits on. Both only when the rails are shorted together. */
  rails: Rail[]
  /** `c0.A`, `c1.2` — sorted. Only nets with at least one component pin exist. */
  members: string[]
}

export interface CanonNetlist {
  components: CanonComponent[]
  nets: CanonNet[]
}

/**
 * What `exercises.golden_netlist` holds. `version` is the *format*; the
 * capture revision is `exercises.netlist_version`, a different number.
 */
export interface GoldenNetlistV2 extends CanonNetlist {
  version: 2
  /** The instructor's board, so Learn Mode can reload it. Instructor-only, like the rest. */
  referenceBoard: BoardState
}

export function extractNetlist(parts: readonly PlacedPart[]): CanonNetlist {
  const wire = new UnionFind()
  wire.find('vcc')
  wire.find('gnd')

  for (const part of parts) {
    if (part.type !== 'jumper') continue
    const [a, b] = part.holes.map((hole) => nodeOf(hole))
    if (a != null && b != null) wire.union(a, b)
  }

  const vccRoot = wire.find('vcc')
  const gndRoot = wire.find('gnd')

  /* ---- components, each pin tied to a provisional net ------------------ */

  const netIndexOfRoot = new Map<NodeId, number>()
  const netRails: Rail[][] = []
  const netFor = (root: NodeId): number => {
    const known = netIndexOfRoot.get(root)
    if (known !== undefined) return known
    const index = netRails.length
    netIndexOfRoot.set(root, index)
    const rails: Rail[] = []
    if (root === vccRoot) rails.push('vcc')
    if (root === gndRoot) rails.push('gnd')
    netRails.push(rails)
    return index
  }

  interface Raw {
    part: PlacedPart
    order: number
    type: ComponentType
    value: string | null
    roles: PinRole[]
    holeIndex: number[]
    nets: number[]
  }

  const raws: Raw[] = []
  parts.forEach((part, order) => {
    const roles = pinRolesFor(part.type)
    if (roles === null || part.holes.length !== roles.length) return
    const nets: number[] = []
    for (const hole of part.holes) {
      const node = nodeOf(hole)
      if (node === null) return
      nets.push(netFor(wire.find(node)))
    }
    raws.push({
      part,
      order,
      type: part.type,
      value: normaliseValue(part.value),
      roles,
      holeIndex: roles.map((_, index) => index),
      nets,
    })
  })

  /* ---- canonical order ------------------------------------------------- */

  const colours = refineColours(raws, netRails)

  // A symmetric part's two legs are interchangeable, so which one is "1" is
  // decided by the circuit, not by which end the student clicked first.
  raws.forEach((raw) => {
    if (!isSymmetric(raw.type)) return
    const [first, second] = raw.nets
    if (first === undefined || second === undefined) return
    if ((colours.nets[second] ?? '') < (colours.nets[first] ?? '')) {
      raw.nets = [second, first]
      raw.holeIndex = [1, 0]
    }
  })

  const ranked = raws
    .map((raw, index) => ({ raw, colour: colours.components[index] ?? '' }))
    .sort(
      (a, b) =>
        compareText(a.raw.type, b.raw.type) ||
        compareText(a.raw.value ?? '', b.raw.value ?? '') ||
        compareText(a.colour, b.colour) ||
        a.raw.order - b.raw.order,
    )

  const components: CanonComponent[] = ranked.map(({ raw }, index) => ({
    key: `c${index}`,
    partId: raw.part.id,
    bomItemId: raw.part.bomItemId,
    type: raw.type,
    value: raw.part.value,
    label: raw.part.label,
    pins: raw.roles,
    holeIndex: raw.holeIndex,
  }))

  const membersByNet = new Map<number, string[]>()
  ranked.forEach(({ raw }, index) => {
    raw.nets.forEach((net, pin) => {
      const member = `c${index}.${raw.roles[pin] ?? String(pin)}`
      const list = membersByNet.get(net)
      if (list) list.push(member)
      else membersByNet.set(net, [member])
    })
  })

  const nets: CanonNet[] = [...membersByNet.entries()]
    .map(([net, members]) => ({ rails: netRails[net] ?? [], members: members.sort(compareText) }))
    .sort(
      (a, b) =>
        railRank(a.rails) - railRank(b.rails) || compareText(a.members.join(','), b.members.join(',')),
    )

  return { components, nets }
}

export function buildGoldenNetlist(parts: readonly PlacedPart[]): GoldenNetlistV2 {
  return {
    version: 2,
    referenceBoard: {
      version: 1,
      parts: parts.map((part) => ({ ...part, holes: [...part.holes] })),
    },
    ...extractNetlist(parts),
  }
}

/* -------------------------------------------------------------------------- */
/* Reference validation (Learn Mode capture)                                  */
/* -------------------------------------------------------------------------- */

export type ReferenceIssueReason = 'empty_board' | 'short_circuit' | 'floating_lead' | 'unused_bom_component'

export interface ReferenceIssue {
  reason: ReferenceIssueReason
  /** What to point at: refs (`W2`, `D1`) or tray labels for unused parts. */
  labels: string[]
}

/**
 * A reference is the answer key, so it has to be a circuit the trainer would
 * give full marks to. That means no shorts and no unprotected LEDs — otherwise
 * a student who copied the instructor exactly would lose safety points — no
 * part hanging off nothing, and every part in the tray used, because the tray
 * is what the student is handed.
 *
 * Jumpers are the exception to "every part used": their quantity is a budget,
 * not a requirement.
 */
export function validateReference(parts: readonly PlacedPart[], bom: Bom): ReferenceIssue[] {
  const components = parts.filter((part) => pinRolesFor(part.type) !== null)
  if (components.length === 0) return [{ reason: 'empty_board', labels: [] }]

  const analysis = analyseBoard(parts, bom)
  const issues: ReferenceIssue[] = []

  const shorting = analysis.warnings.flatMap((warning) => warning.refs)
  if (shorting.length > 0) issues.push({ reason: 'short_circuit', labels: unique(shorting) })

  // Two kinds of floating: a part no rail can reach at all (what the live
  // readout counts), and a single lead that touches nothing — a net with one
  // pin on it and no rail. The live readout forgives the second while a
  // student is mid-build; an answer key may not have one.
  const dangling = new Set<string>()
  const netlist = extractNetlist(parts)
  for (const net of netlist.nets) {
    if (net.rails.length > 0 || net.members.length !== 1) continue
    const key = net.members[0]?.split('.')[0]
    const component = netlist.components.find((candidate) => candidate.key === key)
    if (component) dangling.add(component.partId)
  }
  const floating = parts
    .filter((part) => analysis.floating.has(part.id) || dangling.has(part.id))
    .map((part) => analysis.refs.get(part.id) ?? part.type)
  if (floating.length > 0) issues.push({ reason: 'floating_lead', labels: floating })

  const required = bom.filter((item) => item.type !== 'jumper' && pinCountFor(item.type) !== null)
  const remaining = remainingFor(required, parts)
  const unused = required
    .filter((item) => (remaining.get(item.id) ?? 0) > 0)
    .map((item) => item.label ?? item.value ?? item.type)
  if (unused.length > 0) issues.push({ reason: 'unused_bom_component', labels: unused })

  return issues
}

/* -------------------------------------------------------------------------- */
/* Colour refinement                                                          */
/* -------------------------------------------------------------------------- */

export interface ColourInput {
  type: ComponentType
  /** Normalised. */
  value: string | null
  roles: readonly PinRole[]
  /** Net index per pin. */
  nets: readonly number[]
}

/**
 * Weisfeiler–Lehman colour refinement over the pin/net graph: a component's
 * colour is its type and value plus the colours of the nets its pins land on,
 * and a net's colour is its rails plus the colours of the pins on it, iterated
 * a few rounds. Structurally identical positions end up with identical colours
 * whatever the board layout or placement order, which is what makes it a
 * canonical sort key here and a good first guess for the comparator's search.
 *
 * Colours are hashes of strings, so they are comparable *across* two different
 * boards — the property the comparator relies on.
 */
export function refineColours(
  components: readonly ColourInput[],
  netRails: readonly (readonly Rail[])[],
  rounds = 3,
): { components: string[]; nets: string[] } {
  let componentColours = components.map((component) => hash(`${component.type}|${component.value ?? ''}`))
  let netColours = netRails.map((rails) => hash(`rails:${rails.join('+')}`))

  for (let round = 0; round < rounds; round += 1) {
    const onNet: string[][] = netRails.map(() => [])
    components.forEach((component, index) => {
      component.nets.forEach((net, pin) => {
        onNet[net]?.push(`${pinTag(component, pin)}:${componentColours[index] ?? ''}`)
      })
    })
    netColours = netRails.map((rails, net) =>
      hash(`${rails.join('+')}|${(onNet[net] ?? []).sort(compareText).join(',')}`),
    )

    componentColours = components.map((component, index) => {
      const pins = component.nets.map((net, pin) => `${pinTag(component, pin)}:${netColours[net] ?? ''}`)
      if (isSymmetric(component.type)) pins.sort(compareText)
      return hash(`${componentColours[index] ?? ''}|${pins.join(',')}`)
    })
  }

  return { components: componentColours, nets: netColours }
}

function pinTag(component: ColourInput, pin: number): string {
  return isSymmetric(component.type) ? 'x' : (component.roles[pin] ?? '?')
}

/** FNV-1a, 32-bit. Deterministic, fast, and more than wide enough for a board's worth of colours. */
function hash(text: string): string {
  let value = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i)
    value = Math.imul(value, 0x01000193) >>> 0
  }
  return value.toString(36).padStart(7, '0')
}

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

/** Code-unit order, not locale order: canonical forms must not depend on the machine. */
export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function railRank(rails: readonly Rail[]): number {
  if (rails.length === 0) return 2
  return rails[0] === 'vcc' ? 0 : 1
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}
