import * as React from 'react'

import { useAuthStore } from './auth-store'

/**
 * Reads the session once, on load.
 *
 * It renders nothing. The alternative — a provider that withholds its children
 * until the session resolves — would mean `/login` and the landing page also
 * wait on a request they do not need, and a visitor who is not signed in would
 * stare at a spinner before seeing a public screen. Waiting is a decision each
 * *route* makes, and `ProtectedRoute` is where it is made.
 *
 * Mounted above the router in `App.tsx`, so it survives navigation and the
 * request happens exactly once per page load.
 */
export function AuthProvider(): null {
  const hydrate = useAuthStore((state) => state.hydrate)

  React.useEffect(() => {
    // StrictMode runs effects twice in development. `hydrate` is idempotent —
    // it is one GET and a `set` — so the second pass costs a request and
    // changes nothing.
    void hydrate()
  }, [hydrate])

  return null
}
