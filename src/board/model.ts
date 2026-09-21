import type { Bom, BomItem, ComponentType, JsonValue } from '@shared/contracts'

/**
 * The board as data — holes, nodes, placed parts, and the (de)serialised form
 * that `attempts.final_state` carries.
 *
 * This module is pure on purpose: no React, no DOM, no fetch. The workspace UI
 * renders what these functions decide, and `tests/unit/board-model.test.ts`
 * exercises them without either. The geometry *drawing* constants stay in
 * `src/components/board/geometry.ts`; this file owns what a hole *is*, not
 * where it is painted.
 *
 * ---------------------------------------------------------------------------
 * HOLES AND NODES ARE DIFFERENT THINGS
 *
 * A hole is a physical socket a leg goes into: `U4r2` is the upper bank,
 * column 4, row 2. A node is the electrical point the hole belongs to: every
 * hole in that column's upper half is the same node `u4`, because a metal clip
 * bonds the five of them, and the whole top rail is one node `vcc`. This
 * distinction is the entire subject the product teaches, so the code keeps it
 * rather than flattening it.
 * ---------------------------------------------------------------------------
 */

/** Matches the drawing in `src/components/board/geometry.ts`. */
export const BOARD_COLUMNS = 20
export const BANK_ROWS = 5

/* -------------------------------------------------------------------------- */
/* Holes                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * `U4r2` upper bank col 4 row 2 · `L4r0` lower bank · `T4` top (+) rail ·
 * `B4` bottom (−) rail. Compact because these ids are what `final_state`
 * stores, and a 20-part board writes them hundreds of times.
 */
export type HoleId = string

export interface Hole {
  id: HoleId
  kind: 'upper' | 'lower' | 'railTop' | 'railBottom'
  column: number
  /** Row within the bank; 0 for rail holes. */
  row: number
}

export function upperHole(column: number, row: number): HoleId {
  return `U${column}r${row}`
}

export function lowerHole(column: number, row: number): HoleId {
  return `L${column}r${row}`
}

export function railHole(rail: 'top' | 'bottom', column: number): HoleId {
  return rail === 'top' ? `T${column}` : `B${column}`
}

const HOLE_PATTERN = /^(?:([UL])(\d{1,2})r([0-4])|([TB])(\d{1,2}))$/

/** Null for anything that is not a hole on this board. */
export function parseHole(id: string): Hole | null {
  const match = HOLE_PATTERN.exec(id)
  if (!match) return null

  if (match[1] !== undefined && match[2] !== undefined && match[3] !== undefined) {
    const column = Number(match[2])
    if (column >= BOARD_COLUMNS) return null
    return {
      id,
      kind: match[1] === 'U' ? 'upper' : 'lower',
      column,
      row: Number(match[3]),
    }
  }

  if (match[4] !== undefined && match[5] !== undefined) {
    const column = Number(match[5])
    if (column >= BOARD_COLUMNS) return null
    return { id, kind: match[4] === 'T' ? 'railTop' : 'railBottom', column, row: 0 }
  }

  return null
}

/* -------------------------------------------------------------------------- */
/* Nodes                                                                      */
/* -------------------------------------------------------------------------- */

/** `u4` · `l4` · `vcc` · `gnd`. One per bonded clip, not one per hole. */
export type NodeId = string

export function nodeOfHole(hole: Hole): NodeId {
  switch (hole.kind) {
    case 'upper':
      return `u${hole.column}`
    case 'lower':
      return `l${hole.column}`
    case 'railTop':
      return 'vcc'
    case 'railBottom':
      return 'gnd'
  }
}

export function nodeOf(holeId: HoleId): NodeId | null {
  const hole = parseHole(holeId)
  return hole === null ? null : nodeOfHole(hole)
}

/* -------------------------------------------------------------------------- */
/* Parts                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * How many legs a part of each type seats. The transistor is the one
 * three-pin part; a DIP (`ic`) would straddle the channel with 2×n pins, and
 * no seeded exercise carries one yet — `pinCountFor` refusing it keeps the
 * tray honest rather than rendering a part that cannot be placed.
 */
export function pinCountFor(type: ComponentType): number | null {
  switch (type) {
    case 'resistor':
    case 'led':
    case 'capacitor':
    case 'diode':
    case 'jumper':
      return 2
    case 'transistor':
      return 3
    case 'ic':
      return null
  }
}

export interface PlacedPart {
  /** Stable per placement — survives serialisation, keys the SVG. */
  id: string
  /** Which tray line this leg count was drawn from. */
  bomItemId: string
  type: ComponentType
  label: string | null
  value: string | null
  /**
   * One hole per leg, in pin order. Two-lead: `[first, second]`; for an LED
   * that is `[anode, cathode]` — the workspace asks for the anode first and
   * says so. Transistor: `[collector, base, emitter]`, left to right.
   */
  holes: HoleId[]
}

/**
 * Reference designators, assigned by placement order per family: R1, D1, C1,
 * Q1, W1. The netlist and the status line both speak in these, the way every
 * schematic the student will ever read does.
 */
const REF_PREFIX: Record<ComponentType, string> = {
  resistor: 'R',
  led: 'D',
  diode: 'D',
  capacitor: 'C',
  transistor: 'Q',
  jumper: 'W',
  ic: 'U',
}

export function assignRefs(parts: readonly PlacedPart[]): Map<string, string> {
  const counters = new Map<string, number>()
  const refs = new Map<string, string>()

  for (const part of parts) {
    const prefix = REF_PREFIX[part.type]
    const next = (counters.get(prefix) ?? 0) + 1
    counters.set(prefix, next)
    refs.set(part.id, `${prefix}${next}`)
  }

  return refs
}

