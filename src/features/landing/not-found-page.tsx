import { Compass } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

import { AppShell } from '@/components/layout/app-shell'
import { Button, EmptyState } from '@/components/ui'
import { useT } from '@/i18n'

/** Keeps the echoed path on one line; a long URL should not wrap the panel. */
function shorten(path: string) {
  return path.length > 48 ? `${path.slice(0, 47)}…` : path
}

export function NotFoundPage() {
  const t = useT()
  const { pathname } = useLocation()

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-20 sm:px-6 sm:py-28">
        <EmptyState
          icon={Compass}
          eyebrow={t('notFound.eyebrow')}
          title={t('notFound.title')}
          description={t('notFound.description')}
          action={
            <div className="flex flex-col items-center gap-4">
              <Button asChild>
                <Link to="/">{t('notFound.action')}</Link>
              </Button>
              {/* Echoing the address back is worth one line: it is how someone
                  spots that a link was truncated by whatever they pasted it from. */}
              <code className="max-w-full truncate rounded-sm bg-bg-700 px-2 py-1 font-mono text-xs text-text-tertiary">
                {shorten(pathname)}
              </code>
            </div>
          }
        />
      </div>
    </AppShell>
  )
}
