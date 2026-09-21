import * as React from 'react'

import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  BANK_HEIGHT,
  CHANNEL,
  COLUMNS,
  columnX,
  lowerY,
  ORIGIN_X,
  ORIGIN_Y,
  PITCH,
  RAIL_BOTTOM_Y,
  RAIL_TOP_Y,
  ROWS,
  upperY,
} from '@/components/board/geometry'
import {
  lowerHole,
  nodeOf,
  nodeOfHole,
  parseHole,
  railHole,
  upperHole,
  type Hole,
  type HoleId,
  type NodeId,
  type PlacedPart,
} from '@/board/model'
import { cn } from '@/lib/utils'
import type { ComponentType } from '@shared/contracts'

import { CapacitorArt, DiodeArt, JumperArt, LedArt, PartDefs, ResistorArt, TransistorArt } from './part-art'

/**
 * The interactive board — the same drawing as `<Breadboard>`, with every hole a
 * target.
 *
 * It shares the geometry module with the presentational board so the two can
 * never drift a half-pitch apart, but it is its own component: the landing
 * board answers "what does a board look like", this one answers "what happens
 * when you click it", and the props those two need have nothing in common.
 *
 * All *decisions* stay in the parent. This component reports which hole or part
 * was clicked and draws what it is told — the placement rules, the tray budget
 * and the net analysis live in `src/board/` where they are tested without a
 * pointer.
 */

export interface PendingPlacement {
  type: ComponentType
  /** The BOM value, so the ghost wears the right bands and body. */
  value: string | null
  /** Holes already chosen for the part being placed — 0 or 1 of them. */
  holes: HoleId[]
}

export interface WorkspaceBoardProps {
  parts: readonly PlacedPart[]
  refs: Map<string, string>
  occupied: Set<HoleId>
  pending: PendingPlacement | null
  netOfNode: Map<NodeId, string>
  /** Nets reached from +5V — drawn lit, so power visibly spreads as you wire. */
  powered: Set<string>
  focusedNet: string | null
  litLeds: Set<string>
  selectedPartId: string | null
  /** 0–1 sweep position while the test scan runs, or null. */
  scan?: number | null
  onHoleClick: (hole: HoleId) => void
  onPartClick: (partId: string) => void
  /** Accessible name per hole, from the parent so it speaks the right language. */
  holeLabel: (hole: Hole) => string
  title: string
  className?: string
}

interface Point {
  x: number
  y: number
}

/** Where a hole is painted. Rail holes sit just outside their stripe. */
function holePoint(hole: Hole): Point {
  switch (hole.kind) {
    case 'upper':
      return { x: columnX(hole.column), y: upperY(hole.row) }
    case 'lower':
      return { x: columnX(hole.column), y: lowerY(hole.row) }
    case 'railTop':
      return { x: columnX(hole.column), y: RAIL_TOP_Y + 16 }
    case 'railBottom':
      return { x: columnX(hole.column), y: RAIL_BOTTOM_Y + 16 }
  }
}

function pointOf(holeId: HoleId): Point | null {
  const hole = parseHole(holeId)
  return hole === null ? null : holePoint(hole)
}

/* -------------------------------------------------------------------------- */

