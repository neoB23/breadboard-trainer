import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Two radii, because there are only two kinds of thing a skeleton stands in
 * for: a run of text, or a surface. Callers pick the meaning, not the number.
 */
const shapeRadius = {
  line: 'rounded-pill',
  block: 'rounded-card',
} as const

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `line` for text-height placeholders, `block` for cards, media and panels. */
  shape?: keyof typeof shapeRadius
}

/**
 * A loading placeholder. Give it the exact dimensions of the content it stands
 * in for — matching heights is what keeps the layout from shifting when data
 * arrives, which Phase 5 checks explicitly.
 */
export function Skeleton({ shape = 'line', className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('relative overflow-hidden bg-bg-700', shapeRadius[shape], className)}
      {...props}
    >
      {/* The sweep is a clipped child rather than an animated background
          position, so it inherits the parent's exact width and radius however
          the caller sizes it. `bg-600` is the only ground that steps away from
          `bg-700` on both themes — lighter on dark, darker on light. Either
          way it reads as movement, which is all the sweep has to do. */}
      <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-bg-600/70 to-transparent" />
    </div>
  )
}
