/**
 * The board's measurements, in viewBox units, and the one idea they encode.
 *
 * A solderless breadboard is not a grid of independent holes. Within one half,
 * the five holes of a column are a single electrical node — bonded by a metal
 * clip underneath — and the centre channel breaks the connection between the two
 * halves. Every rule in this file exists to make that visible rather than to
 * make the picture pretty.
 *
 * Kept separate from the drawing so the animation, the netlist and the board all
 * do their arithmetic from one source. A jumper that lands half a pitch off is
 * the kind of thing nobody notices in a review and everybody notices on a
 * projector.
 */

/** Centre-to-centre hole spacing. A real board is 0.1in; this is that, scaled. */
export const PITCH = 24

/** Holes per column in one half. Five is universal. */
export const ROWS = 5

/** Columns drawn. A real full-size board has 30; 20 reads better at hero size. */
export const COLUMNS = 20

/** Left edge of column 0. */
export const ORIGIN_X = 56

/** Top edge of the upper bank, below the power rail. */
export const ORIGIN_Y = 96

/**
 * The gap between the two banks. This is the component the whole product is
 * about: it is why a DIP chip straddles the middle, and why a jumper on the
 * wrong side of it produces two nets where the student meant one.
 */
export const CHANNEL = 40

export const BOARD_WIDTH = ORIGIN_X * 2 + (COLUMNS - 1) * PITCH
export const BANK_HEIGHT = (ROWS - 1) * PITCH
export const BOARD_HEIGHT = ORIGIN_Y + BANK_HEIGHT * 2 + CHANNEL + 96

/** x of a column index, 0-based. */
export const columnX = (column: number): number => ORIGIN_X + column * PITCH

/** y of a hole in the upper bank, row 0 nearest the rail. */
export const upperY = (row: number): number => ORIGIN_Y + row * PITCH

/** y of a hole in the lower bank, row 0 nearest the channel. */
export const lowerY = (row: number): number => ORIGIN_Y + BANK_HEIGHT + CHANNEL + row * PITCH

/** The two power rails, above and below the banks. */
export const RAIL_TOP_Y = 44
export const RAIL_BOTTOM_Y = lowerY(ROWS - 1) + 52

/* -------------------------------------------------------------------------- */
/* The circuit being built                                                    */
/* -------------------------------------------------------------------------- */

export type NetId = 'n1' | 'n2' | 'n3'

/**
 * One branch: +5V, through a 220Ω resistor, into an LED, back to ground. The
 * smallest circuit that still has a polarity to get wrong and a rail to miss,
 * which is exactly the first exercise a second-year student is given.
 */
export interface NetSpec {
  id: NetId
  /** What the extracted netlist calls it. */
  label: string
  /** The two things joined, as the netlist prints them. */
  members: string
  /** Column indices whose holes belong to this net, per bank. */
  upperColumns: number[]
  lowerColumns: number[]
  /** True when this net is the one the fault breaks. */
  faultable?: boolean
}

export const NETS: readonly NetSpec[] = [
  {
    id: 'n1',
    label: 'N1',
    members: '+5V · R1.1',
    upperColumns: [2],
    lowerColumns: [],
  },
  {
    id: 'n2',
    label: 'N2',
    members: 'R1.2 · D1.A',
    upperColumns: [7],
    lowerColumns: [],
  },
  {
    id: 'n3',
    label: 'N3',
    members: 'D1.K · GND',
    upperColumns: [],
    lowerColumns: [12],
    /**
     * The one that goes wrong. With the ground jumper on the far side of the
     * channel, the LED's cathode and the ground rail sit in two different
     * banks — so what the student drew as one node is two, and the LED never
     * lights. It is the single most common first-lab mistake there is.
     */
    faultable: true,
  },
]

/**
 * Where the ground jumper lands when it is wrong: the same column as the LED's
 * cathode, but the *upper* bank.
 *
 * Deliberately the same column rather than a distant one. The mistake being
 * drawn is "one row off", not "wired somewhere random" — a student looking at
 * their own board sees a jumper that appears to line up perfectly, and the whole
 * lesson is that lining up on the silkscreen is not the same as being on the
 * same node.
 */
export const FAULT_COLUMN = 12

/* -------------------------------------------------------------------------- */
/* Assembly order                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The order the circuit goes together, one part per step.
 *
 * This is the order a person actually builds in, and the demo follows it so that
 * someone watching sees a board being *assembled* rather than a finished board
 * appearing. Power first: you run the rail jumper before you seat anything, so
 * that when the last leg goes in the circuit is complete and the LED either
 * lights or does not.
 *
 * Shared by the flat drawing, the 3D scene and the sequence timer, so all three
 * agree on what "two parts in" means. They disagreed before: the 3D board
 * ignored the count entirely and drew the finished circuit from the first frame,
 * which is why the hero never appeared to build anything.
 */
export const BUILD_STEPS = ['supplyJumper', 'resistor', 'led', 'groundJumper'] as const
export type BuildStep = (typeof BUILD_STEPS)[number]

export const BUILD_TOTAL = BUILD_STEPS.length

/** How far through assembly a given part appears. 1-based, matching `placed`. */
export const BUILD_AT: Record<BuildStep, number> = {
  supplyJumper: 1,
  resistor: 2,
  led: 3,
  groundJumper: 4,
}

export const NET_BY_ID: Record<NetId, NetSpec> = Object.fromEntries(
  NETS.map((net) => [net.id, net]),
) as Record<NetId, NetSpec>