export function WorkspaceBoard({
  parts,
  refs,
  occupied,
  pending,
  netOfNode,
  powered,
  focusedNet,
  litLeds,
  selectedPartId,
  scan = null,
  onHoleClick,
  onPartClick,
  holeLabel,
  title,
  className,
}: WorkspaceBoardProps) {
  const [hovered, setHovered] = React.useState<HoleId | null>(null)

  /** Every hole on the board, once. Rail holes skip every sixth column, as the real moulding does. */
  const holes = React.useMemo(() => {
    const list: Hole[] = []
    for (let column = 0; column < COLUMNS; column += 1) {
      for (let row = 0; row < ROWS; row += 1) {
        const upper = parseHole(upperHole(column, row))
        const lower = parseHole(lowerHole(column, row))
        if (upper) list.push(upper)
        if (lower) list.push(lower)
      }
      if (column % 6 !== 5) {
        const top = parseHole(railHole('top', column))
        const bottom = parseHole(railHole('bottom', column))
        if (top) list.push(top)
        if (bottom) list.push(bottom)
      }
    }
    return list
  }, [])

  const jumpers = parts.filter((part) => part.type === 'jumper')
  const components = parts.filter((part) => part.type !== 'jumper')

  return (
    <svg
      viewBox={`0 -40 ${BOARD_WIDTH} ${BOARD_HEIGHT + 56}`}
      role="img"
      aria-label={title}
      className={cn('h-auto w-full select-none', className)}
      onPointerLeave={() => setHovered(null)}
    >
      <PartDefs />
      <BoardBody />
      <Rails />
      <ColumnNumbers />

      {/* The bonding clip behind a focused net — five holes, one node, shown as one thing. */}
      {focusedNet ? <NetClips netOfNode={netOfNode} net={focusedNet} /> : null}

      <g>
        {holes.map((hole) => (
          <HoleTarget
            key={hole.id}
            hole={hole}
            state={holeState(hole, {
              occupied,
              netOfNode,
              powered,
              focusedNet,
              pendingFirst: pending?.holes[0] ?? null,
            })}
            label={holeLabel(hole)}
            onClick={() => onHoleClick(hole.id)}
            onHover={(over) => setHovered(over ? hole.id : null)}
          />
        ))}
      </g>

      {/*
        While a part is being placed, everything already on the board goes
        transparent to the pointer. A resistor's lead lies right across its own
        hole — and often across others — and a click meant for the hole under
        it must reach that hole. Selection is disabled during placement anyway,
        so nothing is lost.
      */}
      <g className={pending !== null ? 'pointer-events-none' : undefined}>
        {components.map((part) => (
          <PlacedComponent
            key={part.id}
            part={part}
            refLabel={refs.get(part.id) ?? ''}
            lit={litLeds.has(part.id)}
            selected={part.id === selectedPartId}
            onClick={() => onPartClick(part.id)}
          />
        ))}
        {jumpers.map((part) => (
          <PlacedJumper
            key={part.id}
            part={part}
            refLabel={refs.get(part.id) ?? 'W'}
            selected={part.id === selectedPartId}
            onClick={() => onPartClick(part.id)}
          />
        ))}
      </g>

      {pending ? <Ghost pending={pending} hovered={hovered} /> : null}

      {scan !== null ? <ScanSweep at={scan} /> : null}
    </svg>
  )
}

/** The reading pass, sweeping the board — the same move as the landing demo. */
function ScanSweep({ at }: { at: number }) {
  const x = ORIGIN_X - 24 + (BOARD_WIDTH - (ORIGIN_X - 24) * 2) * at

  return (
    <g className="pointer-events-none">
      <rect x={x - 26} y={8} width={26} height={BOARD_HEIGHT - 16} className="fill-accent/10" />
      <line x1={x} y1={8} x2={x} y2={BOARD_HEIGHT - 8} className="stroke-accent" strokeWidth={2} />
    </g>
  )
}

/* -------------------------------------------------------------------------- */
/* Hole states                                                                */
/* -------------------------------------------------------------------------- */

type HoleState = 'idle' | 'occupied' | 'powered' | 'focused' | 'pending'

function holeState(
  hole: Hole,
  context: {
    occupied: Set<HoleId>
    netOfNode: Map<NodeId, string>
    powered: Set<string>
    focusedNet: string | null
    pendingFirst: HoleId | null
  },
): HoleState {
  if (context.pendingFirst === hole.id) return 'pending'

  const net = context.netOfNode.get(nodeOfHole(hole))
  if (net !== undefined && net === context.focusedNet) return 'focused'
  if (net !== undefined && context.powered.has(net)) return 'powered'
  if (context.occupied.has(hole.id)) return 'occupied'
  return 'idle'
}

