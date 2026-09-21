import { describe, expect, it } from 'vitest'

import {
  actionFor,
  classProgress,
  completionRatio,
  filterLibrary,
  firstName,
  formatClock,
  formatDay,
  formatToday,
  groupActivity,
  orderForLibrary,
  pickNext,
  tally,
} from '../../src/features/dashboard/library.ts'
import type { AssignedExercise, ExerciseStatus } from '../../shared/contracts/index.ts'

/**
 * What the dashboard decides, tested without a DOM.
 *
 * These are the rules that are obviously right the day they are written and
 * quietly wrong six months later — "why is the finished one at the top" is a bug
 * nobody files, they just stop trusting the screen. Everything under test is a
 * projection of a real API response, so a fixture here is a real wire shape
 * rather than a hand-waved object.
 */

const CLASS_A = '0f9b1a6e-2c4d-4a11-9f3e-00000000000a'
const CLASS_B = '0f9b1a6e-2c4d-4a11-9f3e-00000000000b'

let nextId = 0

function exercise(
  overrides: {
    title?: string
    status?: ExerciseStatus
    openAttemptId?: string | null
    classId?: string | null
    lastAttemptAt?: string | null
    attemptCount?: number
  } = {},
): AssignedExercise {
  nextId += 1
  const status = overrides.status ?? 'not_started'

  return {
    id: `exercise-${nextId}`,
    classId: overrides.classId === undefined ? CLASS_A : overrides.classId,
    authorId: 'instructor-1',
    title: overrides.title ?? `Exercise ${nextId}`,
    objective: null,
    difficulty: 2,
    schematicUrl: null,
    bom: [],
    netlistVersion: 1,
    published: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    progress: {
      status,
      attemptCount: overrides.attemptCount ?? (status === 'not_started' ? 0 : 1),
      lastAttemptAt: overrides.lastAttemptAt ?? null,
      openAttemptId: overrides.openAttemptId ?? null,
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Counting                                                                   */
/* -------------------------------------------------------------------------- */

describe('tally', () => {
  it('counts each status, and the total is the length of the list', () => {
    const list = [
      exercise({ status: 'completed' }),
      exercise({ status: 'completed' }),
      exercise({ status: 'in_progress' }),
      exercise({ status: 'not_started' }),
    ]

    expect(tally(list)).toEqual({ assigned: 4, notStarted: 1, inProgress: 1, completed: 2 })
  })

  it('is all zeroes for an empty list rather than throwing', () => {
    expect(tally([])).toEqual({ assigned: 0, notStarted: 0, inProgress: 0, completed: 0 })
  })
})

describe('completionRatio', () => {
  it('is the completed share', () => {
    expect(completionRatio({ assigned: 4, notStarted: 1, inProgress: 1, completed: 2 })).toBe(0.5)
  })

  // The dashboard multiplies this by 100 and hands it to a progress bar. NaN
  // there is an empty track and a React warning, not a visible failure.
  it('is 0 and not NaN when nothing is assigned', () => {
    expect(completionRatio({ assigned: 0, notStarted: 0, inProgress: 0, completed: 0 })).toBe(0)
  })
})

/* -------------------------------------------------------------------------- */
/* Ordering                                                                   */
/* -------------------------------------------------------------------------- */

describe('pickNext', () => {
  it('prefers something already in progress over something untouched', () => {
    const open = exercise({ title: 'Half built', status: 'in_progress' })
    const list = [exercise({ title: 'Fresh' }), open]

    expect(pickNext(list)?.title).toBe('Half built')
  })

  it('falls back to the first not-started, which is the API order', () => {
    const list = [exercise({ status: 'completed' }), exercise({ title: 'First fresh' }), exercise({})]

    expect(pickNext(list)?.title).toBe('First fresh')
  })

  it('never features a completed exercise — there is nothing to do', () => {
    expect(pickNext([exercise({ status: 'completed' }), exercise({ status: 'completed' })])).toBeNull()
  })

  it('is null for an empty list', () => {
    expect(pickNext([])).toBeNull()
  })
})

describe('orderForLibrary', () => {
  it('puts unfinished work first and finished work last', () => {
    const list = [
      exercise({ title: 'Done', status: 'completed' }),
      exercise({ title: 'Fresh', status: 'not_started' }),
      exercise({ title: 'Open', status: 'in_progress' }),
    ]

    expect(orderForLibrary(list).map((item) => item.title)).toEqual(['Open', 'Fresh', 'Done'])
  })

  // The API sorts by difficulty and this must not undo it. A comparator that
  // also looked at difficulty would be a second source of truth for the same
  // ordering, which is how a list ends up disagreeing with itself.
  it('keeps the incoming order within a status group', () => {
    const list = [exercise({ title: 'Easy' }), exercise({ title: 'Medium' }), exercise({ title: 'Hard' })]

    expect(orderForLibrary(list).map((item) => item.title)).toEqual(['Easy', 'Medium', 'Hard'])
  })

  it('does not mutate the array it was given', () => {
    const list = [exercise({ title: 'Done', status: 'completed' }), exercise({ title: 'Fresh' })]
    orderForLibrary(list)

    expect(list.map((item) => item.title)).toEqual(['Done', 'Fresh'])
  })
})

describe('actionFor', () => {
  it('resumes when there is an attempt left open', () => {
    expect(actionFor(exercise({ status: 'in_progress', openAttemptId: 'attempt-1' }))).toBe('resume')
  })

  // The distinction that matters: an attempt submitted but not passed leaves the
  // exercise in progress with nothing to resume. Saying "Resume" there would
  // promise to reopen a board that has already been handed in.
  it('starts a new attempt when one was submitted without passing', () => {
    expect(actionFor(exercise({ status: 'in_progress', openAttemptId: null }))).toBe('start')
  })

  it('reviews a completed exercise', () => {
    expect(actionFor(exercise({ status: 'completed' }))).toBe('review')
  })

  it('starts an untouched one', () => {
    expect(actionFor(exercise({ status: 'not_started' }))).toBe('start')
  })

  // A completed exercise that was reopened is a resume, not a review: the open
  // attempt is the more specific fact.
  it('prefers an open attempt over the completed status', () => {
    expect(actionFor(exercise({ status: 'completed', openAttemptId: 'attempt-2' }))).toBe('resume')
  })
})

/* -------------------------------------------------------------------------- */
/* Per class                                                                  */
/* -------------------------------------------------------------------------- */

describe('classProgress', () => {
  it('counts only the exercises belonging to that class', () => {
    const list = [
      exercise({ classId: CLASS_A, status: 'completed' }),
      exercise({ classId: CLASS_A, status: 'not_started' }),
      exercise({ classId: CLASS_B, status: 'completed' }),
    ]

    expect(classProgress(list, CLASS_A)).toEqual({ assigned: 2, completed: 1 })
    expect(classProgress(list, CLASS_B)).toEqual({ assigned: 1, completed: 1 })
  })

  // `classId: null` is the shared library — it belongs to no class, and must not
  // be counted into whichever card happens to be rendered first.
  it('excludes the shared library from every class', () => {
    const list = [exercise({ classId: null, status: 'completed' }), exercise({ classId: CLASS_A })]

    expect(classProgress(list, CLASS_A)).toEqual({ assigned: 1, completed: 0 })
  })

  it('is zero for a class with nothing published', () => {
    expect(classProgress([exercise({ classId: CLASS_A })], CLASS_B)).toEqual({
      assigned: 0,
      completed: 0,
    })
  })
})

/* -------------------------------------------------------------------------- */
/* Dates                                                                      */
/* -------------------------------------------------------------------------- */

describe('formatDay', () => {
  const now = new Date('2026-08-28T09:00:00.000Z')

  it('omits the year while it is still obvious', () => {
    const formatted = formatDay('2026-08-12T10:00:00.000Z', 'en', now)
    expect(formatted).toBeTruthy()
    expect(formatted).not.toContain('2026')
  })

  it('names the year once the date is not this one', () => {
    expect(formatDay('2025-11-03T10:00:00.000Z', 'en', now)).toContain('2025')
  })

  it('formats in both catalogues', () => {
    expect(formatDay('2026-08-12T10:00:00.000Z', 'fil', now)).toBeTruthy()
  })

  // The caller drops the whole line rather than rendering "Invalid Date", which
  // is what `new Date('nonsense').toLocaleDateString()` would put on the screen.
  it('is null for a timestamp it cannot read', () => {
    expect(formatDay('not a date', 'en', now)).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/* Names                                                                      */
/* -------------------------------------------------------------------------- */

describe('firstName', () => {
  it('drops an academic title', () => {
    expect(firstName('Prof. Amelia Reyes')).toBe('Amelia')
    expect(firstName('Engr. Mateo Cruz')).toBe('Mateo')
  })

  it('takes the first word of an ordinary name', () => {
    expect(firstName('Mateo Cruz')).toBe('Mateo')
  })

  it('survives a blank name rather than greeting nobody', () => {
    expect(firstName('')).toBe('')
    expect(firstName('   ')).toBe('')
  })

  // Filtering every word away would leave the greeting addressed to nobody, so
  // the whole name comes back instead. "Hello, Dr." is odd; "Hello, " is broken.
  it('falls back to the whole name when the title is all there is', () => {
    expect(firstName('Dr.')).toBe('Dr.')
  })
})

/* -------------------------------------------------------------------------- */
/* Searching                                                                  */
/* -------------------------------------------------------------------------- */

describe('filterLibrary', () => {
  const list = [
    exercise({ title: 'Series LED with current-limiting resistor' }),
    exercise({ title: 'RC low-pass filter' }),
    exercise({ title: 'Astable blinker' }),
  ]

  // The field sits above a list the screen promises is complete. An empty query
  // returning nothing would break that promise on first render.
  it('returns everything for an empty or blank query', () => {
    expect(filterLibrary(list, '')).toHaveLength(3)
    expect(filterLibrary(list, '   ')).toHaveLength(3)
  })

  it('matches a substring of the title, whatever the case', () => {
    expect(filterLibrary(list, 'LED').map((item) => item.title)).toEqual([
      'Series LED with current-limiting resistor',
    ])
    expect(filterLibrary(list, 'blink')).toHaveLength(1)
  })

  it('matches the objective as well as the title', () => {
    const withObjective = { ...list[1]!, objective: 'Smooth a square wave with a capacitor' }
    expect(filterLibrary([withObjective], 'capacitor')).toHaveLength(1)
  })

  it('is empty rather than everything when nothing matches', () => {
    expect(filterLibrary(list, 'oscilloscope')).toHaveLength(0)
  })

  // A filter that mutated the array it was handed would reorder the library
  // itself, which is sorted by `orderForLibrary` and must stay that way.
  it('leaves the input alone', () => {
    const before = list.map((item) => item.title)
    filterLibrary(list, 'led')
    expect(list.map((item) => item.title)).toEqual(before)
  })
})

/* -------------------------------------------------------------------------- */
/* Activity                                                                   */
/* -------------------------------------------------------------------------- */

describe('groupActivity', () => {
  const now = new Date('2026-08-28T09:00:00.000Z')

  it('drops anything never attempted', () => {
    const days = groupActivity([exercise({ lastAttemptAt: null })], 'en', 6, now)
    expect(days).toEqual([])
  })

  it('puts the newest attempt first', () => {
    const days = groupActivity(
      [
        exercise({ title: 'older', lastAttemptAt: '2026-08-20T02:00:00.000Z' }),
        exercise({ title: 'newer', lastAttemptAt: '2026-08-26T02:00:00.000Z' }),
      ],
      'en',
      6,
      now,
    )

    expect(days.map((day) => day.entries.map((entry) => entry.exercise.title))).toEqual([
      ['newer'],
      ['older'],
    ])
  })

  it('gathers attempts made on the same day under one heading', () => {
    const days = groupActivity(
      [
        exercise({ title: 'morning', lastAttemptAt: '2026-08-26T06:00:00.000Z' }),
        exercise({ title: 'afternoon', lastAttemptAt: '2026-08-26T07:00:00.000Z' }),
      ],
      'en',
      6,
      now,
    )

    expect(days).toHaveLength(1)
    expect(days[0]!.entries.map((entry) => entry.exercise.title)).toEqual(['afternoon', 'morning'])
    expect(days[0]!.label).toBeTruthy()
  })

  // The rail is a rail. Six is about as far as anyone scrolls one, and an
  // uncapped list would grow with the course.
  it('keeps only the most recent `limit` entries', () => {
    const list = Array.from({ length: 9 }, (_, index) =>
      exercise({ lastAttemptAt: `2026-08-${String(index + 10).padStart(2, '0')}T02:00:00.000Z` }),
    )

    const entries = groupActivity(list, 'en', 4, now).flatMap((day) => day.entries)
    expect(entries).toHaveLength(4)
    expect(entries[0]!.at.getTime()).toBeGreaterThan(entries[3]!.at.getTime())
  })

  it('ignores a timestamp it cannot read rather than sorting NaN to the top', () => {
    const days = groupActivity(
      [
        exercise({ title: 'broken', lastAttemptAt: 'not a date' }),
        exercise({ title: 'real', lastAttemptAt: '2026-08-26T02:00:00.000Z' }),
      ],
      'en',
      6,
      now,
    )

    expect(days.flatMap((day) => day.entries.map((entry) => entry.exercise.title))).toEqual(['real'])
  })

  it('carries a clock reading for every entry', () => {
    const days = groupActivity([exercise({ lastAttemptAt: '2026-08-26T02:00:00.000Z' })], 'en', 6, now)
    expect(days[0]!.entries[0]!.time).toMatch(/^\d{2}:\d{2}$/)
  })
})

describe('formatClock and formatToday', () => {
  // Twenty-four hour in both catalogues, because a lab timetable is. `h23`
  // rather than `hour12: false`, which yields a 24 o'clock at midnight.
  it('reads the clock without an am/pm', () => {
    const time = formatClock(new Date('2026-08-26T13:20:00.000Z'), 'en')
    expect(time).toMatch(/^\d{2}:\d{2}$/)
  })

  it('names the weekday, the day, the month and the year', () => {
    const today = formatToday(new Date('2026-09-04T09:00:00.000Z'), 'en')
    expect(today).toContain('2026')
    expect(today.length).toBeGreaterThan('4 September'.length)
  })

  it('formats in both catalogues', () => {
    expect(formatToday(new Date('2026-09-04T09:00:00.000Z'), 'fil')).toBeTruthy()
    expect(formatClock(new Date('2026-09-04T09:00:00.000Z'), 'fil')).toBeTruthy()
  })
})
