import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useT } from '@/i18n'
import { cn } from '@/lib/utils'

export interface Crumb {
  label: string
  to?: string
}

export interface PageHeaderProps extends React.HTMLAttributes<HTMLElement> {
  title: string
  subtitle?: string
  breadcrumb?: Crumb[]
  /** Primary and secondary actions for this page, right-aligned on >=640px. */
  action?: React.ReactNode
}

/**
 * The opening of every screen inside the app shell: breadcrumb, title, one line
 * of prose, actions.
 *
 * It sits on the page ground with a hairline beneath it, so a screen that
 * scrolls has a clear boundary between "what this page is" and "what is on it".
 *
 * Two things it no longer has. The `command` slot that printed a shell prompt
 * above the title is gone — see the note in `src/components/ui/signature.tsx`.
 * And the title is 24px rather than 40px: a page heading should be the largest
 * thing on the screen, not an event.
 */
export function PageHeader({ title, subtitle, breadcrumb, action, className, ...props }: PageHeaderProps) {
  const t = useT()

  return (
    <header className={cn('border-b border-line px-4 py-6 sm:px-6 sm:py-8', className)} {...props}>
      <div className="flex flex-col gap-3">
        {breadcrumb?.length ? (
          <nav aria-label={t('a11y.breadcrumb')}>
            <ol className="flex flex-wrap items-center gap-1.5 text-sm text-text-tertiary">
              {breadcrumb.map((crumb, index) => (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
                  {index > 0 ? (
                    <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-text-tertiary" />
                  ) : null}
                  {crumb.to ? (
                    <Link to={crumb.to} className="rounded-sm transition-colors hover:text-text-primary">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current="page" className="text-text-secondary">
                      {crumb.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="text-balance font-display text-2xl font-semibold text-text-primary">{title}</h1>
            {subtitle ? (
              <p className="max-w-prose text-pretty text-sm text-text-secondary">{subtitle}</p>
            ) : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </div>
      </div>
    </header>
  )
}
