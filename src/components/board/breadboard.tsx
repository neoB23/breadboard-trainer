import * as React from 'react'

import { cn } from '@/lib/utils'

import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  BANK_HEIGHT,
  CHANNEL,
  COLUMNS,
  BUILD_AT,
  BUILD_TOTAL,
  columnX,
  lowerY,
  FAULT_COLUMN,
  NETS,
  ORIGIN_X,
  ORIGIN_Y,
  PITCH,
  RAIL_BOTTOM_Y,
  RAIL_TOP_Y,
  ROWS,
  upperY,
  type NetId,
} from './geometry'

/**
 * The breadboard, drawn rather than photographed.
 *
 * ---------------------------------------------------------------------------
 * WHY A DRAWING AND NOT A PHOTOGRAPH
 *
 * A photo of an Arduino starter kit would be quicker to obtain and worse in
 * every way that matters here. It cannot follow the theme or the high-contrast
 * preference; it cannot light up one net and leave the others alone, which is
 * the entire point being made; it is a fixed number of pixels on a screen that
 * might be a projector; it is another asset to license and another request to
 * make; and it shows a board, not *this* board — the one whose columns the
 * netlist beside it refers to by number.
 *
 * Every colour below is a token utility (`fill-bg-800`, `stroke-line`), so the
 * drawing follows light, dark and high contrast without a second copy.
 * ---------------------------------------------------------------------------
 *
 * The component is pure: what it draws is entirely decided by its props. The
 * sequencing lives in `useBoardSequence`, and the interaction lives in the
 * showcase — so this file can be read as "what a board looks like" and nothing
 * else.
 */

export interface BreadboardProps {
  /**
   * How many parts are in, counting up through `BUILD_STEPS`: the supply
   * jumper, the resistor, the LED, then the ground jumper. `BUILD_TOTAL` is a
   * finished circuit.
   */
  placed?: number
  /** Nets whose holes are shown bonded. Filled, not hollow — five holes, one node. */
  litNets?: readonly NetId[]
  /** Drawn brightest, with its label shown. Follows the pointer in the netlist. */
  focusedNet?: NetId | null
  /** 0–1 position of the scan sweep, or null when not scanning. */
  scan?: number | null
  /** Show the ground jumper on the wrong side of the channel. */
  fault?: boolean
  /**
   * The net the diagnosis has called out, drawn in the fault colour instead of
   * the accent. Set only once the fault is named — colouring it before the scan
   * has said so would give the answer away.
   */
  faultedNet?: NetId | null
  /** Called when a net's holes are clicked. Makes the drawing a control. */
  onNetSelect?: (net: NetId) => void
  className?: string
  /** Accessible description. Omit when an adjacent listing already says it. */
  title?: string
  /**
   * Show only a window onto the board, given as a column range.
   *
   * Twenty columns is right when the board is the focus of a hero and wrong in a
   * 320px card, where every hole collapses to a smudge. Cropping keeps the pitch
   * — and therefore the sense of scale — and simply shows less of the board,
   * which is what a photographer would do. Scaling the whole thing down instead
   * would make it unreadable at the same size.
   */
  crop?: BoardCrop
}

/**
 * A window onto the board: which columns, and which horizontal band.
 *
 * The band matters as much as the columns. Cropping only left-and-right leaves a
 * portrait sliver of mostly empty board, which is the shape a card is least able
 * to show — a card wants a wide, shallow strip.
 */
export interface BoardCrop {
  columns: readonly [from: number, to: number]
  /**
   * `full`    the whole board, rail to rail
   * `upper`   the + rail and the upper bank, where a part is seated
   * `channel` the rows either side of the centre channel, where the fault lives
   */
  band?: 'full' | 'upper' | 'channel'
}

