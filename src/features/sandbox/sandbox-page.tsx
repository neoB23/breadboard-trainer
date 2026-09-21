import * as React from 'react'

import { parseBoardState, type PlacedPart } from '@/board/model'
import { AppNavItem, AppShell, type AppShellUser } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/layout/page-header'
import { useAuthStore } from '@/features/auth/auth-store'
import { Workspace } from '@/features/lab/workspace'
import { useT } from '@/i18n'
import type { Bom } from '@shared/contracts'

/**
 * `/sandbox` — free build. The same workspace as an exercise, with the two
 * things an exercise imposes taken away: the tray is a shelf instead of a
 * budget, and there is nothing to hand in.
 *
 * ---------------------------------------------------------------------------
 * WHY THE BOARD LIVES IN THIS BROWSER AND NOT IN AN ATTEMPT
 *
 * An attempt is a run at an exercise — it hangs off an exercise id, it appears
 * in an instructor's drill-down, and Phase 20's numbers are computed over it.
 * A sandbox doodle is none of those things, and storing it as a row would make
 * it all of them. localStorage keeps the doodle exactly as private and exactly
 * as durable as it deserves to be: it survives a refresh on this machine and
 * follows nobody anywhere.
 * ---------------------------------------------------------------------------
 *
 * The shelf is fixed rather than read from anywhere: the standard first-year
 * kit, one line per real drawer in the lab cabinet. Quantities are the tray's
 * "effectively unlimited" — nobody hand-places 99 parts on twenty columns.
 */

export const SANDBOX_STORAGE_KEY = 'bbt.sandbox.board'

const SHELF: Bom = [
  { id: 'r-220', type: 'resistor', label: 'Resistor', value: '220Ω', quantity: 99 },
  { id: 'r-1k', type: 'resistor', label: 'Resistor', value: '1kΩ', quantity: 99 },
  { id: 'r-10k', type: 'resistor', label: 'Resistor', value: '10kΩ', quantity: 99 },
  { id: 'led-red', type: 'led', label: 'LED', value: 'Red 2V', quantity: 99 },
  { id: 'c-100n', type: 'capacitor', label: 'Ceramic capacitor', value: '100nF', quantity: 99 },
  { id: 'c-10u', type: 'capacitor', label: 'Electrolytic capacitor', value: '10µF', quantity: 99 },
  { id: 'q-2n2222', type: 'transistor', label: 'NPN transistor', value: '2N2222', quantity: 99 },
  { id: 'd-1n4148', type: 'diode', label: 'Diode', value: '1N4148', quantity: 99 },
  { id: 'jumper', type: 'jumper', label: 'Jumper wire', value: null, quantity: 99 },
]

function restore(): PlacedPart[] {
  try {
    const raw = window.localStorage.getItem(SANDBOX_STORAGE_KEY)
    if (raw === null) return []
    return parseBoardState(JSON.parse(raw), SHELF)
  } catch {
    return []
  }
}

export function SandboxPage() {
  const t = useT()
  const session = useAuthStore((state) => state.session)
  const signOut = useAuthStore((state) => state.signOut)

  // Read once, on mount. The workspace owns the board from here; re-reading
  // storage on a re-render would clobber unsaved state with stale state.
  const [initialParts] = React.useState<PlacedPart[]>(restore)

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
          <AppNavItem to="/dashboard">{t('nav.dashboard')}</AppNavItem>
          <AppNavItem to="/sandbox">{t('nav.sandbox')}</AppNavItem>
          <AppNavItem to="/settings">{t('nav.settings')}</AppNavItem>
        </>
      }
    >
      <PageHeader
        className="[&>div]:mx-auto [&>div]:w-full [&>div]:max-w-shell"
        title={t('sandbox.title')}
        subtitle={t('sandbox.subtitle')}
      />

      <div className="mx-auto w-full max-w-shell px-4 pb-20 pt-8 sm:px-6">
        <Workspace bom={SHELF} initialParts={initialParts} sandboxKey={SANDBOX_STORAGE_KEY} />
      </div>
    </AppShell>
  )
}
