import { ShieldOff } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { AppShell, type AppShellUser } from '@/components/layout/app-shell'
import { Button, EmptyState, TextButton } from '@/components/ui'
import { useT } from '@/i18n'

import { useAuthStore } from './auth-store'
import { homePathFor } from './route-guards'

/**
 * The 403.
 *
 * Phase 3's DoD asks for "a proper 403 page, not a crash" when a student reaches
 * `/teach`, and the copy is doing most of the work: the failure here is not the
 * person's fault and is not fixable by them, so the page says so plainly, names
 * who it thinks they are — the most common real cause is being signed in as the
 * wrong account on a shared lab machine — and offers the two things that could
 * actually help.
 *
 * It shares its shape with the 404 rather than inventing a second error layout.
 */
export function ForbiddenPage() {
  const t = useT()
  const navigate = useNavigate()
  const session = useAuthStore((state) => state.session)
  const signOut = useAuthStore((state) => state.signOut)

  const profile = session?.profile ?? null

  // The header carries the account menu here, unlike on the 404. The commonest
  // real cause of this screen is being signed in as the wrong person on a shared
  // machine, and the avatar in the corner is where someone looks to check.
  const user: AppShellUser | undefined =
    profile && session ? { name: profile.fullName, email: session.user.email, role: profile.role } : undefined

  return (
    <AppShell user={user} onSignOut={() => void signOut()}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-20 sm:px-6 sm:py-28">
        <EmptyState
          icon={ShieldOff}
          eyebrow={t('forbidden.eyebrow')}
          title={t('forbidden.title')}
          description={t('forbidden.description')}
          action={
            <div className="flex flex-col items-center gap-5">
              <Button asChild>
                <Link to={homePathFor(profile?.role)}>{t('forbidden.action')}</Link>
              </Button>

              {profile ? (
                <p className="font-mono text-xs text-text-tertiary">
                  {t('forbidden.signedInAs', { name: profile.fullName })}
                </p>
              ) : null}

              {/* The genuine remedy when the cause is a shared machine. */}
              <TextButton
                onClick={async () => {
                  await signOut()
                  navigate('/login', { replace: true })
                }}
              >
                {t('forbidden.switch')}
              </TextButton>
            </div>
          }
        />
      </div>
    </AppShell>
  )
}
