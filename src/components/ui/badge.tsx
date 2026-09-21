import { cva, type VariantProps } from 'class-variance-authority'
import { CircleCheck, CircleDot, Info, OctagonX, TriangleAlert } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * A pill, like every other interactive-scale control. Each tone draws from its
 * own `-surface` / `-line` / `-ink` trio, so the fill stays a whisper and the
 * label keeps full contrast against it — a badge should never read as a chip of
 * saturated colour dropped onto the page.
 *
 * There is no separate chip component: a chip is this, with a category label
 * instead of a state.
 */
const badgeVariants = cva(
  // size-3.5 rather than the size-4 used in chrome — this is an inline glyph
  // sized to a 12px label, and a 16px icon would inflate the pill.
  'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-xs font-medium [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      tone: {
        ok: 'border-ok-line bg-ok-surface text-ok-ink',
        warn: 'border-warn-line bg-warn-surface text-warn-ink',
        fault: 'border-fault-line bg-fault-surface text-fault-ink',
        info: 'border-info-line bg-info-surface text-info-ink',
        neutral: 'border-neutral-line bg-neutral-surface text-neutral-ink',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}

/**
 * One distinct silhouette per tone — circle, triangle, octagon — so the state
 * survives greyscale, dichromacy and a low-quality projector.
 */
const toneIcon = {
  ok: CircleCheck,
  warn: TriangleAlert,
  fault: OctagonX,
  info: Info,
  neutral: CircleDot,
} as const

/**
 * The only badge allowed to express one of the five semantic states.
 *
 * It hard-wires a distinct icon shape per tone, which is what makes the state
 * readable without colour at all. Reach for the plain `Badge` when the label
 * is a category rather than a status.
 */
export function StatusBadge({
  tone = 'neutral',
  children,
  className,
  ...props
}: BadgeProps & { tone?: BadgeTone }) {
  const Icon = toneIcon[tone]
  return (
    <Badge tone={tone} className={className} {...props}>
      <Icon aria-hidden="true" />
      {children}
    </Badge>
  )
}

export { badgeVariants }
