import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const chipVariants = cva(
  'inline-flex select-none items-center gap-2 whitespace-nowrap rounded-pill border font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      // Selection is a fill, not a tint: the difference between the two states
      // is weight and contrast, so it survives with colour taken away.
      active: {
        // `accent-ink` only differs from `accent` on light, where the accent is
        // dark enough to have a hover. On dark the chip is already at full
        // emphasis and holding still is the right answer.
        true: 'border-accent bg-accent text-accent-contrast hover:border-accent-ink hover:bg-accent-ink',
        false: 'border-line bg-bg-800 text-text-secondary hover:bg-bg-700 hover:text-text-primary',
      },
      size: {
        sm: 'h-7 px-3 text-xs',
        md: 'h-8 px-3.5 text-sm',
      },
    },
    defaultVariants: { active: false, size: 'md' },
  },
)

export interface ChipProps
  extends
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'>,
    Omit<VariantProps<typeof chipVariants>, 'active'> {
  /** Narrowed from CVA's nullable boolean, since it maps straight to `aria-pressed`. */
  active?: boolean
  /** Facet count shown after the label — the "24" in `Faults 24`. */
  count?: number
}

/**
 * The filter pill. A toggle, so it carries `aria-pressed` rather than pretending
 * to be a link; a set of them is a group of independent on/off facets.
 *
 * The count is mono and dimmed so the eye reads label first and treats the
 * number as an annotation, which is how a facet list actually gets scanned.
 */
export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ active = false, size, count, className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-pressed={active}
      className={cn(chipVariants({ active, size }), className)}
      {...props}
    >
      {children}
      {count === undefined ? null : <span className="font-mono tabular-nums opacity-60">{count}</span>}
    </button>
  ),
)
Chip.displayName = 'Chip'

export { chipVariants }
