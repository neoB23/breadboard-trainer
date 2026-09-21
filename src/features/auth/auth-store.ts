import { create } from 'zustand'

import { adoptProfileLocale } from '@/i18n'
import { api, isApiError } from '@/lib/api'
import { logoutResponseSchema, meResponseSchema, type Profile, type Session } from '@shared/contracts'

/**
 * The client's view of who is signed in.
 *
 * ---------------------------------------------------------------------------
 * NOTHING IS PERSISTED HERE
 *
 * No `persist` middleware, no `localStorage`, no token. The session lives
 * entirely in an httpOnly cookie the browser sends on its own; this store holds
 * the *profile* that `/api/auth/me` returned, and on a hard refresh it is empty
 * until that request comes back.
 *
 * Persisting it would be tempting — it would remove the loading flash — and it
 * would also mean a stale copy of somebody's role surviving a sign-out, and a
 * cache an XSS bug could read. The loading state is the price and it is worth
 * paying.
 * ---------------------------------------------------------------------------
 *
 * `status` has three values and the third one is load-bearing. A guard that
 * treats "not yet known" as "signed out" redirects to `/login` on every single
 * page refresh, which is the single most common way this pattern is got wrong.
 */
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

interface AuthStore {
  status: AuthStatus
  session: Session | null

  /** Called once, by `AuthProvider`, on mount. Safe to call again. */
  hydrate: () => Promise<void>
  /** After a sign-in or a registration that returned a session. */
  adopt: (session: Session) => void
  /** After a profile update, so the shell re-renders with the new name. */
  patchProfile: (profile: Profile) => void
  /** Ends the session on the server, then locally. */
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  status: 'loading',
  session: null,

  hydrate: async () => {
    try {
      const session = await api.get('/auth/me', meResponseSchema)
      adoptProfileLocale(session.profile.locale)
      set({ status: 'authenticated', session })
    } catch (error) {
      /**
       * A 401 here is the ordinary state of a visitor who is not signed in, not
       * a failure — `/api/auth/me` refuses anonymous callers by design. Anything
       * else is a genuine fault, and it still resolves to "anonymous" because
       * the alternative is a shell stuck on its loading state forever, but it is
       * logged rather than swallowed.
       */
      if (!isApiError(error) || !error.isUnauthorized) {
        console.error('[auth] could not read the current session', error)
      }
      set({ status: 'anonymous', session: null })
    }
  },

  adopt: (session) => {
    adoptProfileLocale(session.profile.locale)
    set({ status: 'authenticated', session })
  },

  patchProfile: (profile) => {
    const current = get().session
    if (!current) return
    adoptProfileLocale(profile.locale)
    set({ session: { ...current, profile } })
  },

  signOut: async () => {
    try {
      await api.post('/auth/logout', logoutResponseSchema)
    } catch (error) {
      // The cookie may already be gone. Clearing locally regardless is the only
      // behaviour that cannot strand someone in a half-signed-out shell.
      console.warn('[auth] sign-out request did not complete', error)
    }
    set({ status: 'anonymous', session: null })
  },
}))

/* -------------------------------------------------------------------------- */
/* Selectors                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Individual selectors rather than one `useAuth()` returning the whole store:
 * the shell re-renders on every field of the session otherwise, and the
 * preference toggles in `/settings` write to it on every keystroke.
 */
export const useAuthStatus = (): AuthStatus => useAuthStore((state) => state.status)
export const useSession = (): Session | null => useAuthStore((state) => state.session)
export const useProfile = (): Profile | null => useAuthStore((state) => state.session?.profile ?? null)

/** True only when the answer is known. `loading` is not signed out. */
export const useIsAuthenticated = (): boolean => useAuthStore((state) => state.status === 'authenticated')

/** Phase 4's redirect keys on exactly this. */
export const useNeedsOnboarding = (): boolean =>
  useAuthStore((state) => state.status === 'authenticated' && state.session?.profile.onboardedAt === null)
