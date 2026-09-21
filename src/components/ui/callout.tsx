import { CircleCheck, CircleDot, Info, OctagonX, TriangleAlert } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * The block-level counterpart to `StatusBadge`: a whole message rather than a
 * label, for the things a form has to say that do not belong beside one field.
 *
 * "We sent a link to your inbox", "that link has expired", "your password is
 * changed" — none of these attach to an input, and putting them in a toast means
 * they vanish before the person has finished reading.
 *
 * The same hard rule applies as everywhere else in this system: **state is never
 * colour alone.** Each tone has its own icon silhouette — check, triangle,
 * octagon, "i", dot — so the message survives greyscale, dichromacy and a
 * washed-out projector.
 *
 * `rounded-card`, not a pill: this is a surface, and surfaces get 12px.
 */
export type CalloutTone = 'ok' | 'warn' | 'fault' | 'info' | 'neutral'

const toneStyles: Record<CalloutTone, string> = {
  ok: 'border-ok-line bg-ok-surface text-ok-ink',
  warn: 'border-warn-line bg-warn-surface text-warn-ink',
  fault: 'border-fault-line bg-fault-surface text-fault-ink',
  info: 'border-info-line bg-info-surface text-info-ink',
  neutral: 'border-neutral-line bg-neutral-surface text-neutral-ink',
}

const toneIcon: Record<CalloutTone, typeof Info> = {
  ok: CircleCheck,
  warn: TriangleAlert,
  fault: OctagonX,
  info: Info,
  neutral: CircleDot,
}

/** Spoken prefix, so the tone survives with both colour and shape stripped. */
const toneLabel: Record<CalloutTone, string> = {
  ok: 'Success',
  warn: 'Warning',
  fault: 'Error',
  info: 'Note',
  neutral: 'Note',
}

// `title` is widened from the DOM attribute's `string` to a node, so a message
// can carry an inline link. The tooltip attribute is not something a Callout
// wants anyway.
export interface CalloutProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: CalloutTone
  title?: React.ReactNode
  /** One thing to do about it — a resend button, a link back to sign in. */
  action?: React.ReactNode
}

export function Callout({ tone = 'info', title, action, className, children, ...props }: CalloutProps) {
  const Icon = toneIcon[tone]

  return (
    <div
      /**
       * `alert` for the two tones that mean something went wrong, so a screen
       * reader announces them the moment they appear — a submit failure the user
       * is not told about is a form that silently does nothing. The rest are
       * `status`, which is polite and waits for a pause.
       */
      role={tone === 'fault' || tone === 'warn' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-card border p-4', toneStyles[tone], className)}
      {...props}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="sr-only">{toneLabel[tone]}:</span>
        {title ? <p className="text-sm font-medium">{title}</p> : null}
        {children ? <div className="text-pretty text-sm opacity-90">{children}</div> : null}
        {action ? <div className="mt-2 flex flex-wrap items-center gap-3">{action}</div> : null}
      </div>
    </div>
  )
}
