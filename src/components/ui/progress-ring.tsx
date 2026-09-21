import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * A completion figure drawn as a ring around something else.
 *
 * ---------------------------------------------------------------------------
 * WHY A RING, WHEN THE SYSTEM'S PROGRESS IS A HAIRLINE
 *
 * Because it is not measuring the same thing. `Progress` is ambient — it sits
 * under a label that already says the number, and its job is to be glanceable
 * without being loud. A ring is for the *one* figure on a screen that is about
 * the person reading it: how far through the course they are. There is one per
 * screen, it wraps their own avatar, and it is the only place the dashboard
 * raises its voice.
 *
 * It is deliberately not a general chart. There is no legend, no second series,
 * no tooltip; if a second number ever needs a ring, that is a sign the screen
 * needs a chart instead.
 * ---------------------------------------------------------------------------
 *
 * Accessibility: the ring is `aria-hidden` and the caller supplies the reading
 * in text next to it. A `role="progressbar"` here would announce a percentage
 * that the visible label already states, which is one reading too many.
 *
 * Every colour is a token utility, so it follows light, dark and high contrast
 * without a second copy — the same rule the board drawing follows.
 */

export interface ProgressRingProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100. Clamped, so a caller's rounding cannot overdraw the ring. */
  value: number
  /** Outer diameter in px. The stroke scales with it. */
  size?: number
  /** Ring thickness in px. */
  thickness?: number
  /** What sits inside the ring — an avatar, initials, a number. */
  children?: React.ReactNode
}

export function ProgressRing({
  value,
  size = 96,
  thickness = 4,
  className,
  children,
  ...props
}: ProgressRingProps) {
  // The dash length is set to "empty" for the first paint and to the real value
  // immediately after, so the ring draws itself in rather than appearing full.
  // Under `.reduce-motion` the transition duration is zeroed globally and this
  // collapses to a single frame — no branch needed here.
  const [drawn, setDrawn] = React.useState(false)
  React.useEffect(() => setDrawn(true), [])

  const percent = Math.min(Math.max(value, 0), 100)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }} {...props}>
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 size-full -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          className="stroke-bg-600"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={drawn ? circumference * (1 - percent / 100) : circumference}
          className="stroke-accent transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>

      {/* Inset by the stroke so the contents never sit under the ring. */}
      <div className="absolute flex items-center justify-center" style={{ inset: thickness * 2 }}>
        {children}
      </div>
    </div>
  )
}
