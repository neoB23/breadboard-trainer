import * as React from 'react'

import { cn } from '@/lib/utils'

/** `difficultySchema` is 1–5, so the meter is five pips. Not a caller decision. */
const STEPS = 5

export interface DifficultyMeterProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** 1–5. Values outside the range are clamped rather than dropped. */
  level: number
  /**
   * The reading, in words — "Difficulty 3 of 5". Required, and not optional on
   * purpose: five bars are a picture, and a picture with no name is a control
   * that does not exist for anyone using a screen reader.
   */
  label: string
  size?: 'sm' | 'md'
}

/**
 * Five bars, filled to the level. The unit of an exercise list.
 *
 * A `Badge` reading "Difficulty 3 of 5" was here first and it was correct but
 * slow: in a list of eight exercises it is eight sentences to compare, where the
 * bars are one shape. The sentence is still there — as the accessible name — so
 * nothing is lost by not being able to see it.
 *
 * This is a quantity, not one of the five semantic states, so it draws in the
 * accent rather than from a state trio, and the "never colour alone" rule is met
 * by the fill *count* being the signal: it survives greyscale, because three
 * filled bars are three filled bars.
 */
export function DifficultyMeter({ level, label, size = 'md', className, ...props }: DifficultyMeterProps) {
  const filled = Math.max(0, Math.min(STEPS, Math.round(level)))

  return (
    <span
      role="img"
      aria-label={label}
      className={cn('inline-flex items-center', size === 'sm' ? 'gap-0.5' : 'gap-1', className)}
      {...props}
    >
      {Array.from({ length: STEPS }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={cn(
            'rounded-pill',
            size === 'sm' ? 'h-2 w-0.5' : 'h-2.5 w-1',
            index < filled ? 'bg-accent' : 'bg-bg-600',
          )}
        />
      ))}
    </span>
  )
}