/** `D1.A`, `Q1.B`, `R1.2` — how a pin is named in the netlist. */
export function pinName(part: PlacedPart, ref: string, pinIndex: number): string {
  if (part.type === 'led' || part.type === 'diode') return `${ref}.${pinIndex === 0 ? 'A' : 'K'}`
  if (part.type === 'transistor') return `${ref}.${['C', 'B', 'E'][pinIndex] ?? String(pinIndex + 1)}`
  return `${ref}.${pinIndex + 1}`
}

/* -------------------------------------------------------------------------- */
/* Occupancy and the tray                                                     */
/* -------------------------------------------------------------------------- */

export function occupiedHoles(parts: readonly PlacedPart[]): Set<HoleId> {
  const taken = new Set<HoleId>()
  for (const part of parts) for (const hole of part.holes) taken.add(hole)
  return taken
}

/**
 * What is left in the tray. The BOM is the budget: a line with `quantity: 2`
 * seats two parts and then its tray chip goes flat, exactly as the physical
 * tray in the lab would run empty.
 */
export function remainingFor(bom: Bom, parts: readonly PlacedPart[]): Map<string, number> {
  const used = new Map<string, number>()
  for (const part of parts) used.set(part.bomItemId, (used.get(part.bomItemId) ?? 0) + 1)

  const remaining = new Map<string, number>()
  for (const item of bom) remaining.set(item.id, Math.max(0, item.quantity - (used.get(item.id) ?? 0)))
  return remaining
}

export function bomFullyPlaced(bom: Bom, parts: readonly PlacedPart[]): boolean {
  // Only lines the board can actually seat count against completion — an `ic`
  // line (none seeded) must not make an exercise unfinishable.
  const placeable = bom.filter((item) => pinCountFor(item.type) !== null)
  const remaining = remainingFor(placeable, parts)
  return placeable.every((item) => (remaining.get(item.id) ?? 0) === 0)
}

/* -------------------------------------------------------------------------- */
/* Serialisation — what attempts.final_state holds                            */
/* -------------------------------------------------------------------------- */

/**
 * The wire schema for board state is deliberately `z.json()` — the interior
 * belongs to this module (see the note on `boardStateSchema`), so the parsing
 * discipline lives here instead.
 *
 * Versioned from day one: `version: 1`. A future shape bumps the number and
 * this reader keeps accepting the old one, because a student's half-built
 * board from last week is not something a deploy may delete.
 */
export interface BoardState {
  version: 1
  parts: PlacedPart[]
}

export function serializeBoard(parts: readonly PlacedPart[]): JsonValue {
  return {
    version: 1,
    parts: parts.map((part) => ({
      id: part.id,
      bomItemId: part.bomItemId,
      type: part.type,
      label: part.label,
      value: part.value,
      holes: [...part.holes],
    })),
  }
}

const MAX_PARTS = 64

/**
 * Reads a stored snapshot back, dropping anything malformed rather than
 * refusing the lot: a corrupt part costs that part, not the student's whole
 * board. Holes are re-validated against the geometry and against each other,
 * so a snapshot written by a bug cannot seat two legs in one hole.
 */
export function parseBoardState(value: unknown, bom: Bom): PlacedPart[] {
  if (typeof value !== 'object' || value === null) return []
  const candidate = value as { version?: unknown; parts?: unknown }
  if (candidate.version !== 1 || !Array.isArray(candidate.parts)) return []

  const bomById = new Map<string, BomItem>(bom.map((item) => [item.id, item]))
  const taken = new Set<HoleId>()
  const seen = new Set<string>()
  const parts: PlacedPart[] = []

  for (const raw of candidate.parts.slice(0, MAX_PARTS)) {
    const part = readPart(raw, bomById)
    if (part === null) continue
    if (seen.has(part.id)) continue
    if (part.holes.some((hole) => taken.has(hole))) continue

    seen.add(part.id)
    for (const hole of part.holes) taken.add(hole)
    parts.push(part)
  }

  return parts
}

function readPart(raw: unknown, bomById: Map<string, BomItem>): PlacedPart | null {
  if (typeof raw !== 'object' || raw === null) return null
  const candidate = raw as Record<string, unknown>

  if (typeof candidate['id'] !== 'string' || candidate['id'].length === 0) return null
  if (typeof candidate['bomItemId'] !== 'string') return null
  if (typeof candidate['type'] !== 'string') return null

  const type = candidate['type'] as ComponentType
  const pins = pinCountFor(type)
  if (pins === null) return null

  const holes = candidate['holes']
  if (!Array.isArray(holes) || holes.length !== pins) return null
  const parsed = holes.map((hole) => (typeof hole === 'string' ? parseHole(hole) : null))
  if (parsed.some((hole) => hole === null)) return null
  if (new Set(holes as string[]).size !== holes.length) return null

  // Label and value come back from the BOM when the line still exists, so an
  // instructor's rename shows up on a resumed board too.
  const bomItem = bomById.get(candidate['bomItemId'])

  return {
    id: candidate['id'],
    bomItemId: candidate['bomItemId'],
    type,
    label: bomItem?.label ?? (typeof candidate['label'] === 'string' ? candidate['label'] : null),
    value: bomItem?.value ?? (typeof candidate['value'] === 'string' ? candidate['value'] : null),
    holes: holes as HoleId[],
  }
}
