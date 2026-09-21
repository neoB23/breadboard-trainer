import * as React from 'react'

import { cn } from '@/lib/utils'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Turns the card into a hover target: the hairline firms up and the surface
   * lifts one step. Use it when the whole card is a link or opens something —
   * a card that is only a readout should stay inert, or the affordance stops
   * meaning anything.
   */
  interactive?: boolean
}

/**
 * The default surface: raised ground, one hairline, no shadow.
 *
 * Shadows belong to things that genuinely float (dialog, dropdown, toast). A
 * card sits *on* the page, so it separates with a rule instead.
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ interactive = false, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-card border border-line bg-bg-800',
        interactive && [
          'transition-[background-color,border-color,transform] duration-200 ease-out',
          'hover:-translate-y-0.5 hover:border-line-strong hover:bg-bg-700',
          // Keyboard parity: a link or button inside the card lights the whole
          // card, so the focus ring never lands on an unlit surface.
          'focus-within:border-line-strong focus-within:bg-bg-700',
          // Pressing settles it back down — the lift reads as a hover state,
          // not as permanent elevation.
          'active:translate-y-0',
        ],
        className,
      )}
      {...props}
    />
  ),
)
Card.displayName = 'Card'

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-2 p-6', className)} {...props} />
  ),
)
CardHeader.displayName = 'CardHeader'

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    // `h3` inherits Clash from the base layer, but 17px is under the display
    // floor where its apertures close up — so the family is forced back here.
    <h3
      ref={ref}
      className={cn('font-sans text-lg font-medium tracking-tight text-text-primary', className)}
      {...props}
    />
  ),
)
CardTitle.displayName = 'CardTitle'

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-pretty text-sm text-text-secondary', className)} {...props} />
))
CardDescription.displayName = 'CardDescription'

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />,
)
CardContent.displayName = 'CardContent'

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    // Tighter vertically than the body: an action bar, not another block.
    <div
      ref={ref}
      className={cn('flex items-center gap-3 border-t border-line px-6 py-4', className)}
      {...props}
    />
  ),
)
CardFooter.displayName = 'CardFooter'
