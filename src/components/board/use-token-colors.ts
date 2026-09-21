import * as React from 'react'

/**
 * Reads the design tokens out of the live stylesheet as colours Three.js can use.
 *
 * ---------------------------------------------------------------------------
 * WHY NOT JUST HARDCODE THE HEXES IN THE SCENE
 *
 * Because there would then be two palettes. `tokens.css` changes hue between
 * light and dark and again under high contrast, and a 3D board holding its own
 * copy of "blue" would be the one thing on the page that ignored all three. It
 * would also be the first thing to drift the next time the accent is retuned —
 * and nothing would fail to build when it did.
 *
 * The tokens are stored as HSL *channels* (`212 100% 47%`) rather than complete
 * colours, so that Tailwind can apply an alpha modifier to them. That is why
 * this reads the variable and reassembles it rather than parsing a hex.
 * ---------------------------------------------------------------------------
 */

/** The tokens the 3D scene needs. Kept small — every one is a real lookup. */
const TOKENS = [
  'bg-800',
  'bg-900',
  'bg-700',
  'line',
  'text-tertiary',
  'accent',
  'fault',
  'info',
  'warn-surface',
  'warn-ink',
  'ok',
] as const

export type TokenName = (typeof TOKENS)[number]
export type TokenColors = Record<TokenName, string>

/**
 * `hsl(212 100% 47%)` from the channel triplet in the variable.
 *
 * Returns a CSS colour string rather than a `THREE.Color`, so this module stays
 * free of the three.js import and can be loaded on a page that never renders a
 * scene. `new THREE.Color()` accepts this string directly.
 */
function readToken(styles: CSSStyleDeclaration, name: string): string {
  const raw = styles.getPropertyValue(`--${name}`).trim()
  if (!raw) return '#888888'

  // A few tokens carry their own alpha (`0 0% 100% / 0.08`). Three has no use
  // for the alpha on a material colour, so it is dropped rather than fumbled.
  const [channels] = raw.split('/')

  /**
   * Commas, not spaces — and this is not cosmetic.
   *
   * Tokens are stored in the space-separated form CSS Color 4 uses, because that
   * is what lets Tailwind append an alpha (`hsl(var(--accent) / 0.1)`).
   * `THREE.Color.setStyle` parses the *older* comma syntax and silently falls
   * back to white on anything it does not recognise — so handing it the raw
   * token produced an entire scene of white plastic with no error anywhere.
   * Rewriting the separators is the whole fix.
   */
  const parts = (channels ?? raw).trim().split(/\s+/)
  return parts.length === 3 ? `hsl(${parts.join(', ')})` : `hsl(${channels?.trim() ?? raw})`
}

function readAll(): TokenColors {
  const styles = getComputedStyle(document.documentElement)
  return Object.fromEntries(TOKENS.map((token) => [token, readToken(styles, token)])) as TokenColors
}

/**
 * The current palette, re-read whenever the theme or a preference changes.
 *
 * Watches the class on `<html>` because that is where `applyPreferences` puts
 * `dark`, `high-contrast` and the rest — the same signal `useReducedMotion`
 * listens to. Without it, switching to dark mode would leave the board lit for
 * the light one until a reload.
 */
export function useTokenColors(): TokenColors | null {
  // Null until the first read, so nothing renders against a guessed palette.
  const [colors, setColors] = React.useState<TokenColors | null>(null)

  React.useEffect(() => {
    const read = () => setColors(readAll())
    read()

    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    // `system` theme follows the OS, which changes without touching the class.
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', read)

    return () => {
      observer.disconnect()
      media.removeEventListener('change', read)
    }
  }, [])

  return colors
}
