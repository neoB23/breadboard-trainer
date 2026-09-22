import type * as React from 'react'

import { AppNavItem, AppShell, type AppShellUser } from '@/components/layout/app-shell'
import { useAuthStore } from '@/features/auth/auth-store'
import { useT } from '@/i18n'

/**
 * The frame every teaching screen sits in — the instructor's nav, the signed-in
 * person, sign-out. One place, so the four authoring screens cannot drift apart
 * in what they offer to navigate to.
 */
export function TeachShell({ children }: { children: React.ReactNode }) {
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
      {children}
    </AppShell>
  )
}

/** The page body's width and padding, shared so the four screens line up. */
export const TEACH_BODY = 'mx-auto w-full max-w-shell px-4 pb-20 pt-8 sm:px-6'
export const TEACH_HEADER = '[&>div]:mx-auto [&>div]:w-full [&>div]:max-w-shell'
