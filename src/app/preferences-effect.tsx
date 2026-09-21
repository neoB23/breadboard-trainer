import { useEffect } from 'react'

import { applyPreferences, usePreferences } from './preferences'

/**
 * Keeps <html> in sync with the preference store, including live changes to the
 * OS colour scheme while `theme` is set to "system".
 */
export function PreferencesEffect() {
  const theme = usePreferences((s) => s.theme)
  const highContrast = usePreferences((s) => s.highContrast)
  const reducedMotion = usePreferences((s) => s.reducedMotion)
  const largerText = usePreferences((s) => s.largerText)

  useEffect(() => {
    const prefs = { theme, highContrast, reducedMotion, largerText }
    applyPreferences(prefs)

    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyPreferences(prefs)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme, highContrast, reducedMotion, largerText])

  return null
}