const HOLE_CLASS: Record<HoleState, string> = {
  idle: 'fill-bg-900 stroke-line',
  occupied: 'fill-bg-700 stroke-line-strong',
  powered: 'fill-accent/25 stroke-accent',
  focused: 'fill-accent stroke-accent',
  pending: 'fill-accent stroke-accent',
}

function HoleTarget({
  hole,
  state,
  label,
  onClick,
  onHover,
}: {
  hole: Hole
  state: HoleState
  label: string
  onClick: () => void
  onHover: (over: boolean) => void
}) {
  const point = holePoint(hole)

  return (
    <g
      role="button"
      tabIndex={-1}
      aria-label={label}
      className="cursor-pointer"
      onClick={onClick}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
    >
      <rect
        x={point.x - 4.5}
        y={point.y - 4.5}
        width={9}
        height={9}
        rx={2}
        strokeWidth={1.5}
        className={cn(HOLE_CLASS[state], 'transition-[fill,stroke] duration-200 ease-out')}
      />
      {/* The real target. A 9px square is a fine drawing and a hostile button. */}
      <circle cx={point.x} cy={point.y} r={11} fill="transparent" stroke="none" />
    </g>
  )
}

/** The clip strip behind every column-half of one net. */
function NetClips({ netOfNode, net }: { netOfNode: Map<NodeId, string>; net: string }) {
  const strips: React.ReactNode[] = []

  for (const [node, netId] of netOfNode) {
    if (netId !== net) continue
    const bank = node.startsWith('u') ? 'upper' : node.startsWith('l') ? 'lower' : null
    if (bank === null) continue
    const column = Number(node.slice(1))
    const y = bank === 'upper' ? upperY(0) : lowerY(0)
    strips.push(
      <rect
        key={node}
        x={columnX(column) - 8}
        y={y - 8}
        width={16}
        height={(ROWS - 1) * PITCH + 16}
        rx={8}
        className="fill-accent/10"
      />,
    )
  }

  return <g>{strips}</g>
}

/* -------------------------------------------------------------------------- */
/* The plastic — same shapes as the presentational board                      */
/* -------------------------------------------------------------------------- */

function BoardBody() {
  return (
    <g>
      <rect
        x={4}
        y={4}
        width={BOARD_WIDTH - 8}
        height={BOARD_HEIGHT - 8}
        rx={14}
        className="fill-bg-800 stroke-line"
        strokeWidth={2}
      />
      <rect
        x={ORIGIN_X - PITCH / 2}
        y={ORIGIN_Y + BANK_HEIGHT + PITCH / 2}
        width={(COLUMNS - 1) * PITCH + PITCH}
        height={CHANNEL - PITCH}
        rx={4}
        className="fill-bg-900 stroke-line"
        strokeWidth={1.5}
      />
    </g>
  )
}

function Rails() {
  const rails = [
    { y: RAIL_TOP_Y, sign: '+', className: 'stroke-fault' },
    { y: RAIL_BOTTOM_Y, sign: '−', className: 'stroke-info' },
  ]

  return (
    <g>
      {rails.map((rail) => (
        <g key={rail.sign}>
          <line
            x1={ORIGIN_X - 18}
            y1={rail.y}
            x2={BOARD_WIDTH - ORIGIN_X + 18}
            y2={rail.y}
            className={cn(rail.className, 'opacity-45')}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <text
            x={ORIGIN_X - 30}
            y={rail.y + 5}
            textAnchor="middle"
            className="fill-text-tertiary font-mono text-[15px]"
          >
            {rail.sign}
          </text>
        </g>
      ))}
    </g>
  )
}

function ColumnNumbers() {
  return (
    <g className="fill-text-tertiary font-mono text-[13px]">
      {Array.from({ length: COLUMNS }, (_, column) => {
        if ((column + 1) % 5 !== 0) return null
        return (
          <text key={column} x={columnX(column)} y={ORIGIN_Y - 20} textAnchor="middle">
            {column + 1}
          </text>
        )
      })}
    </g>
  )
}

