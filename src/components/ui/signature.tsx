import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * The small pieces of page furniture every screen shares: a section label, a
 * rule, a heading block, a headline number.
 *
 * ---------------------------------------------------------------------------
 * WHAT USED TO BE HERE
 *
 * A `TerminalLine` that printed `$ diff ./built.net ./golden.net` above every
 * page title, and a `Marquee` that scrolled the product's vocabulary across the
 * landing page. Both were removed rather than restyled.
 *
 * They were aimed at a developer audience, and the audience is a second-year
 * electronics student and the lecturer marking their work. A shell prompt on a
 * sign-in screen tells that person nothing except that the tool was built by
 * someone who likes terminals, and a scrolling strip of jargon is motion they
 * did not ask for on a page whose job is to explain what this is.
 * ---------------------------------------------------------------------------
 */

/* -------------------------------------------------------------------------- */
/* Eyebrow                                                                     */
/* -------------------------------------------------------------------------- */

export interface EyebrowProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Draws a short accent rule before the label. */
  marker?: boolean
}

/**
 * The small caps label above a heading — the section a screen belongs to, or
 * the category of the thing below it.
 *
 * 11px at 0.06em tracking. It used to be 0.18em, which is an editorial-design
 * amount of tracking and makes a short label genuinely slower to read.
 */
export function Eyebrow({ marker = false, className, children, ...props }: EyebrowProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-micro font-semibold uppercase text-text-tertiary',
        className,
      )}
      {...props}
    >
      {marker ? <span aria-hidden="true" className="h-0.5 w-4 rounded-pill bg-accent" /> : null}
      {children}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Rule                                                                        */
/* -------------------------------------------------------------------------- */

export interface RuleProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: 'default' | 'accent'
}

/** A hairline separator. */
export function Rule({ tone = 'default', className, ...props }: RuleProps) {
  return (
    <div
      role="presentation"
      className={cn('h-px w-full', tone === 'accent' ? 'bg-accent/50' : 'bg-line', className)}
      {...props}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* StatBlock                                                                   */
/* -------------------------------------------------------------------------- */

export interface StatBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  value: React.ReactNode
  label: string
  /** Small qualifier under the label — "of 12 attempts", "vs last week". */
  detail?: string
  tone?: 'default' | 'accent'
}

/** A headline number over its label. The unit of every summary strip. */
export function StatBlock({ value, label, detail, tone = 'default', className, ...props }: StatBlockProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)} {...props}>
      <span
        className={cn(
          'font-display text-display-sm font-semibold tabular-nums tracking-tight',
          tone === 'accent' ? 'text-accent' : 'text-text-primary',
        )}
      >
        {value}
      </span>
      <span className="text-sm font-medium text-text-secondary">{label}</span>
      {detail ? <span className="text-xs text-text-tertiary">{detail}</span> : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* SectionHeading                                                              */
/* -------------------------------------------------------------------------- */

export interface SectionHeadingProps {
  eyebrow?: string
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

/**
 * Eyebrow → title → one line of prose, with the action aligned to the title.
 *
 * The rule that used to sit between the title and the description is gone: it
 * separated a heading from its own subtitle, which is the one place a separator
 * should never be.
 */
export function SectionHeading({ eyebrow, title, description, action, className }: SectionHeadingProps) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-x-6 gap-y-3', className)}>
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow ? <Eyebrow marker>{eyebrow}</Eyebrow> : null}
        <h2 className="font-display text-xl font-semibold text-text-primary">{title}</h2>
        {description ? (
          <p className="max-w-prose text-pretty text-sm text-text-secondary">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  )
}
