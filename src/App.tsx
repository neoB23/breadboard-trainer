import { RouterProvider } from 'react-router-dom'

import { PreferencesEffect } from '@/app/preferences-effect'
import { router } from '@/app/router'
import { Toaster } from '@/components/ui'
import { AuthProvider } from '@/features/auth/auth-provider'
import { LocaleEffect } from '@/i18n'

/**
 * Three effects above the router, all of them rendering nothing.
 *
 * `AuthProvider` reads the session once per page load; `PreferencesEffect`
 * mirrors the accessibility settings onto `<html>`; `LocaleEffect` keeps
 * `<html lang>` in step with the chosen language. None of them gates its
 * children — waiting for a session is a decision each route makes, not one the
 * whole app makes on behalf of a visitor reading the landing page.
 */
export default function App() {
  return (
    <>
      <AuthProvider />
      <PreferencesEffect />
      <LocaleEffect />
      <RouterProvider router={router} />
      <Toaster />
    </>
  )
}
