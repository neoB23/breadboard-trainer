import * as React from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { Spinner } from '@/components/ui'
import { useT } from '@/i18n'
import type { Role } from '@shared/contracts'

import { useAuthStore } from './auth-store'
import { ForbiddenPage } from './forbidden-page'

/**
 * The three route wrappers, and the one mistake they exist to avoid.
 *
 * ---------------------------------------------------------------------------
 * `loading` IS NOT `anonymous`
 *
 * The session lives in an httpOnly cookie, so on a hard refresh the client does
 * not know who it is until `GET /api/auth/me` comes back. A guard written as
 *
 *     if (!session) return <Navigate to="/login" />
 *
 * is correct for a signed-out visitor and catastrophic for a signed-in one: it
 * fires during that round trip, so every refresh bounces the user to the sign-in
 * screen and the app appears to log them out at random.
 *
 * So `loading` renders a quiet full-page state and nothing else. It resolves in
 * one request; the flash is the honest cost of not keeping a session copy in
 * `localStorage`.
 * ---------------------------------------------------------------------------
 */

/* -------------------------------------------------------------------------- */
/* The waiting state                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Deliberately almost empty. This is on screen for a few hundred milliseconds,
 * and a skeleton of a layout the user has not asked for yet would flash a false
 * page. A spinner and one line say "working" without pretending to be content.
 *
 * The line is there rather than a bare spinner because on a slow campus
 * connection this can last a second or two, and an unexplained spinner in that
 * window reads as something being broken.
 */
export function SessionPending() {
  const t = useT()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg-900 px-6">
      <Spinner size="md" label={null} className="text-accent" />
      <p className="text-sm text-text-secondary">{t('guard.checking')}</p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* ProtectedRoute                                                             */
/* -------------------------------------------------------------------------- */

export interface ProtectedRouteProps {
  children: React.ReactNode
  /**
   * Skips the onboarding redirect. Only `/onboarding` itself sets this — without
   * it the wizard redirects to itself forever.
   */
  allowUnonboarded?: boolean
}

export function ProtectedRoute({ children, allowUnonboarded = false }: ProtectedRouteProps) {
  const status = useAuthStore((state) => state.status)
  const onboardedAt = useAuthStore((state) => state.session?.profile.onboardedAt ?? null)
  const location = useLocation()

  if (status === 'loading') return <SessionPending />

  if (status === 'anonymous') {
    /**
     * The whole location goes into state, not just the pathname — a student who
     * followed a link to `/lab/abc?panel=hints` should land back on that exact
     * screen, and `replace` keeps the sign-in page out of their history so Back
     * does not return to it once they are in.
     */
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Phase 4: forced through onboarding, exactly once, on exactly this flag.
  if (!allowUnonboarded && onboardedAt === null) {
    return <Navigate to="/onboarding" replace state={{ from: location }} />
  }

  return <>{children}</>
}

/* -------------------------------------------------------------------------- */
/* RoleRoute                                                                  */
/* -------------------------------------------------------------------------- */

export interface RoleRouteProps {
  role: Role
  children: React.ReactNode
}

/**
 * Role on top of a session. A student who reaches `/teach` gets a **designed
 * 403**, not a redirect and not a crash.
 *
 * Redirecting would be worse than it sounds: it makes a permissions problem look
 * like a broken link, and a legitimate instructor whose account was set up
 * wrongly would be bounced to a dashboard with no explanation of why.
 *
 * This is a second copy of a check the API already makes, and the API's is the
 * one that counts — `/api/teach/*` answers 403 to a student session called
 * directly with curl. This one exists so the person sees a page instead of an
 * error toast.
 */
export function RoleRoute({ role, children }: RoleRouteProps) {
  const status = useAuthStore((state) => state.status)
  const actual = useAuthStore((state) => state.session?.profile.role ?? null)
  const location = useLocation()

  if (status === 'loading') return <SessionPending />
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />

  // Admin satisfies every requirement, matching `requireRole` on the server.
  if (actual !== role && actual !== 'admin') return <ForbiddenPage />

  return <>{children}</>
}

/* -------------------------------------------------------------------------- */
/* PublicOnlyRoute                                                            */
/* -------------------------------------------------------------------------- */

/**
 * For `/login` and `/register`. Someone already signed in who lands on the
 * sign-in form has almost certainly hit a stale bookmark, and showing them a
 * form that would sign them in as themselves is a dead end.
 *
 * `/reset-password` and `/verify-email` are deliberately **not** wrapped in
 * this: both are reached from an email link, and a signed-in person following a
 * reset link is exactly the case where redirecting them away is wrong.
 */
export function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((state) => state.status)
  const onboardedAt = useAuthStore((state) => state.session?.profile.onboardedAt ?? null)
  const role = useAuthStore((state) => state.session?.profile.role ?? null)

  if (status === 'loading') return <SessionPending />

  if (status === 'authenticated') {
    if (onboardedAt === null) return <Navigate to="/onboarding" replace />
    return <Navigate to={role === 'instructor' ? '/teach' : '/dashboard'} replace />
  }

  return <>{children}</>
}

/* -------------------------------------------------------------------------- */
/* Where to go after signing in                                               */
/* -------------------------------------------------------------------------- */

interface FromState {
  from?: { pathname?: string; search?: string; hash?: string }
}

/**
 * The page the person originally asked for, or their home screen.
 *
 * Only same-origin relative paths are honoured. `location.state` is not
 * attacker-controlled in the way a query parameter is, but a redirect target
 * that is read back and navigated to is exactly the shape of an open redirect,
 * and rejecting anything that does not start with a single `/` costs one line.
 */
export function useAfterSignInPath(fallback: string): string {
  const location = useLocation()
  const state = location.state as FromState | null
  const from = state?.from

  if (!from?.pathname) return fallback
  if (!from.pathname.startsWith('/') || from.pathname.startsWith('//')) return fallback

  // Never back to a screen they can no longer be on.
  if (['/login', '/register', '/forgot-password'].includes(from.pathname)) return fallback

  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
}

/** The screen a signed-in person belongs on when nothing more specific applies. */
export function homePathFor(role: Role | null | undefined): string {
  return role === 'instructor' || role === 'admin' ? '/teach' : '/dashboard'
}
