import * as ProgressPrimitive from '@radix-ui/react-progress'
import * as React from 'react'

import { cn } from '@/lib/utils'

/** The tones a bar may take. Mirrors the badge trio, minus `fault` — a
 *  progress bar is never a failure state, it is just less full. */
export type ProgressTone = 'accent' | 'ok' | 'warn' | 'info'

const TRACK: Record<ProgressTone, string> = {
  accent: 'bg-bg-700',
  ok: 'bg-ok-line/40',
  warn: 'bg-warn-line/40',
  info: 'bg-info-line/40',
}

const FILL: Record<ProgressTone, string> = {
  accent: 'bg-accent',
  ok: 'bg-ok',
  warn: 'bg-warn',
  info: 'bg-info',
}

export interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  /** Micro label above the track. Also names the bar for assistive tech. */
  label?: string
  /** Right-aligned readout beside the label — `3 / 7`, `62%`. */
  readout?: React.ReactNode
  /**
   * Which colour the fill takes. `accent` everywhere the bar is ambient; the
   * three tinted tones exist for a bar sitting *inside* a tinted surface, where
   * the accent would be the one colour on the card that belongs to nothing.
   */
  tone?: ProgressTone
  /**
   * `hairline` (2px) is the default and the house style — progress here is
   * ambient, and the label and readout carry the reading. `bar` (6px) is for
   * the one case where the bar itself is the reading: a card whose whole job is
   * "how far through this class am I".
   */
  weight?: 'hairline' | 'bar'
}

/**
 * A 2px hairline that happens to fill. Progress here is ambient — how far into
 * onboarding, how much of an exercise is done — so it sits at the same visual
 * weight as a rule and lets the label and readout carry the actual reading.
 *
 * `className` lands on the wrapper, which is what callers want to size and
 * space; the track's thinness is not a caller decision — `weight` is, and it
 * has exactly two settings so "slightly thicker" never becomes a per-call-site
 * pixel argument.
 */
export const Progress = React.forwardRef<React.ComponentRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  ({ className, value, max = 100, label, readout, tone = 'accent', weight = 'hairline', ...props }, ref) => {
    const labelId = React.useId()
    // Radix treats a null value as indeterminate. There is nothing slow enough
    // in this app to need a crawling bar, so an absent value simply reads as
    // empty — Root still emits the right ARIA for "not yet known".
    const percent = value == null ? 0 : Math.min(Math.max(value / max, 0), 1) * 100

    return (
      <div className={cn('flex w-full flex-col gap-2', className)}>
        {label || readout ? (
          <div className="flex items-baseline justify-between gap-4">
            {label ? (
              <span id={labelId} className="text-micro uppercase text-text-tertiary">
                {label}
              </span>
            ) : null}
            {readout ? (
              <span className="font-mono text-xs tabular-nums text-text-secondary">{readout}</span>
            ) : null}
          </div>
        ) : null}
        <ProgressPrimitive.Root
          ref={ref}
          value={value}
          max={max}
          aria-labelledby={label ? labelId : undefined}
          className={cn(
            'relative w-full overflow-hidden rounded-pill',
            weight === 'bar' ? 'h-1.5' : 'h-0.5',
            TRACK[tone],
          )}
          {...props}
        >
          <ProgressPrimitive.Indicator
            className={cn('h-full w-full transition-transform duration-500 ease-out', FILL[tone])}
            style={{ transform: `translateX(-${100 - percent}%)` }}
          />
        </ProgressPrimitive.Root>
      </div>
    )
  },
)
Progress.displayName = 'Progress'
