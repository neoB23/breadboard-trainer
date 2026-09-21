import * as React from 'react'

import { BUILD_STEPS, BUILD_TOTAL, NETS, type BuildStep, type NetId } from './geometry'

/**
 * The build → extract → compare sequence, as a small state machine.
 *
 * It is deliberately *not* a CSS animation. The netlist beside the board fills
 * in as each net is found, so the drawing and the listing have to advance
 * together — two independent CSS timelines drift, and the moment they do the
 * demo stops explaining anything and starts looking broken.
 */

export type BoardStage = 'idle' | 'placing' | 'scanning' | 'reading' | 'diagnosed'

export interface BoardSequenceState {
  stage: BoardStage
  /** How many parts are in, 0 to BUILD_TOTAL. */
  placed: number
  /**
   * The part going in right now, or null once assembly is done.
   *
   * The showcase names it in the status line. Watching a board assemble without
   * being told what each piece is answers "something is happening"; being told
   * answers "this is a resistor going between the rail and the LED", which is
   * the difference between decoration and a demonstration.
   */
  placing: BuildStep | null
  /** Nets found so far, in the order the scan found them. */
  found: NetId[]
  /** 0–1 sweep position, or null when the sweep is not running. */
  scan: number | null
  /** True once the missing net has been called out. */
  diagnosed: boolean
  /** Whether motion is suppressed — the caller renders controls differently. */
  still: boolean
  /** Restart from empty. The "run it again" button. */
  replay: () => void
}

/** Milliseconds per step. Slow enough to follow, short enough to loop. */
/**
 * Slow enough to read the caption that goes with each part.
 *
 * This was 620ms across three unlabelled steps, which is under two seconds for
 * the whole build — and because the 3D scene ignored the count entirely, the
 * hero showed a finished board the whole time. Both are fixed; this is the
 * pacing that makes the fix visible.
 */
const PLACE_MS = 950
const SCAN_MS = 1500
const NET_MS = 620
const DIAGNOSE_MS = 900
/**
 * How long the finished board and its diagnosis stay on screen before the loop
 * starts over. Deliberately the longest step by some way: the diagnosis is three
 * lines of the only text on this page that explains the product, and a loop that
 * wipes it before it has been read is worse than no loop at all.
 */
const HOLD_MS = 6500

/**
 * True when the person has asked for less motion, by either route.
 *
 * Both are checked because they mean the same thing and arrive differently: the
 * OS setting comes through `prefers-reduced-motion`, and the in-app toggle puts
 * `.reduce-motion` on `<html>` (see `applyPreferences`). The class is watched
 * with a `MutationObserver` so flipping the switch in `/settings` stops this
 * immediately rather than at the next reload.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false)

  React.useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const root = document.documentElement

    const read = () => setReduced(media.matches || root.classList.contains('reduce-motion'))

    read()
    media.addEventListener('change', read)
    const observer = new MutationObserver(read)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })

    return () => {
      media.removeEventListener('change', read)
      observer.disconnect()
    }
  }, [])

  return reduced
}

const FINAL: Omit<BoardSequenceState, 'still' | 'replay'> = {
  stage: 'diagnosed',
  placed: BUILD_TOTAL,
  placing: null,
  found: NETS.map((net) => net.id),
  scan: null,
  diagnosed: true,
}

export interface BoardSequenceOptions {
  /** Pause the loop without resetting it — used when the board is off screen. */
  paused?: boolean
}

export function useBoardSequence({ paused = false }: BoardSequenceOptions = {}): BoardSequenceState {
  const still = useReducedMotion()

  const [state, setState] = React.useState<Omit<BoardSequenceState, 'still' | 'replay'>>(() => ({
    stage: 'idle',
    placed: 0,
    placing: null,
    found: [],
    scan: null,
    diagnosed: false,
  }))

  const [run, setRun] = React.useState(0)
  const replay = React.useCallback(() => setRun((value) => value + 1), [])

  React.useEffect(() => {
    /**
     * Under reduced motion the sequence does not play at all — it jumps to the
     * finished board and stays there.
     *
     * This is the part a global `transition-duration: 0` cannot do. Zeroing the
     * durations of a JavaScript timeline just makes it flash through every stage
     * as fast as the event loop allows, which is *more* motion, not less. The
     * only honest reading of "reduce motion" here is to show the answer.
     */
    if (still) {
      setState(FINAL)
      return
    }

    if (paused) return

    setState({ stage: 'idle', placed: 0, placing: null, found: [], scan: null, diagnosed: false })

    const timers: ReturnType<typeof setTimeout>[] = []
    let raf = 0
    const at = (delay: number, fn: () => void) => timers.push(setTimeout(fn, delay))

    let clock = 320

    /* ---- place the parts, one at a time ---------------------------------- */
    BUILD_STEPS.forEach((part, index) => {
      at(clock, () => setState((prev) => ({ ...prev, stage: 'placing', placed: index + 1, placing: part })))
      clock += PLACE_MS
    })

    // A beat with the finished circuit before the scan starts, so the last part
    // is seen going in rather than being wiped by the sweep.
    at(clock, () => setState((prev) => ({ ...prev, placing: null })))
    clock += 500

    /* ---- sweep the board ------------------------------------------------- */
    const scanStartsAt = clock
    at(scanStartsAt, () => {
      setState((prev) => ({ ...prev, stage: 'scanning', scan: 0 }))

      const started = performance.now()
      const tick = () => {
        const progress = Math.min(1, (performance.now() - started) / SCAN_MS)
        setState((prev) => (prev.stage === 'scanning' ? { ...prev, scan: progress } : prev))
        if (progress < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    })
    clock += SCAN_MS

    /* ---- read the nets off, one at a time -------------------------------- */
    at(clock, () => setState((prev) => ({ ...prev, stage: 'reading', scan: null })))
    for (const net of NETS) {
      at(clock, () => setState((prev) => ({ ...prev, found: [...prev.found, net.id] })))
      clock += NET_MS
    }

    /* ---- name the fault -------------------------------------------------- */
    clock += DIAGNOSE_MS
    at(clock, () => setState((prev) => ({ ...prev, stage: 'diagnosed', diagnosed: true })))

    /* ---- hold, then go round again --------------------------------------- */
    at(clock + HOLD_MS, replay)

    return () => {
      for (const timer of timers) clearTimeout(timer)
      cancelAnimationFrame(raf)
    }
  }, [still, paused, run, replay])

  return { ...state, still, replay }
}

/**
 * Whether an element is on screen, so the loop can stop when it is not.
 *
 * A timeline running behind a scrolled-past hero is a battery cost and a
 * needless render every 600ms on a laptop that may well be a lab machine from
 * 2016. Defaults to visible so nothing depends on the observer having fired.
 */
export function useOnScreen<T extends Element>(ref: React.RefObject<T | null>): boolean {
  const [visible, setVisible] = React.useState(true)

  React.useEffect(() => {
    const element = ref.current
    if (!element || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry) setVisible(entry.isIntersecting)
      },
      { rootMargin: '80px' },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return visible
}