/* -------------------------------------------------------------------------- */
/* Parts, at arbitrary endpoints                                              */
/* -------------------------------------------------------------------------- */

/**
 * The landing board draws each part at one hand-picked spot; here a part lands
 * wherever the student put it, so every body is drawn in a local frame — the
 * group translates to the midpoint and rotates along the lead axis, and the
 * shapes inside only ever think in "along" and "across".
 */
function axisTransform(a: Point, b: Point): { transform: string; length: number } {
  const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
  return {
    transform: `translate(${(a.x + b.x) / 2} ${(a.y + b.y) / 2}) rotate(${angle})`,
    length: Math.hypot(b.x - a.x, b.y - a.y),
  }
}

function PlacedComponent({
  part,
  refLabel,
  lit,
  selected,
  onClick,
}: {
  part: PlacedPart
  refLabel: string
  lit: boolean
  selected: boolean
  onClick: () => void
}) {
  if (part.type === 'transistor') {
    return <Transistor part={part} refLabel={refLabel} selected={selected} onClick={onClick} />
  }

  const [first, second] = part.holes
  const a = first !== undefined ? pointOf(first) : null
  const b = second !== undefined ? pointOf(second) : null
  if (a === null || b === null) return null

  const { transform, length } = axisTransform(a, b)

  return (
    <g
      role="button"
      tabIndex={-1}
      aria-label={refLabel}
      className="animate-rise-in cursor-pointer"
      onClick={onClick}
    >
      {selected ? <SelectionRing points={[a, b]} /> : null}

      <g transform={transform}>
        {part.type === 'resistor' ? <ResistorArt length={length} value={part.value} /> : null}
        {part.type === 'capacitor' ? <CapacitorArt length={length} value={part.value} /> : null}
        {part.type === 'diode' ? <DiodeArt length={length} /> : null}
        {part.type === 'led' ? <LedArt length={length} lit={lit} /> : null}
      </g>

      {/* Ref and the anode mark are upright text, so they live outside the rotation. */}
      <RefLabel a={a} b={b} text={refLabel} />
      {part.type === 'led' ? (
        <text x={a.x} y={a.y - 9} textAnchor="middle" className="fill-text-tertiary font-mono text-[11px]">
          +
        </text>
      ) : null}
    </g>
  )
}

/** TO-92 from above: a D-shape sitting over its three legs. */
function Transistor({
  part,
  refLabel,
  selected,
  onClick,
}: {
  part: PlacedPart
  refLabel: string
  selected: boolean
  onClick: () => void
}) {
  const points = part.holes.map((hole) => pointOf(hole))
  const base = points[1]
  if (points.some((point) => point === null) || base == null) return null

  return (
    <g
      role="button"
      tabIndex={-1}
      aria-label={refLabel}
      className="animate-rise-in cursor-pointer"
      onClick={onClick}
    >
      {selected ? <SelectionRing points={points.filter((p): p is Point => p !== null)} /> : null}

      <g transform={`translate(${base.x} ${base.y})`}>
        <TransistorArt
          legOffsets={points.map((point) => (point ? point.x - base.x : 0))}
          marking={part.value}
        />
      </g>
      <text
        x={base.x}
        y={base.y + 16}
        textAnchor="middle"
        className="fill-text-tertiary font-mono text-[11px]"
      >
        {refLabel}
      </text>
    </g>
  )
}

function PlacedJumper({
  part,
  refLabel,
  selected,
  onClick,
}: {
  part: PlacedPart
  refLabel: string
  selected: boolean
  onClick: () => void
}) {
  const [first, second] = part.holes
  const a = first !== undefined ? pointOf(first) : null
  const b = second !== undefined ? pointOf(second) : null
  if (a === null || b === null) return null

  return (
    <g
      role="button"
      tabIndex={-1}
      aria-label={refLabel}
      className="animate-rise-in cursor-pointer"
      onClick={onClick}
    >
      {selected ? <SelectionRing points={[a, b]} /> : null}
      <JumperArt a={a} b={b} strokeClass={jumperStroke(part)} />
    </g>
  )
}