export function Breadboard({
  placed = BUILD_TOTAL,
  litNets = [],
  focusedNet = null,
  scan = null,
  fault = false,
  faultedNet = null,
  onNetSelect,
  className,
  title,
  crop,
}: BreadboardProps) {
  const lit = React.useMemo(() => new Set(litNets), [litNets])

  /**
   * The window onto the board. Half a pitch of margin either side of the named
   * columns, so a cropped edge falls between holes rather than slicing one.
   */
  const view = React.useMemo(() => {
    if (!crop) return { x: 0, y: 0, width: BOARD_WIDTH, height: BOARD_HEIGHT }

    const [from, to] = crop.columns
    const left = columnX(from) - PITCH / 2
    const right = columnX(to) + PITCH / 2

    const band = crop.band ?? 'full'
    const top = band === 'upper' ? RAIL_TOP_Y - 26 : band === 'channel' ? upperY(1) - 14 : 0
    const bottom =
      band === 'upper' ? upperY(ROWS - 1) + 18 : band === 'channel' ? lowerY(2) + 14 : BOARD_HEIGHT

    return { x: left, y: top, width: right - left, height: bottom - top }
  }, [crop])

  /**
   * A real clip, because the viewBox is not one.
   *
   * `preserveAspectRatio="…meet"` — the default — scales the viewBox to *fit*
   * the element and then clips to the **viewport**, not to the viewBox. So when
   * the element is wider than the crop's aspect ratio, the letterbox margins are
   * not blank: they show whatever else the drawing put there. Cropping to ten
   * columns inside a 16:7 card quietly displayed sixteen.
   *
   * Clipping the content to the crop rectangle makes the window mean what it
   * says at any container shape.
   */
  const clipId = React.useId()

  const content = (
    <>
      <BoardBody />
      <PowerRails />
      <ColumnNumbers />
      <TiePoints lit={lit} focused={focusedNet} faulted={faultedNet} onNetSelect={onNetSelect} />
      {/*
        Parts appear in assembly order, one per step, so the demo reads as a
        board being built rather than a finished board fading in. BUILD_AT is
        shared with the 3D scene and the sequence timer.
      */}
      {placed >= BUILD_AT.supplyJumper ? <SupplyJumper /> : null}
      {placed >= BUILD_AT.resistor ? <Resistor /> : null}
      {placed >= BUILD_AT.led ? <Led lit={lit.has('n3') && !fault} /> : null}
      {placed >= BUILD_AT.groundJumper ? <GroundJumper fault={fault} lit={lit} /> : null}
      {scan === null ? null : <ScanLine at={scan} />}
      {focusedNet ? <NetLabel net={focusedNet} fault={fault} /> : null}
    </>
  )

  return (
    <svg
      viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
      className={cn('h-auto w-full select-none', className)}
      role={title ? 'img' : 'presentation'}
      {...(title ? { 'aria-label': title } : { 'aria-hidden': true })}
    >
      {crop ? (
        <>
          <defs>
            <clipPath id={clipId}>
              <rect x={view.x} y={view.y} width={view.width} height={view.height} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>{content}</g>
        </>
      ) : (
        content
      )}
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/* The plastic                                                                */
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
      {/*
        The centre channel, drawn as a recess rather than a line. On a real board
        this is a moulded trough, and it is the reason the two banks are
        electrically separate — so it gets to look like a physical thing.
      */}
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

/* -------------------------------------------------------------------------- */
/* Power rails                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The red and blue stripes down each edge.
 *
 * These are the one place a literal red and blue are used as *paint* rather than
 * as state. They are silkscreen: every breadboard a student has held is marked
 * this way, and re-colouring them to fit the palette would make the drawing
 * less recognisable in exchange for a consistency nobody asked for. The state
 * rule — never colour alone — is untouched, because a rail is not a state; the
 * `+` and `−` glyphs carry the meaning regardless.
 */
function PowerRails() {
  const rails: { y: number; sign: '+' | '−'; className: string }[] = [
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
            className={cn('fill-text-tertiary font-mono', rail.sign === '+' ? 'text-[15px]' : 'text-[15px]')}
          >
            {rail.sign}
          </text>
          {/* Rail holes, in the pairs a real board groups them into. */}
          {Array.from({ length: COLUMNS }, (_, column) => {
            if (column % 6 === 5) return null
            return <Hole key={column} x={columnX(column)} y={rail.y + 16} state="idle" />
          })}
        </g>
      ))}
    </g>
  )
}

/* -------------------------------------------------------------------------- */
/* Holes                                                                      */
/* -------------------------------------------------------------------------- */

type HoleState = 'idle' | 'lit' | 'focused' | 'fault'

const HOLE_CLASS: Record<HoleState, string> = {
  idle: 'fill-bg-900 stroke-line',
  lit: 'fill-accent/25 stroke-accent',
  focused: 'fill-accent stroke-accent',
  fault: 'fill-fault/25 stroke-fault',
}

function Hole({ x, y, state }: { x: number; y: number; state: HoleState }) {
  return (
    <rect
      x={x - 4.5}
      y={y - 4.5}
      width={9}
      height={9}
      rx={2}
      strokeWidth={1.5}
      className={cn(HOLE_CLASS[state], 'transition-[fill,stroke] duration-300 ease-out')}
    />
  )
}

/**
 * Every hole on the board, with the ones belonging to a lit net filled in.
 *
 * Filling the whole column rather than the single hole a leg sits in is the
 * teaching move: it shows that the five holes *are* the node, which is the fact
 * a beginner has to internalise before any of the diagnostics make sense.
 */
