import type { ComponentType } from '../../shared/contracts/index.ts'
import type { PlacedPart } from '../../src/board/model.ts'

/**
 * The instructor's reference circuits for the seeded exercises — real boards,
 * built from each exercise's own tray and seated the way the workspace seats
 * parts (a transistor across three adjacent columns of one row; any other
 * part between any two holes).
 *
 * The seed turns these into golden netlists with the same `buildGoldenNetlist`
 * Learn Mode capture uses, so a seeded reference is exactly what an instructor
 * would have produced by building it on screen and pressing Capture. The test
 * suite builds its students' boards from here too, shifted along the board, so
 * "the same circuit somewhere else scores full marks" is tested on the very
 * references students are graded against.
 *
 * Board coordinates: columns 0–19, rows 0–4 per bank; `U` upper bank, `L`
 * lower, `T` the +5V rail, `B` ground.
 */

function part(
  id: string,
  type: ComponentType,
  bomItemId: string,
  holes: string[],
  value: string | null,
): PlacedPart {
  return { id, bomItemId, type, label: null, value, holes }
}

/** +5V → jumper → 220Ω → jumper → LED across the channel → jumper → ground. */
export function seriesLedBoard(): PlacedPart[] {
  return [
    part('ref-w1', 'jumper', 'jumper', ['T2', 'U2r0'], null),
    part('ref-r1', 'resistor', 'r-220', ['U2r1', 'U7r1'], '220Ω'),
    part('ref-w2', 'jumper', 'jumper', ['U7r2', 'U12r2'], null),
    part('ref-d1', 'led', 'led-red', ['U12r3', 'L12r1'], 'Red 2V'),
    part('ref-w3', 'jumper', 'jumper', ['L12r4', 'B14'], null),
  ]
}

/** Two identical branches, each LED with its own resistor. */
export function parallelLedsBoard(): PlacedPart[] {
  return [
    part('ref-w1', 'jumper', 'jumper', ['T2', 'U2r0'], null),
    part('ref-r1', 'resistor', 'r-220-a', ['U2r1', 'U5r1'], '220Ω'),
    part('ref-d1', 'led', 'led-red', ['U5r2', 'L5r0'], 'Red 2V'),
    part('ref-w2', 'jumper', 'jumper', ['L5r1', 'B5'], null),
    part('ref-w3', 'jumper', 'jumper', ['T10', 'U10r0'], null),
    part('ref-r2', 'resistor', 'r-220-a', ['U10r1', 'U13r1'], '220Ω'),
    part('ref-d2', 'led', 'led-red', ['U13r2', 'L13r0'], 'Red 2V'),
    part('ref-w4', 'jumper', 'jumper', ['L13r1', 'B13'], null),
  ]
}

/**
 * The tray has one two-lead "potentiometer", and a two-pin part cannot be a
 * three-terminal divider — the wiper has nowhere to go. Until the part library
 * has a real potentiometer, the honest reference is the resistor across the
 * rails, which is what a student can actually build from this tray.
 */
export function potDividerBoard(): PlacedPart[] {
  return [
    part('ref-w1', 'jumper', 'jumper', ['T4', 'U4r0'], null),
    part('ref-r1', 'resistor', 'pot-10k', ['U4r1', 'U9r1'], '10kΩ'),
    part('ref-w2', 'jumper', 'jumper', ['U9r2', 'B9'], null),
  ]
}

/** +5V → 1kΩ → the output node → 100nF → ground, with the output run out to column 9. */
export function rcFilterBoard(): PlacedPart[] {
  return [
    part('ref-w1', 'jumper', 'jumper', ['T2', 'U2r0'], null),
    part('ref-r1', 'resistor', 'r-1k', ['U2r1', 'U6r1'], '1kΩ'),
    part('ref-c1', 'capacitor', 'c-100n', ['U6r2', 'L6r0'], '100nF'),
    part('ref-w2', 'jumper', 'jumper', ['L6r1', 'B6'], null),
    part('ref-w3', 'jumper', 'jumper', ['U6r3', 'U9r0'], null),
  ]
}

/**
 * Low-side switch: +5V → 220Ω → LED → collector; emitter → ground; base fed
 * from +5V through 1kΩ. Transistor seated C/B/E across columns 10–12.
 */
export function transistorSwitchBoard(): PlacedPart[] {
  return [
    part('ref-r1', 'resistor', 'r-220', ['T3', 'U3r0'], '220Ω'),
    part('ref-d1', 'led', 'led-red', ['U3r1', 'U10r1'], 'Red 2V'),
    part('ref-q1', 'transistor', 'q-2n2222', ['U10r0', 'U11r0', 'U12r0'], '2N2222'),
    part('ref-r2', 'resistor', 'r-1k', ['T15', 'U11r1'], '1kΩ'),
    part('ref-w1', 'jumper', 'jumper', ['U12r1', 'B12'], null),
  ]
}

/**
 * The two-transistor astable multivibrator. Each side: +5V → 470Ω → LED →
 * collector, +5V → 10kΩ → base, emitter → ground; each collector couples to
 * the other side's base through 10µF. Q1 sits in the upper bank across
 * columns 3–5, Q2 in the lower bank across 13–15, so the timing capacitors
 * cross the channel — which is the point of the exercise.
 */
export function astableBoard(): PlacedPart[] {
  return [
    part('ref-q1', 'transistor', 'q-2n2222', ['U3r0', 'U4r0', 'U5r0'], '2N2222'),
    part('ref-q2', 'transistor', 'q-2n2222', ['L13r0', 'L14r0', 'L15r0'], '2N2222'),
    part('ref-w1', 'jumper', 'jumper', ['U5r1', 'B5'], null),
    part('ref-w2', 'jumper', 'jumper', ['L15r1', 'B15'], null),
    part('ref-r1', 'resistor', 'r-470', ['T1', 'U1r0'], '470Ω'),
    part('ref-d1', 'led', 'led-red', ['U1r1', 'U3r1'], 'Red 2V'),
    part('ref-r2', 'resistor', 'r-470', ['T11', 'U11r0'], '470Ω'),
    part('ref-d2', 'led', 'led-red', ['U11r1', 'L13r1'], 'Red 2V'),
    part('ref-r3', 'resistor', 'r-10k', ['T7', 'U4r1'], '10kΩ'),
    part('ref-r4', 'resistor', 'r-10k', ['T17', 'L14r1'], '10kΩ'),
    part('ref-c1', 'capacitor', 'c-10u', ['U3r2', 'L14r2'], '10µF'),
    part('ref-c2', 'capacitor', 'c-10u', ['L13r2', 'U4r2'], '10µF'),
  ]
}

/**
 * Moves every part `by` columns along — the same circuit, somewhere else. Used
 * by the seed's sample attempts and by the tests; the result is only valid
 * while every hole stays on the board.
 */
export function shiftBoard(parts: readonly PlacedPart[], by: number, idPrefix = 'stu'): PlacedPart[] {
  return parts.map((p) => ({
    ...p,
    id: p.id.replace(/^ref/, idPrefix),
    holes: p.holes.map((hole) =>
      hole.replace(/^([ULTB])(\d+)/, (_, bank: string, column: string) => `${bank}${Number(column) + by}`),
    ),
  }))
}
