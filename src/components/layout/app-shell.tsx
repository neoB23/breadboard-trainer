import { LogOut, Menu, Moon, Settings, Sun, User, X } from 'lucide-react'
import * as React from 'react'
import { Link, NavLink } from 'react-router-dom'

import { usePreferences } from '@/app/preferences'
import { useT } from '@/i18n'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui'
import { cn } from '@/lib/utils'

export interface AppShellUser {
  name: string
  email: string
  role: 'student' | 'instructor' | 'admin'
}

export interface AppShellProps {
  /** Rendered in a left rail on >=1024px, and behind the menu button below it. */
  sidebar?: React.ReactNode
  /** `AppNavItem`s. Centred in the header on >=1024px, stacked in the overlay below it. */
  nav?: React.ReactNode
  user?: AppShellUser
  /** Enables the sign-out item; it stays disabled until a session is wired up. */
  onSignOut?: () => void
  children: React.ReactNode
}

/**
 * The frame every authenticated screen sits in: header, optional sidebar, and
 * the main content slot. Pages own their own padding via PageHeader + section
 * wrappers, so the shell stays out of the way.
 *
 * The header is a band, not a card: same ground as the page, one hairline along
 * the bottom, nothing else. Everything below it sits on the contour wash.
 */
export function AppShell({ sidebar, nav, user, onSignOut, children }: AppShellProps) {
  const t = useT()
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)
  const hasOverlay = Boolean(sidebar || nav)

  React.useEffect(() => {
    if (!mobileNavOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mobileNavOpen])

  return (
    <div className="flex min-h-screen flex-col bg-bg-900">
      {/* A white band on the faintly grey page, separated by a hairline. Opaque
          rather than translucent: a blurred bar over scrolling content is an
          effect, and this bar has to stay legible while a form scrolls under it. */}
      <header className="sticky top-0 z-40 border-b border-line bg-bg-800">
        <div className="relative flex h-16 items-center gap-3 px-4 sm:px-6">
          {hasOverlay ? (
            <Button
              variant="ghost"
              size="icon"
              className="-ml-2 lg:hidden"
              aria-label={mobileNavOpen ? t('nav.close') : t('nav.open')}
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen((open) => !open)}
            >
              {mobileNavOpen ? <X /> : <Menu />}
            </Button>
          ) : null}

          <Wordmark />

          {/* Absolutely centred so the nav sits on the page axis rather than
              drifting with the width of the two clusters flanking it. */}
          {nav ? (
            <nav
              aria-label={t('nav.primary')}
              className="absolute inset-y-0 left-1/2 hidden -translate-x-1/2 items-stretch gap-7 lg:flex"
            >
              {nav}
            </nav>
          ) : null}

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            {user ? (
              <>
                <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />
                <UserMenu user={user} onSignOut={onSignOut} />
              </>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {sidebar ? (
          // Transparent rail: the page wash runs behind it uninterrupted, and
          // the hairline alone does the separating.
          <aside className="hidden w-60 shrink-0 border-r border-line lg:block">
            <div className="sticky top-16 p-6">{sidebar}</div>
          </aside>
        ) : null}

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {hasOverlay && mobileNavOpen ? (
        <div className="fixed inset-0 top-16 z-30 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 animate-fade-in bg-text-primary/25"
            aria-label={t('nav.close')}
            onClick={() => setMobileNavOpen(false)}
          />
          <div
            className="relative flex h-full w-72 max-w-[85vw] animate-fade-in flex-col gap-8 overflow-y-auto border-r border-line bg-bg-800 p-6 shadow-lg"
            onClick={(event) => {
              // Navigating dismisses the panel; other controls that may live in
              // a sidebar — filters, switches — must not.
              if ((event.target as HTMLElement).closest('a')) setMobileNavOpen(false)
            }}
          >
            {nav ? (
              <nav aria-label={t('nav.primary')} className="flex flex-col items-start">
                {nav}
              </nav>
            ) : null}
            {sidebar}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/**
 * A mark and a name.
 *
 * The mark is the one place the accent appears in the chrome, which is what
 * makes the header read as a product rather than as a toolbar. It also gives
 * the app something recognisable at 28px — a browser tab, a bookmark, a
 * lecturer's projector at the back of a room.
 */
function Wordmark() {
  const t = useT()

  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-md">
      <span
        aria-hidden="true"
        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent font-display text-xs font-bold text-accent-contrast"
      >
        BT
      </span>
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span className="font-display text-base font-semibold leading-none text-text-primary">
          {t('app.name')}
        </span>
        <span className="hidden text-sm text-text-tertiary sm:inline">{t('app.nameSuffix')}</span>
      </span>
    </Link>
  )
}

export interface AppNavItemProps {
  to: string
  /** Match the path exactly — needed for `/`, which otherwise matches everything. */
  end?: boolean
  children: React.ReactNode
  className?: string
}

/**
 * A header nav entry. Active is carried three ways at once — brighter ink, a 1px
 * accent rule, and the `aria-current` NavLink sets — so it survives colour-vision
 * differences and a greyscale screenshot alike.
 *
 * Height comes from the parent, which lets one component sit full-height in the
 * header (rule landing flush on the header hairline) and inline in the overlay.
 */
export function AppNavItem({ to, end, children, className }: AppNavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'relative flex h-full items-center rounded-sm px-1 py-3 text-sm transition-colors',
          isActive ? 'font-medium text-accent' : 'text-text-secondary hover:text-text-primary',
          className,
        )
      }
    >
      {({ isActive }) => (
        <>
          {children}
          {isActive ? (
            <span aria-hidden="true" className="absolute inset-x-0 -bottom-px h-0.5 rounded-pill bg-accent" />
          ) : null}
        </>
      )}
    </NavLink>
  )
}

function ThemeToggle() {
  const t = useT()
  const theme = usePreferences((s) => s.theme)
  const setPreference = usePreferences((s) => s.set)
  const [systemDark, setSystemDark] = React.useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  // `system` is a real third state, so a two-way toggle has to read the OS to
  // know which way it is currently pointing. Choosing either side pins it.
  React.useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const isDark = theme === 'dark' || (theme === 'system' && systemDark)

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? t('theme.toLight') : t('theme.toDark')}
      onClick={() => setPreference('theme', isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  )
}

function UserMenu({ user, onSignOut }: { user: AppShellUser; onSignOut?: () => void }) {
  const t = useT()
  const initials = user.name
    .split(' ')
    .map((part) => part[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('account.menu')}>
          <span className="flex size-8 items-center justify-center rounded-pill bg-accent/10 text-xs font-semibold text-accent">
            {initials}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel>
          <span className="block text-sm text-text-primary">{user.name}</span>
          <span className="block truncate font-mono text-xs text-text-tertiary">{user.email}</span>
          <span className="mt-2 block text-micro uppercase text-text-tertiary">{user.role}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <User aria-hidden="true" />
            {t('account.profile')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <Settings aria-hidden="true" />
            {t('account.settings')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Disabled until a caller hands over the real session teardown. */}
        <DropdownMenuItem disabled={!onSignOut} onSelect={() => onSignOut?.()}>
          <LogOut aria-hidden="true" />
          {t('account.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
