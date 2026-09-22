import type { Finding, FindingEndpoint, FindingKind } from '@shared/contracts'

import type { MessageKey } from './en.ts'

/**
 * A finding, in words — the hint-first pair the results page shows and the
 * deterministic text the AI Coach falls back to.
 *
 * Pure and translator-agnostic on purpose: the results page passes `useT()`,
 * and the server passes a translator built from the same catalogues
 * (`api/ai/fallback.ts`), so the words a student reads are identical whether
 * or not a model was involved. Only type imports here — the server loads this
 * file by relative path, without the client's aliases.
 */

export type Translator = (key: MessageKey, vars?: Record<string, string | number>) => string

const KEYS: Record<FindingKind, { question: MessageKey; fix: MessageKey }> = {
  rail_short: { question: 'coach.rail_short.question', fix: 'coach.rail_short.fix' },
  led_unprotected: { question: 'coach.led_unprotected.question', fix: 'coach.led_unprotected.fix' },
  missing_part: { question: 'coach.missing_part.question', fix: 'coach.missing_part.fix' },
  missing_link: { question: 'coach.missing_link.question', fix: 'coach.missing_link.fix' },
  extra_link: { question: 'coach.extra_link.question', fix: 'coach.extra_link.fix' },
  polarity: { question: 'coach.polarity.question', fix: 'coach.polarity.fix' },
  wrong_value: { question: 'coach.wrong_value.question', fix: 'coach.wrong_value.fix' },
}

export function describeEndpoint(endpoint: FindingEndpoint, t: Translator): string {
  if (endpoint.kind === 'rail')
    return t(endpoint.rail === 'vcc' ? 'coach.endpoint.vcc' : 'coach.endpoint.gnd')
  return t('coach.endpoint.pin', { ref: endpoint.ref, pin: endpoint.pin, column: endpoint.column })
}

export function findingText(finding: Finding, t: Translator): { question: string; fix: string } {
  const [first, second] = finding.endpoints
  const vars: Record<string, string | number> = {
    ...finding.params,
    refs: finding.refs.join(', '),
    columns: finding.columns.join(', '),
    a: first ? describeEndpoint(first, t) : '',
    b: second ? describeEndpoint(second, t) : '',
  }
  const keys = KEYS[finding.kind]
  return { question: t(keys.question, vars), fix: t(keys.fix, vars) }
}