function TiePoints({
  lit,
  focused,
  faulted,
  onNetSelect,
}: {
  lit: Set<NetId>
  focused: NetId | null
  faulted: NetId | null
  onNetSelect?: (net: NetId) => void
}) {
  const columnNet = React.useMemo(() => {
    const upper = new Map<number, NetId>()
    const lower = new Map<number, NetId>()
    for (const net of NETS) {
      for (const column of net.upperColumns) upper.set(column, net.id)
      for (const column of net.lowerColumns) lower.set(column, net.id)
    }
    return { upper, lower }
  }, [])

  const stateFor = (net: NetId | undefined): HoleState => {
    if (!net) return 'idle'
    // The fault reading wins over the focus one: a broken net that turns accent
    // blue because the pointer is on it would contradict the row saying absent.
    if (faulted === net && lit.has(net)) return 'fault'
    if (focused === net) return 'focused'
    return lit.has(net) ? 'lit' : 'idle'
  }

  return (
    <g>
      {Array.from({ length: COLUMNS }, (_, column) => {
        const upperNet = columnNet.upper.get(column)
        const lowerNet = columnNet.lower.get(column)

        return (
          <g key={column}>
            <ColumnGroup
              column={column}
              net={upperNet}
              state={stateFor(upperNet)}
              y={upperY}
              onNetSelect={onNetSelect}
            />
            <ColumnGroup
              column={column}
              net={lowerNet}
              state={stateFor(lowerNet)}
              y={lowerY}
              onNetSelect={onNetSelect}
            />
          </g>
        )
      })}
    </g>
  )
}

