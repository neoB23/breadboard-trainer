import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check, Minus } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

import { FieldMessage, useFieldControl } from './field'

export interface CheckboxProps extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  /** Sits beside the box in sentence case — this is a statement, not a caption. */
  label?: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
}

/**
 * `rounded-xs`, because a 20px box with pill ends is a lozenge, not a checkbox.
 * This is the tiny-radius case the system keeps in reserve.
 *
 * Unlike Input the label goes *beside* the control and stays sentence case: a
 * checkbox label is a claim the user is agreeing to ("Email me when a build
 * fails"), and wide-tracked caps make a sentence unreadable.
 *
 * Radix renders a `<button>` and reports changes through `onCheckedChange`, so
 * react-hook-form needs `<Controller>` here rather than `register()`. The
 * hidden native input Radix mounts inside a `<form>` still carries `name` and
 * `value` through a plain submit.
 */
export const Checkbox = React.forwardRef<React.ComponentRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(
  ({ className, label, hint, error, id, 'aria-describedby': describedBy, ...props }, ref) => {
    const { ownsShell, ids, controlProps } = useFieldControl({ id, hint, error, describedBy })

    const row = (
      <div className="flex items-start gap-3">
        <CheckboxPrimitive.Root
          ref={ref}
          {...controlProps}
          className={cn(
            'group peer inline-flex size-5 shrink-0 items-center justify-center rounded-xs border',
            'border-line-strong bg-bg-800 transition-colors duration-200 ease-out',
            // Scoped to the unchecked state so it cannot compete with the accent
            // fill, whatever order the two utilities end up in.
            'data-[state=unchecked]:hover:bg-bg-700',
            'data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-accent-contrast',
            'data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent data-[state=indeterminate]:text-accent-contrast',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'aria-[invalid=true]:border-fault',
            className,
          )}
          {...props}
        >
          {/* Radix mounts the indicator for both checked and indeterminate, so the
            root's data-state picks which glyph is showing. */}
          <CheckboxPrimitive.Indicator className="flex items-center justify-center">
            <Check className="size-3.5 group-data-[state=indeterminate]:hidden" aria-hidden="true" />
            <Minus className="hidden size-3.5 group-data-[state=indeterminate]:block" aria-hidden="true" />
          </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
        {label ? (
          <label
            htmlFor={controlProps.id}
            className="cursor-pointer text-sm text-text-secondary peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
          >
            {label}
          </label>
        ) : null}
      </div>
    )

    if (!ownsShell) return row

    return (
      <div className="flex w-full flex-col gap-2">
        {row}
        {/* pl-8 clears the box and its gap, so the message hangs under the label
          rather than under the control. */}
        <FieldMessage hint={hint} error={error} hintId={ids.hintId} errorId={ids.errorId} className="pl-8" />
      </div>
    )
  },
)
Checkbox.displayName = 'Checkbox'
