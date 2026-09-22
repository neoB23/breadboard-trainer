import type { CoachDigest } from './digest.ts'

/**
 * The grounding check — what makes model-written feedback safe to show.
 *
 * It runs on the **complete** message, on the server, before a single word of
 * it is stored or sent. One failure anywhere fails the whole message and the
 * deterministic text is served instead: a student never sees half of an
 * answer the check did not trust.
 *
 * Every rule is about facts, not style, and none of them depend on the
 * language the model wrote in:
 *
 *   1. every suggestion names a finding the digest has, once;
 *   2. every ref (`D1`) and pin (`D1.K`) it writes is one the digest names;
 *   3. every electrical quantity (`220Ω`, `5V`) appears in the digest — this is
 *      the rule that stops "try a 10Ω resistor";
 *   4. every other number appears in the digest — columns, counts;
 *   5. no question gives away its own fix: a pin or column that appears only
 *      in a finding's deterministic fix may not appear in the model's question;
 *   6. a clean board gets praise and no suggestions;
 *   7. nothing too long, and no links.
 */

export interface CoachOutput {
  suggestions: { findingId: string; question: string; fix: string }[]
  praise: string | null
}

export type GroundingResult = { ok: true } | { ok: false; reason: string }

const MAX_WORDS = 70
const REF = /\b([RDCQWU]\d{1,2})(?:\.([12AKCBE]))?\b/g
const QUANTITY = /(\d+(?:[.,]\d+)?)\s*([kKmMµuμnp]?)\s*(Ω|ohms?|mA|V|A|W|F)(?![A-Za-z])/gi
const NUMBER = /\d+(?:[.,]\d+)?/g

export function checkGrounding(output: CoachOutput, digest: CoachDigest): GroundingResult {
  const findings = new Map(digest.findings.map((finding) => [finding.id, finding]))

  /* ---- 6: clean boards get praise only ------------------------------- */

  if (digest.verdict === 'clean' && output.suggestions.length > 0) {
    return { ok: false, reason: 'suggestions on a clean board' }
  }

  /* ---- 1: findings exist, once each ------------------------------------ */

  const seen = new Set<string>()
  for (const suggestion of output.suggestions) {
    if (!findings.has(suggestion.findingId))
      return { ok: false, reason: `unknown finding ${suggestion.findingId}` }
    if (seen.has(suggestion.findingId)) return { ok: false, reason: `finding ${suggestion.findingId} twice` }
    seen.add(suggestion.findingId)
  }

  /* ---- what the digest allows ------------------------------------------ */

  const allowedRefs = new Set<string>()
  const allowedPins = new Set<string>()
  for (const finding of digest.findings) {
    for (const ref of finding.refs) allowedRefs.add(ref)
    for (const pin of finding.pins) {
      allowedPins.add(pin)
      allowedRefs.add(pin.split('.')[0] ?? pin)
    }
  }

  const digestText = JSON.stringify(digest)
  const allowedQuantities = new Set(quantities(digestText))
  const allowedNumbers = new Set(numbers(stripQuantities(digestText)))

  /* ---- 2–4, 7 over every piece of text ---------------------------------- */

  const texts = [
    ...output.suggestions.flatMap((suggestion) => [suggestion.question, suggestion.fix]),
    ...(output.praise === null ? [] : [output.praise]),
  ]

  for (const text of texts) {
    if (/https?:\/\/|www\./i.test(text)) return { ok: false, reason: 'contains a link' }
    if (text.trim().split(/\s+/).length > MAX_WORDS) return { ok: false, reason: 'too long' }

    for (const match of text.matchAll(REF)) {
      const ref = match[1] ?? ''
      const pin = match[2]
      if (!allowedRefs.has(ref)) return { ok: false, reason: `invented ref ${ref}` }
      if (pin !== undefined && !allowedPins.has(`${ref}.${pin}`) && !refIsWhole(ref, digest)) {
        return { ok: false, reason: `invented pin ${ref}.${pin}` }
      }
    }

    for (const quantity of quantities(text)) {
      if (!allowedQuantities.has(quantity)) return { ok: false, reason: `invented quantity ${quantity}` }
    }

    const withoutTokens = stripQuantities(text).replace(REF, ' ')
    for (const number of numbers(withoutTokens)) {
      if (!allowedNumbers.has(number)) return { ok: false, reason: `invented number ${number}` }
    }
  }

  /* ---- 5: no question spoils its own fix -------------------------------- */

  for (const suggestion of output.suggestions) {
    const finding = findings.get(suggestion.findingId)
    if (!finding) continue
    const inQuestion = tokens(finding.question)
    const spoilers = [...tokens(finding.fix)].filter((token) => !inQuestion.has(token))
    const asked = tokens(suggestion.question)
    const spoiled = spoilers.find((token) => asked.has(token))
    if (spoiled !== undefined) return { ok: false, reason: `question gives away ${spoiled}` }
  }

  return { ok: true }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** A ref named as a whole part (`D1`, not `D1.K`) may have any of its pins mentioned. */
function refIsWhole(ref: string, digest: CoachDigest): boolean {
  return digest.findings.some((finding) => finding.refs.includes(ref))
}

const PREFIX: Record<string, string> = {
  k: 'k',
  K: 'k',
  m: 'm',
  M: 'M',
  µ: 'µ',
  u: 'µ',
  μ: 'µ',
  n: 'n',
  p: 'p',
  '': '',
}

/** `220 Ω`, `220ohm` and `220Ω` are one quantity; so are `20mA` read as m+A or as mA. */
function quantities(text: string): string[] {
  const found: string[] = []
  for (const match of text.matchAll(QUANTITY)) {
    const value = Number((match[1] ?? '').replace(',', '.'))
    const rawPrefix = match[2] ?? ''
    const prefix = PREFIX[rawPrefix] ?? rawPrefix
    const rawUnit = match[3] ?? ''
    const unit = /^(Ω|ohms?)$/i.test(rawUnit)
      ? 'Ω'
      : rawUnit.toUpperCase() === 'MA'
        ? 'mA'
        : rawUnit.toUpperCase()
    found.push(`${value}${prefix}${unit}`)
  }
  return found
}

function stripQuantities(text: string): string {
  return text.replace(QUANTITY, ' ')
}

function numbers(text: string): string[] {
  return [...text.matchAll(NUMBER)].map((match) => String(Number((match[0] ?? '').replace(',', '.'))))
}

/**
 * Refs, pins and column numbers — the facts a question could spoil. "Remove
 * W4" names the answer as surely as "column 17" does.
 */
function tokens(text: string): Set<string> {
  const found = new Set<string>()
  for (const match of text.matchAll(REF)) {
    found.add(match[1] ?? '')
    if (match[2] !== undefined) found.add(`${match[1]}.${match[2]}`)
  }
  for (const number of numbers(stripQuantities(text).replace(REF, ' '))) found.add(`#${number}`)
  return found
}
