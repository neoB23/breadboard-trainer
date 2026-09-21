import * as ToastPrimitive from '@radix-ui/react-toast'
import { AlertTriangle, CheckCircle2, Info, X, XOctagon } from 'lucide-react'

import { create } from 'zustand'

import { useT } from '@/i18n'
import { cn } from '@/lib/utils'

export type ToastTone = 'ok' | 'warn' | 'fault' | 'info'

export interface ToastMessage {
  id: string
  title: string
  description?: string
  tone: ToastTone
  duration?: number
}

interface ToastStore {
  toasts: ToastMessage[]
  push: (toast: Omit<ToastMessage, 'id'>) => string
  dismiss: (id: string) => void
}

let nextId = 0

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = `toast-${++nextId}`
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))
    return id
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

/**
 * Fire a toast from anywhere, including outside React.
 *
 * `toast.fault(...)` is for things the user must notice; prefer inline field
 * errors for anything they can fix in place.
 */
export const toast = {
  ok: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: 'ok' }),
  warn: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: 'warn' }),
  fault: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: 'fault' }),
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: 'info' }),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
}

export function useToasts() {
  return useToastStore((state) => state.toasts)
}

/** Surface, hairline and ink all come from the same tone family. */
const toneStyles: Record<ToastTone, string> = {
  ok: 'border-ok-line bg-ok-surface text-ok-ink',
  warn: 'border-warn-line bg-warn-surface text-warn-ink',
  fault: 'border-fault-line bg-fault-surface text-fault-ink',
  info: 'border-info-line bg-info-surface text-info-ink',
}

/**
 * Four distinct silhouettes — circle, triangle, octagon, circle-with-serif.
 * The tone is never carried by colour alone, and the toast is often the one
 * piece of feedback a user sees, so the shape has to do the work on its own.
 */
const toneIcon: Record<ToastTone, typeof CheckCircle2> = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  fault: XOctagon,
  info: Info,
}

/** Spoken prefix, so the tone survives with the colour and the shape stripped. */
const toneLabel: Record<ToastTone, string> = {
  ok: 'Success',
  warn: 'Warning',
  fault: 'Error',
  info: 'Note',
}

/** Mount once, near the root. Renders every queued toast. */
export function Toaster() {
  const t = useT()
  const toasts = useToasts()
  const dismiss = useToastStore((state) => state.dismiss)

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map((item) => {
        const Icon = toneIcon[item.tone]
        return (
          <ToastPrimitive.Root
            key={item.id}
            duration={item.duration ?? 5000}
            onOpenChange={(open) => {
              if (!open) dismiss(item.id)
            }}
            className={cn(
              'flex items-start gap-3 rounded-card border p-4 shadow-lg',
              'data-[state=closed]:animate-slide-out-right data-[state=open]:animate-slide-in-right',
              toneStyles[item.tone],
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <ToastPrimitive.Title className="text-sm font-medium">
                <span className="sr-only">{toneLabel[item.tone]}: </span>
                {item.title}
              </ToastPrimitive.Title>
              {item.description ? (
                // Held at the tone ink, one step back — a second colour here
                // would put three hues in a 300px box.
                <ToastPrimitive.Description className="mt-1 text-xs opacity-80">
                  {item.description}
                </ToastPrimitive.Description>
              ) : null}
            </div>
            <ToastPrimitive.Close
              className="rounded-pill p-1 opacity-60 transition hover:bg-line hover:opacity-100"
              aria-label={t('a11y.dismiss')}
            >
              <X className="size-4" aria-hidden="true" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        )
      })}
      <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-50 flex max-h-screen w-full flex-col gap-3 p-4 sm:max-w-96 sm:p-6" />
    </ToastPrimitive.Provider>
  )
}
