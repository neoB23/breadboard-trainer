import * as React from 'react'

import { cn } from '@/lib/utils'

import { useReducedMotion } from './use-board-sequence'

/**
 * The hero's background: printed-circuit routing, generated rather than fetched.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS AND NOT A PHOTOGRAPH
 *
 * A video of a real lab bench would be the obvious choice and is the wrong one
 * here. It is megabytes on a campus connection, it needs a licence and a poster
 * frame and a still for reduced motion, it fights the headline sitting on top of
 * it at every viewport, and it cannot follow the theme. This costs about two
 * kilobytes, scales to any screen, and is the same blue as everything else
 * because it is drawn from the same token.
 *
 * It is also on-topic in a way stock footage never is: these are the traces of
 * the thing the product is about.
 * ---------------------------------------------------------------------------
 *
 * Held to the brief's rule that the background must never compete with the words
 * over it. Every stroke is white at 8–14% on the accent band, which is a shade
 * away from invisible and deliberately so — you should notice it only if you
 * look for it.
 */

/** Trace routing is 45° or orthogonal, never an arbitrary angle. Real PCBs are. */
interface Trace {
  d: string
  /** Path length, so the draw-in can be timed without measuring in the DOM. */
  length: number
  delay: number
}

/**
 * Deterministic, not random.
 *
 * A `Math.random()` layout would differ between the server-rendered and hydrated
 * markup, and — worse for review — would differ between two screenshots of the
 * same commit, so nobody could tell a regression from a reroll.
 */
function buildTraces(width: number, height: number, count: number): Trace[] {
  const traces: Trace[] = []
  const step = height / (count + 1)

  for (let index = 0; index < count; index += 1) {
    const y = step * (index + 1)
    // A cheap deterministic hash, so each trace bends differently but always the
    // same way for a given index.
    const seed = (index * 2654435761) % 1000
    const bend = 80 + (seed % 220)
    const dip = ((seed % 7) - 3) * 46
    const startX = -60 - (seed % 160)
    const midX = bend + (index % 4) * 190

    // 45° elbows: horizontal, diagonal, horizontal. The diagonal segment is
    // exactly as tall as it is wide, which is what makes the corner 45°.
    const run = Math.abs(dip)
    const d =
      dip === 0
        ? `M ${startX} ${y} H ${width + 60}`
        : `M ${startX} ${y} H ${midX} L ${midX + run} ${y + dip} H ${width + 60}`

    traces.push({
      d,
      length: width + 260 + run,
      delay: index * 220,
    })
  }

  return traces
}

/** Where a trace meets a pad. Drawn as the ring a real via is. */
interface Via {
  x: number
  y: number
  delay: number
}

function buildVias(width: number, height: number, columns: number, rows: number): Via[] {
  const vias: Via[] = []
  const gapX = width / (columns + 1)
  const gapY = height / (rows + 1)

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      // Skip roughly a third, so the field reads as a layout rather than a grid.
      if ((row * 7 + column * 3) % 3 === 0) continue
      vias.push({
        x: gapX * (column + 1),
        y: gapY * (row + 1),
        delay: (row * columns + column) * 40,
      })
    }
  }

  return vias
}

const WIDTH = 1600
const HEIGHT = 900

export interface CircuitBackdropProps {
  className?: string
}

export function CircuitBackdrop({ className }: CircuitBackdropProps) {
  const still = useReducedMotion()

  const traces = React.useMemo(() => buildTraces(WIDTH, HEIGHT, 9), [])
  const vias = React.useMemo(() => buildVias(WIDTH, HEIGHT, 18, 7), [])

  return (
    <div
      // `aria-hidden` and `pointer-events-none`: it is texture. Nothing here is
      // information, and nothing here may intercept a click meant for the
      // buttons sitting on top of it.
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid slice" className="size-full">
        <g className="stroke-accent-contrast" fill="none" strokeLinecap="square">
          {traces.map((trace, index) => (
            <path
              key={index}
              d={trace.d}
              strokeWidth={2}
              className="opacity-[0.14]"
              style={
                still
                  ? undefined
                  : {
                      strokeDasharray: trace.length,
                      strokeDashoffset: trace.length,
                      // Inline because the values are per-trace and computed;
                      // the keyframes themselves live in index.css, so
                      // `.reduce-motion` still reaches them.
                      animation: `trace-draw 2600ms cubic-bezier(0.16, 1, 0.3, 1) ${trace.delay}ms forwards`,
                    }
              }
            />
          ))}
        </g>

        <g className="fill-accent-contrast">
          {vias.map((via, index) => (
            <circle
              key={index}
              cx={via.x}
              cy={via.y}
              r={3}
              // The class, not an inline animation: this one has a utility, so
              // Tailwind emits the keyframes and only the delay needs setting.
              className={cn('opacity-[0.16]', !still && 'animate-fade-in')}
              style={still ? undefined : { animationDelay: `${900 + via.delay}ms` }}
            />
          ))}
        </g>
      </svg>

      {/*
        A scrim over the whole thing, heaviest on the left where the headline is.
        Without it the traces run under the text at exactly the wrong contrast on
        a wide screen, and the brief's first rule is that nothing costs the
        reader legibility.
      */}
      <div className="absolute inset-0 bg-gradient-to-r from-accent via-accent/70 to-transparent" />
    </div>
  )
}
