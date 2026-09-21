import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeSetting = 'light' | 'dark' | 'system'

export interface Preferences {
  theme: ThemeSetting
  highContrast: boolean
  reducedMotion: boolean
  largerText: boolean
}

interface PreferencesStore extends Preferences {
  set: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void
}

const defaults: Preferences = {
  // Light-first. The palette is designed against white and dark is the
  // adaptation, so a first-time visitor sees the theme everything was drawn in.
  theme: 'light',
  highContrast: false,
  reducedMotion: false,
  largerText: false,
}

/**
 * Local half of the accessibility settings. Phase 4 adds the `profiles` sync so
 * the same choices follow a student to another machine; the CSS these flags
 * drive already exists in src/index.css, so nothing downstream has to change.
 */
export const usePreferences = create<PreferencesStore>()(
  persist(
    (set) => ({
      ...defaults,
      set: (key, value) => set({ [key]: value } as Pick<Preferences, typeof key>),
    }),
    { name: 'bbt.preferences' },
  ),
)

const prefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches

/** Reflect the current preferences onto <html>. Called by PreferencesEffect. */
export function applyPreferences(prefs: Preferences) {
  const root = document.documentElement
  const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && prefersDark())

  root.classList.toggle('dark', dark)
  root.classList.toggle('high-contrast', prefs.highContrast)
  root.classList.toggle('reduce-motion', prefs.reducedMotion)
  root.classList.toggle('text-larger', prefs.largerText)
  root.style.colorScheme = dark ? 'dark' : 'light'
}
