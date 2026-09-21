import { Slot, Slottable } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { LoaderCircle } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * The one control every screen leans on.
 *
 * Five variants and no more, because a form with three plausible-looking
 * buttons on it is a form people hesitate over. On any screen exactly one
 * action is `primary`; everything else is `secondary`, `ghost` or `link`, and
 * `danger` is reserved for something that destroys data.
 *
 * Hover changes the fill and nothing else. The previous version lifted the
 * primary button a pixel on hover, which is a nice effect and the wrong signal
 * — a control that moves under the cursor is harder to hit, and that cost lands
 * hardest on exactly the people the accessibility settings exist for.
 */
const buttonVariants = cva(
  [
    // Buttons are pills; text fields are not. That split is what both reference
    // products do (Tinkercad, and the flashcard app), and it is a useful one:
    // the pill says "press me" at a glance, while a pill-shaped *input* says
    // "consumer app" and makes a long value look cramped at both ends.
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill font-medium',
    'transition-colors duration-150 ease-out',
    // aria-disabled covers the asChild case, where the slotted element is
    // usually an anchor and has no `disabled` attribute to honour.
    'disabled:pointer-events-none disabled:opacity-50',
    'aria-disabled:pointer-events-none aria-disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-contrast shadow-sm hover:bg-accent-ink active:bg-accent-ink',
        secondary:
          'border border-line bg-bg-800 text-text-primary shadow-sm hover:border-line-strong hover:bg-bg-700',
        ghost: 'text-text-secondary hover:bg-bg-700 hover:text-text-primary',
        danger: 'bg-fault text-text-inverse shadow-sm hover:bg-fault-ink',
        link: 'font-medium text-accent underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 gap-1.5 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-5 text-base',
        icon: 'size-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** Shows a spinner and blocks the click, so a double-submit is impossible. */
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    const blocked = disabled || loading
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={asChild ? undefined : blocked}
        aria-disabled={asChild && blocked ? true : undefined}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
        {/* Slottable puts the spinner *inside* the slotted element instead of
            letting Slot discard it in favour of that element's own children. */}
        <Slottable>{children}</Slottable>
      </Comp>
    )
  },
)
Button.displayName = 'Button'

/* -------------------------------------------------------------------------- */
/* TextButton                                                                  */
/* -------------------------------------------------------------------------- */

export interface TextButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

/**
 * A secondary action with no chrome at all — "Back", "Send it again", "I do not
 * have a code yet".
 *
 * It reads as a link and behaves as a button, which is the right pairing for an
 * action that changes state rather than navigating. Underlined on hover and on
 * focus, so it is discoverable without an outline drawing attention it does not
 * deserve.
 *
 * This replaced a `[ bracketed ]` control that put two accent brackets around a
 * wide-tracked label. It was distinctive, and it was also a control nobody
 * outside this codebase has ever seen — on a form a student has to get through,
 * an unfamiliar affordance is a cost with no payoff.
 */
export const TextButton = React.forwardRef<HTMLButtonElement, TextButtonProps>(
  ({ className, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-accent',
          'underline-offset-4 transition-colors duration-150 ease-out hover:underline',
          'disabled:pointer-events-none disabled:opacity-50',
          'aria-disabled:pointer-events-none aria-disabled:opacity-50',
          '[&_svg]:size-4 [&_svg]:shrink-0',
          className,
        )}
        {...props}
      >
        <Slottable>{children}</Slottable>
      </Comp>
    )
  },
)
TextButton.displayName = 'TextButton'

export { buttonVariants }
