import { LoaderCircle } from 'lucide-react'

import { cn } from '@/lib/utils'

const sizes = {
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-8',
} as const

export interface SpinnerProps {
  size?: keyof typeof sizes
  className?: string
  /** Announced to screen readers; pass null for a purely decorative spinner. */
  label?: string | null
}

/** The one thing in the system that is allowed to spin. */
export function Spinner({ size = 'md', className, label = 'Loading' }: SpinnerProps) {
  return (
    <span
      role={label ? 'status' : undefined}
      // The colour sits on the wrapper rather than the icon so a caller's
      // `className` reaches the ring through currentColor.
      className={cn('inline-flex items-center text-text-tertiary', className)}
    >
      {/* Lucide's default 2px stroke reads heavy at size-8; 1.5 keeps the ring
          a hairline at every size. */}
      <LoaderCircle aria-hidden="true" strokeWidth={1.5} className={cn('animate-spin', sizes[size])} />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  )
}
