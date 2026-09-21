import { GraduationCap } from 'lucide-react'

import { AppNavItem, AppShell, type AppShellUser } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/ui'
import { useAuthStore } from '@/features/auth/auth-store'
import { useT } from '@/i18n'

/**
 * `/teach` — the instructor placeholder Phase 6 replaces.
 *
 * It exists for one reason: Phase 3's DoD requires that a student navigating
 * here sees a designed 403 rather than a crash, and a `<RoleRoute>` needs
 * something to guard. The screen behind the guard is genuinely empty; the guard
 * in front of it, and the `requireRole('instructor')` behind it on the API, are
 * both real.
 */
export function TeachPage() {
  const t = useT()
  const session = useAuthStore((state) => state.session)
  const signOut = useAuthStore((state) => state.signOut)

  const profile = session?.profile
  const user: AppShellUser | undefined = profile
    ? { name: profile.fullName, email: session.user.email, role: profile.role }
    : undefined

  return (
    <AppShell
      user={user}
      onSignOut={() => void signOut()}
      nav={
        <>
          <AppNavItem to="/teach">{t('nav.teach')}</AppNavItem>
          <AppNavItem to="/settings">{t('nav.settings')}</AppNavItem>
        </>
      }
    >
      <PageHeader
        className="[&>div]:mx-auto [&>div]:w-full [&>div]:max-w-shell"
        title={t('teach.title')}
        subtitle={t('teach.subtitle')}
      />

      <div className="mx-auto w-full max-w-shell">
        <div className="px-4 py-10 sm:px-6 sm:py-12">
          <EmptyState
            icon={GraduationCap}
            eyebrow={t('teach.pending.eyebrow')}
            title={t('teach.pending.title')}
            description={t('teach.pending.description')}
          />
        </div>
      </div>
    </AppShell>
  )
}
