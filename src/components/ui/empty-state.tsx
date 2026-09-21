import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

import { Eyebrow } from './signature'

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon
  /** Micro label above the title, for when the region needs naming as well. */
  eyebrow?: string
  title: string
  description?: string
  /** The one thing the user should do next. Optional, but usually present. */
  action?: React.ReactNode
}

/**
 * Every list in the app renders this instead of nothing. A blank region reads
 * as a bug; a designed empty state reads as "there is genuinely nothing here".
 *
 * It is a panel rather than the usual dashed outline — a dashed border says
 * "content is missing", and here nothing is missing. The disc, the display
 * title and the `py-16` are what carry that: it should look like a resting
 * state, not a gap.
 */
export function EmptyState({
  icon: Icon = Inbox,
  eyebrow,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex animate-rise-in flex-col items-center justify-center rounded-panel border border-line bg-bg-800 px-8 py-16 text-center',
        className,
      )}
      {...props}
    >
      <span className="flex size-12 items-center justify-center rounded-pill border border-line bg-bg-700">
        <Icon className="size-5 text-text-tertiary" aria-hidden="true" />
      </span>
      {eyebrow ? <Eyebrow className="mt-6">{eyebrow}</Eyebrow> : null}
      {/* A paragraph, not a heading: the empty state substitutes for list
          content and must not inject a level into the page outline. */}
      <p className={cn('font-display text-display-xs text-text-primary', eyebrow ? 'mt-2' : 'mt-6')}>
        {title}
      </p>
      {description ? (
        <p className="mt-2 max-w-prose text-pretty text-sm text-text-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-8 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  )
}
