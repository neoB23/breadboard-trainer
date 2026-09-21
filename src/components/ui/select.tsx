import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

import { fieldSurface, useFieldContext } from './field'

export const Select = SelectPrimitive.Root
export const SelectGroup = SelectPrimitive.Group
export const SelectValue = SelectPrimitive.Value

export interface SelectTriggerProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> {
  /** Standalone error flag, for a trigger used outside a `<Field>`. */
  error?: boolean
}

/**
 * The same pill as Input — a select is a text field the user cannot type into,
 * and giving it a shape of its own would break that reading.
 *
 * A Select is compound, so it cannot own its label; wrap it in a `<Field>` and
 * the trigger picks up that Field's id, description and error state from
 * context. The `error` prop is the escape hatch for a bare trigger.
 */
export const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(({ className, children, error, id, 'aria-describedby': describedBy, ...props }, ref) => {
  const field = useFieldContext()

  return (
    <SelectPrimitive.Trigger
      ref={ref}
      id={id ?? field?.controlId}
      aria-invalid={error || field?.invalid || undefined}
      aria-describedby={describedBy ?? field?.describedBy}
      className={cn(
        fieldSurface,
        'group flex h-10 items-center justify-between gap-2 rounded-md px-4 text-left',
        'data-[placeholder]:text-text-tertiary',
        // A long value shortens instead of stretching the pill out of its column.
        '[&>span]:truncate',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-text-tertiary transition-transform duration-200 ease-out group-data-[state=open]:rotate-180"
        />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
})
SelectTrigger.displayName = 'SelectTrigger'

/**
 * `rounded-card` and a shadow: this is one of the few things that genuinely
 * floats, so it is allowed the elevation the rest of the system does without.
 */
export const SelectContent = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        'relative z-50 max-h-72 min-w-40 animate-fade-in overflow-hidden rounded-card border border-line bg-bg-800 shadow-lg',
        // Clears the trigger by a hair, so the panel reads as separate from it.
        position === 'popper' && 'translate-y-1',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn('p-1', position === 'popper' && 'w-full min-w-[var(--radix-select-trigger-width)]')}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = 'SelectContent'

export const SelectItem = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  // A full-width row with pill ends looks like a stretched button, so rows take
  // the tiny radius — the same call the dropdown menu makes.
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-xs py-2 pl-8 pr-3 text-sm text-text-secondary outline-none transition-colors',
      'data-[highlighted]:bg-bg-700 data-[highlighted]:text-text-primary',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex size-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="size-4 text-accent" aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = 'SelectItem'

export const SelectLabel = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  // Wide-tracked caps, as everywhere else a group gets named.
  <SelectPrimitive.Label
    ref={ref}
    className={cn('px-2 pb-1 pt-2 text-micro uppercase text-text-tertiary', className)}
    {...props}
  />
))
SelectLabel.displayName = 'SelectLabel'
