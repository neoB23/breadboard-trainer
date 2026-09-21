import { Eye, EyeOff } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

import { Input, type InputProps } from './input'

export interface PasswordInputProps extends Omit<InputProps, 'type' | 'trailingSlot'> {
  /** Accessible label for the reveal control. Both states, so it can be translated. */
  showLabel?: string
  hideLabel?: string
}

/**
 * A password field with a reveal toggle.
 *
 * The toggle is a Phase 3 polish requirement, and it is worth more than it
 * looks: a student on a phone keyboard mistyping a password they cannot see is
 * the most common reason a first sign-in fails, and the failure is
 * indistinguishable from "wrong account".
 *
 * Three details that are easy to get wrong and are all deliberate here:
 *
 *   - `type="button"`. Inside a form, a bare `<button>` submits, so revealing
 *     the password would post the form — with the field half typed.
 *   - The control is never in the tab order twice and never becomes the form's
 *     default action, so pressing Enter from the password field still submits.
 *   - The icon shows what will happen next (an open eye means "reveal"), and the
 *     accessible name says the same thing in words, because an eye glyph on its
 *     own is genuinely ambiguous.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ showLabel = 'Show password', hideLabel = 'Hide password', className, ...props }, ref) => {
    const [revealed, setRevealed] = React.useState(false)
    const Icon = revealed ? EyeOff : Eye

    return (
      <Input
        ref={ref}
        type={revealed ? 'text' : 'password'}
        className={className}
        trailingSlot={
          <button
            type="button"
            // `-1` would hide it from keyboard users, who need it most — the
            // whole point is checking what was typed without a mouse.
            aria-label={revealed ? hideLabel : showLabel}
            aria-pressed={revealed}
            onClick={() => setRevealed((current) => !current)}
            className={cn(
              'inline-flex size-8 items-center justify-center rounded-pill',
              'text-text-tertiary transition-colors duration-200 ease-out',
              'hover:bg-bg-700 hover:text-text-secondary',
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
          </button>
        }
        {...props}
      />
    )
  },
)
PasswordInput.displayName = 'PasswordInput'
