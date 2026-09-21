import * as React from 'react'

import { cn } from '@/lib/utils'

import { Field, fieldSurface, useFieldControl } from './field'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  optional?: boolean
}

/**
 * The multi-line control. Same surface as Input, but `rounded-card` — a pill on
 * a box this tall reads as a stretched button, and the small radius is what the
 * system already uses for anything that behaves like a surface.
 *
 * Resizing is left on, vertically: the user knows how much they are writing
 * better than the layout does. Horizontal is off, since widening it would break
 * out of the column it sits in.
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, hint, error, optional, id, 'aria-describedby': describedBy, ...props }, ref) => {
    const { ownsShell, controlProps } = useFieldControl({ id, hint, error, describedBy })

    const control = (
      <textarea
        ref={ref}
        {...controlProps}
        className={cn(fieldSurface, 'min-h-24 resize-y rounded-card px-4 py-3', className)}
        {...props}
      />
    )

    if (!ownsShell) return control

    return (
      <Field htmlFor={controlProps.id} label={label} hint={hint} error={error} optional={optional}>
        {control}
      </Field>
    )
  },
)
Textarea.displayName = 'Textarea'
