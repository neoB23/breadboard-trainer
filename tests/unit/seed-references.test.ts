import { describe, expect, it } from 'vitest'

import { shiftBoard } from '../../api/db/reference-boards.ts'
import { SEED_REFERENCES } from '../../api/db/seed.ts'
import { gradeSubmission } from '../../api/grading/submit.ts'
import { parseBoardState, serializeBoard } from '../../src/board/model.ts'
import { buildGoldenNetlist, validateReference } from '../../src/board/netlist.ts'

/**
 * Every reference the seed captures is held to the bar Learn Mode capture
 * enforces — and then to the one that matters more: a student who builds it
 * exactly, somewhere else on the board, gets 100.
 */

describe.each(SEED_REFERENCES.map((reference) => [reference.exerciseId, reference] as const))(
  'seeded reference %s',
  (_id, reference) => {
    it('would be accepted by Learn Mode capture', () => {
      expect(validateReference(reference.board(), reference.bom)).toEqual([])
    })

    it('survives the board parser part for part', () => {
      const board = reference.board()
      expect(parseBoardState(serializeBoard(board), reference.bom)).toHaveLength(board.length)
    })

    it('scores 100 against itself, built further along the board', () => {
      const golden = buildGoldenNetlist(parseBoardState(serializeBoard(reference.board()), reference.bom))
      for (const by of [0, 1, 2]) {
        const student = shiftBoard(reference.board(), by)
        const judged = gradeSubmission(serializeBoard(student), reference.bom, golden)
        expect(judged.graded?.grade.score, `shifted by ${by}`).toBe(100)
        expect(judged.graded?.findings).toEqual([])
      }
    })
  },
)
