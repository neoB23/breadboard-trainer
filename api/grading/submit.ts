import { goldenNetlistV2Schema } from '../../shared/contracts/exercises-instructor.ts'
import type { Bom, Finding, Grade } from '../../shared/contracts/index.ts'
import { compareNetlists } from '../../src/board/compare.ts'
import { parseBoardState, type PlacedPart } from '../../src/board/model.ts'
import { analyseBoard, type BoardAnalysis } from '../../src/board/nets.ts'
import { extractNetlist, pinRolesFor } from '../../src/board/netlist.ts'
import { buildFindings } from './findings.ts'
import { grade } from './grade.ts'

/**
 * Everything the server decides about a submitted board, in one pure call.
 *
 * The board is re-read with the same parser the workspace uses, analysed with
 * the same functions the live readout uses, and compared against the stored
 * reference with the comparator the tests pin down. The client's opinion of
 * its own work — the `completed` flag it sends — plays no part: a grade that
 * trusted it would not be a grade.
 *
 * An exercise with no gradable reference (none captured, or the pre-comparator
 * placeholder) is submitted ungraded rather than scored against nothing.
 */

export interface SubmissionStats {
  required: number
  matched: number
  extra: number
  truncated: boolean
  searched: number
}

export interface GradedSubmission {
  parts: PlacedPart[]
  analysis: BoardAnalysis
  completed: boolean
  graded: { grade: Grade; findings: Finding[]; stats: SubmissionStats } | null
}

export function gradeSubmission(finalState: unknown, bom: Bom, goldenNetlist: unknown): GradedSubmission {
  const parts = parseBoardState(finalState, bom)
  const analysis = analyseBoard(parts, bom)
  const completed = analysis.complete

  const reference = goldenNetlistV2Schema.safeParse(goldenNetlist)
  if (!reference.success) return { parts, analysis, completed, graded: null }

  const comparison = compareNetlists(reference.data, extractNetlist(parts))
  if (comparison.truncated) {
    console.warn(
      `[grading] comparator search budget reached after ${comparison.searched} nodes; graded with the best mapping found`,
    )
  }

  const result = grade({
    comparison,
    safety: {
      railShort: analysis.warnings.some((warning) => warning.kind === 'rail-short'),
      unprotectedLeds: analysis.warnings
        .filter((warning) => warning.kind === 'led-direct')
        .flatMap((warning) => warning.refs),
    },
    placedComponents: parts.filter((part) => pinRolesFor(part.type) !== null).length,
  })

  return {
    parts,
    analysis,
    completed,
    graded: {
      grade: result,
      findings: buildFindings(parts, analysis, comparison),
      stats: {
        required: comparison.required,
        matched: comparison.matched,
        extra: comparison.extra,
        truncated: comparison.truncated,
        searched: comparison.searched,
      },
    },
  }
}