/**
 * A jumper takes its colour from what it touches — red off the +5V rail, blue
 * off ground, accent in between. The same vocabulary as the landing demo, and a
 * habit worth teaching: real labs colour-code exactly this way.
 */
function jumperStroke(part: PlacedPart): string {
  const nodes = part.holes.map((hole) => nodeOf(hole))
  if (nodes.includes('vcc')) return 'stroke-fault'
  if (nodes.includes('gnd')) return 'stroke-info'
  return 'stroke-accent'
}

function SelectionRing({ points }: { points: Point[] }) {
  return (
    <g>
      {points.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r={13}
          className="fill-accent/10 stroke-accent"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      ))}
    </g>
  )
}

function RefLabel({ a, b, text }: { a: Point; b: Point; text: string }) {
  if (text.length === 0) return null

  // Perpendicular offset, so the label clears the body at any orientation.
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const nx = -(b.y - a.y) / length
  const ny = (b.x - a.x) / length
  const x = (a.x + b.x) / 2 + nx * 22
  const y = (a.y + b.y) / 2 + ny * 22

  return (
    <text x={x} y={y + 4} textAnchor="middle" className="fill-text-tertiary font-mono text-[11px]">
      {text}
    </text>
  )
}

/* -------------------------------------------------------------------------- */
/* The ghost                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * What placement is about to do, drawn translucent under the pointer: a rubber
 * band from the first chosen hole, or the part's own silhouette once both ends
 * are knowable. Pointer-events off — the ghost must never eat the click that
 * confirms it.
 */
function Ghost({ pending, hovered }: { pending: PendingPlacement; hovered: HoleId | null }) {
  const first = pending.holes[0] !== undefined ? pointOf(pending.holes[0]) : null
  const over = hovered !== null ? pointOf(hovered) : null

  return (
    <g className="pointer-events-none opacity-60">
      {/* Transistor: one click seats three legs — preview all three columns. */}
      {pending.type === 'transistor' && over && hovered ? <TransistorGhost hovered={hovered} /> : null}

      {pending.type !== 'transistor' && first && over ? (
        pending.type === 'jumper' ? (
          <JumperArt a={first} b={over} strokeClass="stroke-accent" dashed />
        ) : (
          <g transform={axisTransform(first, over).transform}>
            {pending.type === 'resistor' ? (
              <ResistorArt length={axisTransform(first, over).length} value={pending.value} />
            ) : null}
            {pending.type === 'capacitor' ? (
              <CapacitorArt length={axisTransform(first, over).length} value={pending.value} />
            ) : null}
            {pending.type === 'diode' ? <DiodeArt length={axisTransform(first, over).length} /> : null}
            {pending.type === 'led' ? (
              <LedArt length={axisTransform(first, over).length} lit={false} />
            ) : null}
          </g>
        )
      ) : null}

      {/* Nothing chosen yet: mark the hole the pointer is on. */}
      {pending.type !== 'transistor' && !first && over ? (
        <circle cx={over.x} cy={over.y} r={8} className="fill-accent/30 stroke-accent" strokeWidth={1.5} />
      ) : null}
    </g>
  )
}

function TransistorGhost({ hovered }: { hovered: HoleId }) {
  const hole = parseHole(hovered)
  if (hole === null || (hole.kind !== 'upper' && hole.kind !== 'lower')) return null

  const y = hole.kind === 'upper' ? upperY(hole.row) : lowerY(hole.row)
  const x = columnX(hole.column)

  return (
    <g transform={`translate(${x} ${y})`}>
      {[-PITCH, 0, PITCH].map((dx) => (
        <circle key={dx} cx={dx} cy={0} r={6} className="fill-accent/30 stroke-accent" strokeWidth={1.5} />
      ))}
      <TransistorArt legOffsets={[-PITCH, 0, PITCH]} marking={null} />
    </g>
  )
}
