/**
 * The board drawing and its animated demonstration.
 *
 * Lives under `components/` rather than `features/` because two unrelated
 * screens use it — the landing hero and the auth aside — and a shared drawing
 * that lives inside one feature is a drawing the next screen copies.
 */

export { Breadboard, type BoardCrop, type BreadboardProps } from './breadboard'
export { BoardStage, type BoardStageProps } from './board-stage'
export { CircuitBackdrop, type CircuitBackdropProps } from './circuit-backdrop'
export { BlueprintBackdrop, type BlueprintBackdropProps } from './blueprint-backdrop'
export { BoardShowcase, type BoardShowcaseProps } from './board-showcase'
export { NETS, NET_BY_ID, type NetId, type NetSpec } from './geometry'
export { useBoardSequence, useOnScreen, useReducedMotion } from './use-board-sequence'
