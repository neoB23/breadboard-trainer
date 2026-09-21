import * as SwitchPrimitive from '@radix-ui/react-switch'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * The settings toggle. The knob's position carries the state as much as the
 * fill does, which is what keeps it readable with the colour taken away — but
 * a switch still needs a text label beside it naming what it controls.
 *
 * Radix reports changes through `onCheckedChange` rather than a native change
 * event, so react-hook-form wants `<Controller>` around this one.
 */
export const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-pill p-0.5',
      'transition-colors duration-200 ease-out',
      'data-[state=checked]:bg-accent data-[state=unchecked]:bg-bg-600',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  >
    {/* Off, the knob is a muted grey that reads inert on either theme. On, it
        drops to the accent's own contrast ink, which is near-black against the
        lime and white against light mode's deep green. */}
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block size-5 rounded-pill bg-text-tertiary',
        'transition-transform duration-200 ease-out',
        'data-[state=checked]:translate-x-5 data-[state=checked]:bg-accent-contrast',
      )}
    />
  </SwitchPrimitive.Root>
))
Switch.displayName = 'Switch'
