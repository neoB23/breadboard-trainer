import type { Finding, Grade, GradeLineId, Locale } from '../../shared/contracts/index.ts'
import type { MessageKey } from '../../src/i18n/en.ts'
import { findingText } from '../../src/i18n/findings.ts'
import { translatorFor } from './fallback.ts'

/**
 * The diagnostic digest — the only thing the model ever sees.
 *
 * It is a finished result, not a question: the grade is computed, the
 * findings are chosen and ordered, and each already carries its deterministic
 * question and fix in the student's language. The model's whole job is to
 * say those same facts more warmly.
 *
 * It carries **no identity**. No name, email, student number, attempt id,
 * exercise id or title — nothing that says who built this board or where.
 * The model is never told who it is talking to (non-negotiable 11).
 */

export interface DigestFinding {
  id: string
  kind: Finding['kind']
  refs: string[]
  /** `D1.K`, `R1.2` — every pin the finding names. */
  pins: string[]
  columns: number[]
  /** Part values the finding mentions — the only electrical quantities the model may repeat. */
  values: string[]
  question: string
  fix: string
}

export interface CoachDigest {
  context: { mode: 'assignment'; trigger: 'submit'; locale: Locale }
  verdict: 'clean' | 'issues'
  /** The finding to lead with, or null on a clean board. */
  focus: string | null
  score: { total: number; lines: { id: GradeLineId; earned: number; possible: number }[] }
  findings: DigestFinding[]
  /** What went right, one short sentence per full-marks line. */
  correct: string[]
}

const STRENGTH: Record<GradeLineId, MessageKey> = {
  circuit: 'coach.strength.circuit',
  parts: 'coach.strength.parts',
  polarity: 'coach.strength.polarity',
  safety: 'coach.strength.safety',
}

export function buildDigest(grade: Grade, findings: readonly Finding[], locale: Locale): CoachDigest {
  const t = translatorFor(locale)

  const digestFindings: DigestFinding[] = findings.map((finding) => {
    const { question, fix } = findingText(finding, t)
    const pins = finding.endpoints.flatMap((endpoint) =>
      endpoint.kind === 'pin' ? [`${endpoint.ref}.${endpoint.pin}`] : [],
    )
    const values = ['expected', 'actual', 'value']
      .map((key) => finding.params[key])
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
    const endpointColumns = finding.endpoints.flatMap((endpoint) =>
      endpoint.kind === 'pin' ? [endpoint.column] : [],
    )
    return {
      id: finding.id,
      kind: finding.kind,
      refs: [...finding.refs],
      pins,
      columns: [...new Set([...finding.columns, ...endpointColumns])].sort((a, b) => a - b),
      values,
      question,
      fix,
    }
  })

  return {
    context: { mode: 'assignment', trigger: 'submit', locale },
    verdict: findings.length === 0 ? 'clean' : 'issues',
    focus: findings[0]?.id ?? null,
    score: {
      total: grade.score,
      lines: grade.lines.map((line) => ({ id: line.id, earned: line.earned, possible: line.possible })),
    },
    findings: digestFindings,
    correct: grade.lines.filter((line) => line.earned === line.possible).map((line) => t(STRENGTH[line.id])),
  }
}
