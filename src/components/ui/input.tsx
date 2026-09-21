import * as React from 'react'

import { cn } from '@/lib/utils'

import { Field, fieldSurface, useFieldControl } from './field'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode
  /** Guidance under the field. Replaced by `error` when one arrives. */
  hint?: React.ReactNode
  /** Puts the field in its error state and announces the message. */
  error?: React.ReactNode
  optional?: boolean
  /** Decorative glyph inside the left edge. lucide, forced to size-4. */
  leadingIcon?: React.ReactNode
  /**
   * Control docked to the right edge — the password reveal, a unit, a clear
   * button. Non-interactive content there stays click-through, so tapping a
   * unit label still lands in the field.
   */
  trailingSlot?: React.ReactNode
}

/**
 * The single-line text control: a pill on the raised ground, separated from it
 * by a hairline rather than a shadow.
 *
 * `className` and every unrecognised prop land on the `<input>` itself, which
 * is what makes `{...register('email')}` work unchanged.
 *
 * Inside a `<Field>` the shell above owns the label and message, so `label`,
 * `hint` and `error` given here are not rendered a second time — put them on
 * the Field instead.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      label,
      hint,
      error,
      optional,
      leadingIcon,
      trailingSlot,
      id,
      'aria-describedby': describedBy,
      ...props
    },
    ref,
  ) => {
    const { ownsShell, controlProps } = useFieldControl({ id, hint, error, describedBy })

    const input = (
      <input
        ref={ref}
        type={type}
        {...controlProps}
        className={cn(
          fieldSurface,
          // px-4 rather than the px-3 a square field would take: at this radius
          // the corner is still curving away at 16px, so anything tighter reads
          // as text crowding the edge.
          'h-10 rounded-md px-4',
          leadingIcon && 'pl-10',
          trailingSlot && 'pr-12',
          className,
        )}
        {...props}
      />
    )

    // Only pay for the positioning context when something is actually docked.
    const control =
      leadingIcon || trailingSlot ? (
        <div className="relative w-full">
          {leadingIcon ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-text-tertiary [&_svg]:size-4"
            >
              {leadingIcon}
            </span>
          ) : null}
          {input}
          {trailingSlot ? (
            <span className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center [&>*]:pointer-events-auto">
              {trailingSlot}
            </span>
          ) : null}
        </div>
      ) : (
        input
      )

    if (!ownsShell) return control

    return (
      <Field htmlFor={controlProps.id} label={label} hint={hint} error={error} optional={optional}>
        {control}
      </Field>
    )
  },
)
Input.displayName = 'Input'
