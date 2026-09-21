import * as React from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { Locale } from '@shared/contracts/common.ts'

import { en, type Catalog, type MessageKey } from './en'
import { fil } from './fil'

/**
 * The i18n layer. Dependency-free, ~80 lines, and typed so that a missing
 * translation cannot reach a student.
 *
 * ---------------------------------------------------------------------------
 * WHY NOT react-i18next
 *
 * Two locales, one namespace, no plural rules, no lazy loading, no ICU. The
 * library would add ~40kB to a bundle that is already over Vite's warning
 * threshold, and it would buy a runtime fallback — which is precisely the
 * behaviour this project does not want. A missing key here is a build error;
 * with a fallback it is an English string in a Filipino UI that nobody notices
 * until a panelist does.
 * ---------------------------------------------------------------------------
 */

export type { Catalog, MessageKey }
export type { Locale }

const CATALOGUES: Record<Locale, Catalog> = { en, fil }

export const LOCALES: readonly Locale[] = ['en', 'fil']

/* -------------------------------------------------------------------------- */
/* Interpolation                                                              */
/* -------------------------------------------------------------------------- */

export type MessageVars = Record<string, string | number>

/**
 * `{name}` is replaced; anything else is left alone.
 *
 * A placeholder with no matching variable is left in the string rather than
 * blanked. A visible `{email}` in the UI is a bug someone reports on sight; an
 * empty gap in a sentence reads as a design decision and survives to the demo.
 */
function interpolate(template: string, vars: MessageVars | undefined): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = vars[name]
    return value === undefined ? whole : String(value)
  })
}

/**
 * Translate outside React — for a `toast()` fired from a submit handler, or an
 * `aria-label` computed in a helper.
 */
export function translate(locale: Locale, key: MessageKey, vars?: MessageVars): string {
  const catalogue = CATALOGUES[locale]
  // Indexing a `Catalog` by a `MessageKey` is total, so this cannot be
  // undefined — but `noUncheckedIndexedAccess` cannot see that through the
  // mapped type, and asserting it away would defeat the flag everywhere else.
  const template: string | undefined = catalogue[key]
  return interpolate(template ?? en[key], vars)
}

export type TranslateFn = (key: MessageKey, vars?: MessageVars) => string

/* -------------------------------------------------------------------------- */
/* The store                                                                  */
/* -------------------------------------------------------------------------- */

interface LocaleStore {
  locale: Locale
  /**
   * True once the person has actually chosen. Until then the locale is a guess
   * from the browser, and a signed-in profile is allowed to overrule it — after
   * an explicit choice, nothing overrules it silently.
   */
  chosen: boolean
  set: (locale: Locale, chosen?: boolean) => void
}

function browserDefault(): Locale {
  if (typeof navigator === 'undefined') return 'en'
  // `fil`, `tl`, `fil-PH`, `tl-PH` all mean the same thing to a student.
  const preferred = navigator.languages ?? [navigator.language]
  return preferred.some((tag) => /^(fil|tl)\b/i.test(tag)) ? 'fil' : 'en'
}

/**
 * Persisted locally as well as to the profile.
 *
 * The local copy is what a signed-out visitor on `/login` gets — there is no
 * profile to read yet, and defaulting them to English when they have already
 * chosen Filipino once is the kind of small rudeness that makes a language
 * toggle feel decorative.
 */
export const useLocaleStore = create<LocaleStore>()(
  persist(
    (set) => ({
      locale: browserDefault(),
      chosen: false,
      set: (locale, chosen = true) => set({ locale, chosen }),
    }),
    { name: 'bbt.locale' },
  ),
)

/**
 * Adopts the locale stored on a profile, unless the person has since chosen a
 * different one in this browser. Called by `AuthProvider` on hydration.
 */
export function adoptProfileLocale(locale: Locale): void {
  const state = useLocaleStore.getState()
  if (state.chosen && state.locale !== locale) return
  if (state.locale === locale) return
  state.set(locale, state.chosen)
}

/* -------------------------------------------------------------------------- */
/* Hooks                                                                      */
/* -------------------------------------------------------------------------- */

export function useLocale(): Locale {
  return useLocaleStore((state) => state.locale)
}

/**
 * The one hook every screen uses.
 *
 *     const t = useT()
 *     <h1>{t('login.title')}</h1>
 *     <p>{t('checkEmail.body', { email })}</p>
 *
 * `key` is `MessageKey`, so a typo is a compile error and a string that is not
 * in the catalogue cannot be passed at all.
 */
export function useT(): TranslateFn {
  const locale = useLocale()
  return React.useCallback<TranslateFn>((key, vars) => translate(locale, key, vars), [locale])
}

/**
 * Keeps `<html lang>` in step with the chosen locale.
 *
 * Not cosmetic: it is what tells a screen reader which voice to use, and a
 * Filipino sentence read aloud with English phonemes is unintelligible rather
 * than merely wrong.
 */
export function LocaleEffect(): null {
  const locale = useLocale()

  React.useEffect(() => {
    document.documentElement.lang = locale === 'fil' ? 'fil' : 'en'
  }, [locale])

  return null
}
