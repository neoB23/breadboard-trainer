import type { Locale } from '../../shared/contracts/index.ts'
// The catalogues themselves, never `src/i18n/index.ts` — that module pulls in
// React and Zustand. These two are plain objects, and fil's only import is a
// type, erased before the server ever runs it.
import { en, type MessageKey } from '../../src/i18n/en.ts'
import { fil } from '../../src/i18n/fil.ts'
import type { Translator } from '../../src/i18n/findings.ts'

/**
 * The deterministic words — what the student reads when no model wrote
 * anything, and what the model is handed as the facts to reword.
 *
 * They come from the client's own catalogues, so the fallback a student sees
 * after a model outage is the same sentence, in the same language, as the
 * results page renders on its own.
 */

const CATALOGUES = { en, fil } as const

export function translatorFor(locale: Locale): Translator {
  const catalogue = CATALOGUES[locale]
  return (key: MessageKey, vars?: Record<string, string | number>) => {
    const template: string | undefined = catalogue[key]
    return interpolate(template ?? en[key], vars)
  }
}

/** The same five lines as `src/i18n/index.ts`: `{name}` is replaced, anything else is left alone. */
function interpolate(template: string, vars: Record<string, string | number> | undefined): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = vars[name]
    return value === undefined ? whole : String(value)
  })
}
