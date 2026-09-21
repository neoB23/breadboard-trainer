import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import * as React from 'react'

import { useT } from '@/i18n'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const t = useT()

  return (
    <DialogPrimitive.Portal>
      {/* The scrim is the primary ink at low alpha, so it darkens the page on the
        light theme and on the dark one alike — the page ground would have been
        invisible over white. */}
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-text-primary/40" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          // The centring translate is duplicated in the `scale-in` keyframes;
          // these classes are what the transform falls back to once it ends.
          'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2',
          'animate-scale-in rounded-panel border border-line bg-bg-800 shadow-lg',
          'max-h-[calc(100vh-4rem)] overflow-y-auto',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute right-4 top-4 rounded-pill p-1.5 text-text-tertiary transition-colors hover:bg-bg-700 hover:text-text-primary"
          aria-label={t('a11y.close')}
        >
          <X className="size-4" aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
})
DialogContent.displayName = 'DialogContent'

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  // The right inset keeps a long title clear of the close button.
  return <div className={cn('flex flex-col gap-2 p-6 pr-14', className)} {...props} />
}

export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 pb-6 text-sm text-text-secondary', className)} {...props} />
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:items-center sm:justify-end sm:gap-3',
        className,
      )}
      {...props}
    />
  )
}

export const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  // A dialog is the one piece of chrome that earns display type: at 22px Clash
  // is above its legibility floor and gives the panel a head worth stopping on.
  <DialogPrimitive.Title
    ref={ref}
    className={cn('font-display text-display-xs text-text-primary', className)}
    {...props}
  />
))
DialogTitle.displayName = 'DialogTitle'

export const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('max-w-prose text-pretty text-sm text-text-secondary', className)}
    {...props}
  />
))
DialogDescription.displayName = 'DialogDescription'