function ColumnGroup({
  column,
  net,
  state,
  y,
  onNetSelect,
}: {
  column: number
  net: NetId | undefined
  state: HoleState
  y: (row: number) => number
  onNetSelect?: (net: NetId) => void
}) {
  const interactive = Boolean(net && onNetSelect)

  return (
    <g
      className={cn(interactive && 'cursor-pointer')}
      onClick={net && onNetSelect ? () => onNetSelect(net) : undefined}
    >
      {/* The bonding clip under the column, shown only once the net is found. */}
      {state !== 'idle' ? (
        <rect
          x={columnX(column) - 8}
          y={y(0) - 8}
          width={16}
          height={(ROWS - 1) * PITCH + 16}
          rx={8}
          className={cn(
            'transition-opacity duration-300 ease-out',
            state === 'fault' ? 'fill-fault/10' : 'fill-accent/10',
          )}
        />
      ) : null}

      {Array.from({ length: ROWS }, (_, row) => (
        <Hole key={row} x={columnX(column)} y={y(row)} state={state} />
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
/* Components                                                                 */
/* -------------------------------------------------------------------------- */

/** 220Ω: red-red-brown, which is what the first exercise actually asks for. */
function Resistor() {
  const x1 = columnX(2)
  const x2 = columnX(7)
  const y = upperY(1)
  const bodyStart = x1 + 22
  const bodyEnd = x2 - 22

  return (
    <g className="animate-rise-in">
      <path
        d={`M ${x1} ${y} L ${bodyStart} ${y}`}
        className="stroke-text-tertiary"
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M ${bodyEnd} ${y} L ${x2} ${y}`}
        className="stroke-text-tertiary"
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
      />
      <rect
        x={bodyStart}
        y={y - 11}
        width={bodyEnd - bodyStart}
        height={22}
        rx={9}
        className="fill-warn-surface stroke-warn-line"
        strokeWidth={1.5}
      />
      {[0.28, 0.45, 0.62].map((at, index) => (
        <rect
          key={at}
          x={bodyStart + (bodyEnd - bodyStart) * at}
          y={y - 10}
          width={4}
          height={20}
          className={index === 2 ? 'fill-warn-ink' : 'fill-fault'}
        />
      ))}
    </g>
  )
}

/** A red LED. The long leg is the anode — the thing students put in backwards. */
function Led({ lit }: { lit: boolean }) {
  const x = columnX(12)
  const anodeY = upperY(3)
  const cathodeY = lowerY(1)
  const bodyY = (anodeY + cathodeY) / 2

  return (
    <g className="stagger-1 animate-rise-in">
      <path
        d={`M ${x} ${anodeY} L ${x} ${bodyY - 14}`}
        className="stroke-text-tertiary"
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M ${x + 10} ${bodyY + 12} L ${x + 10} ${cathodeY}`}
        className="stroke-text-tertiary"
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
      />
      {/* The glow is the payoff, and it only appears when the circuit is whole. */}
      {lit ? <circle cx={x + 5} cy={bodyY} r={26} className="animate-fade-in fill-fault/20" /> : null}
      <path
        d={`M ${x - 9} ${bodyY + 12} L ${x - 9} ${bodyY - 4} A 14 14 0 0 1 ${x + 19} ${bodyY - 4} L ${x + 19} ${bodyY + 12} Z`}
        className={cn(
          'stroke-fault transition-[fill] duration-500 ease-out',
          lit ? 'fill-fault' : 'fill-fault/35',
        )}
        strokeWidth={1.5}
      />
    </g>
  )
}

/**
 * The two jumpers. The ground one is the fault: when `fault` is set it lands on
 * the upper bank, so the LED's cathode and the ground rail are two nets.
 */
/** The rail jumper that brings +5V onto the board. First part in. */
function SupplyJumper() {
  return (
    <g className="animate-rise-in">
      <Wire
        from={{ x: columnX(2), y: RAIL_TOP_Y + 16 }}
        to={{ x: columnX(2), y: upperY(0) }}
        className="stroke-fault"
      />
    </g>
  )
}

/**
 * The ground jumper — the last part in, and the one that is wrong.
 *
 * Drawn solid and at the same weight as the other, even when misplaced. The
 * board shows what was *built*; dashing the wrong wire would be the drawing
 * marking its own homework. The ring, and the netlist row beside it, carry the
 * diagnosis.
 */
function GroundJumper({ fault, lit }: { fault: boolean; lit: Set<NetId> }) {
  const from = { x: columnX(FAULT_COLUMN + 4), y: RAIL_BOTTOM_Y - 16 }
  const to = fault
    ? // The far side of the channel: same column as the cathode, wrong bank.
      // It looks aligned, which is exactly why the mistake is so easy to make.
      { x: columnX(FAULT_COLUMN), y: upperY(ROWS - 1) }
    : { x: columnX(FAULT_COLUMN), y: lowerY(ROWS - 1) }

  return (
    <g className="animate-rise-in">
      <Wire from={from} to={to} className="stroke-info" />
      {fault && lit.has('n3') ? (
        <g className="animate-fade-in">
          <circle cx={to.x} cy={to.y} r={14} className="fill-fault/15 stroke-fault" strokeWidth={1.5} />
        </g>
      ) : null}
    </g>
  )
}

function Wire({
  from,
  to,
  className,
  dashed = false,
}: {
  from: { x: number; y: number }
  to: { x: number; y: number }
  className: string
  dashed?: boolean
}) {
  // A shallow arc, because a real jumper does not lie flat. The control point
  // leans toward whichever end is higher so the curve looks slack, not taut.
  const midX = (from.x + to.x) / 2
  const lift = Math.max(24, Math.abs(to.x - from.x) * 0.35)
  const controlY = (from.y + to.y) / 2 - lift

  return (
    <path
      d={`M ${from.x} ${from.y} Q ${midX} ${controlY} ${to.x} ${to.y}`}
      className={cn(className, 'opacity-90')}
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeDasharray={dashed ? '7 6' : undefined}
      fill="none"
    />
  )
}

/* -------------------------------------------------------------------------- */
/* Scan and labels                                                            */
/* -------------------------------------------------------------------------- */

/** The sweep that reads the board. Position is driven from outside, not by CSS. */
function ScanLine({ at }: { at: number }) {
  const x = ORIGIN_X - 24 + (BOARD_WIDTH - (ORIGIN_X - 24) * 2) * at

  return (
    <g>
      <line
        x1={x}
        y1={RAIL_TOP_Y - 20}
        x2={x}
        y2={RAIL_BOTTOM_Y + 20}
        className="stroke-accent"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <rect
        x={x - 26}
        y={RAIL_TOP_Y - 20}
        width={26}
        height={RAIL_BOTTOM_Y - RAIL_TOP_Y + 40}
        className="fill-accent/10"
      />
    </g>
  )
}

function NetLabel({ net, fault }: { net: NetId; fault: boolean }) {
  const spec = NETS.find((candidate) => candidate.id === net)
  if (!spec) return null

  const broken = fault && spec.faultable === true
  const column = spec.upperColumns[0] ?? spec.lowerColumns[0] ?? 0
  const onUpper = spec.upperColumns.length > 0
  const x = columnX(column)
  const y = onUpper ? upperY(0) - 26 : lowerY(ROWS - 1) + 34

  return (
    <g className="animate-fade-in">
      <rect
        x={x - 26}
        y={y - 15}
        width={52}
        height={24}
        rx={12}
        className={broken ? 'fill-fault stroke-fault' : 'fill-accent stroke-accent'}
      />
      <text
        x={x}
        y={y + 2}
        textAnchor="middle"
        className="fill-accent-contrast font-mono text-[14px] font-medium"
      >
        {spec.label}
      </text>
    </g>
  )
}
