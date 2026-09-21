import { Check } from 'lucide-react'
import * as React from 'react'

import { useT } from '@/i18n'
import { cn } from '@/lib/utils'

export interface Step {
  id: string
  label: string
}

export interface StepperProps extends React.HTMLAttributes<HTMLElement> {
  steps: readonly Step[]
  /** Zero-based index of the step being worked on. */
  current: number
  /** Announced above the list — "Step 2 of 3". */
  progressLabel?: string
}

/**
 * Progress through a short wizard. Built for the three-step onboarding and
 * nothing longer — beyond about five steps a bar reads better than a list.
 *
 * State is carried three ways at once, which is the same rule the rest of the
 * system follows: the index becomes a check once a step is done, the rule under
 * the current step is accent and full width where the others are hairline stubs,
 * and `aria-current="step"` says so out loud. Take the colour away and it is
 * still readable.
 *
 * Rendered as an ordered list rather than a row of divs, so a screen reader
 * announces "2 of 3" without being told.
 */
export function Stepper({ steps, current, progressLabel, className, ...props }: StepperProps) {
  const t = useT()

  return (
    <nav aria-label={t('a11y.progress')} className={cn('flex flex-col gap-3', className)} {...props}>
      {progressLabel ? <p className="text-sm text-text-tertiary">{progressLabel}</p> : null}

      <ol className="flex flex-col gap-3 sm:flex-row sm:gap-6">
        {steps.map((step, index) => {
          const done = index < current
          const active = index === current

          return (
            <li
              key={step.id}
              className="flex min-w-0 flex-1 flex-col gap-2"
              {...(active && { 'aria-current': 'step' as const })}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'h-px w-full origin-left transition-colors duration-200 ease-out',
                  active || done ? 'bg-accent' : 'bg-line-strong',
                )}
              />
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-pill text-xs font-semibold tabular-nums',
                    done && 'bg-accent text-accent-contrast',
                    active && !done && 'border border-accent text-accent',
                    !active && !done && 'border border-line-strong text-text-tertiary',
                  )}
                >
                  {done ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span
                  className={cn(
                    'truncate text-sm',
                    active ? 'font-medium text-text-primary' : 'text-text-tertiary',
                  )}
                >
                  {step.label}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
