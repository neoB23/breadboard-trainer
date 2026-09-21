import type { AssignedExercise, ExerciseStatus, Locale } from '@shared/contracts'

/**
 * Everything the dashboard *decides*, with none of the rendering.
 *
 * Split out of `dashboard-page.tsx` so it can be tested without a DOM. The
 * ordering rule below is the kind of thing that is obviously right when written
 * and quietly wrong six months later — "why is the finished one at the top" is a
 * bug report nobody files, they just stop trusting the screen. A unit test is
 * cheaper than that.
 *
 * Nothing here invents a figure. Every function is a projection of what
 * `GET /api/exercises` and `GET /api/classes` already returned.
 */

/* -------------------------------------------------------------------------- */
/* Counting                                                                   */
/* -------------------------------------------------------------------------- */

export interface Totals {
  assigned: number
  notStarted: number
  inProgress: number
  completed: number
}

export function tally(exercises: readonly AssignedExercise[]): Totals {
  const count = (status: ExerciseStatus) =>
    exercises.filter((exercise) => exercise.progress.status === status).length

  return {
    assigned: exercises.length,
    notStarted: count('not_started'),
    inProgress: count('in_progress'),
    completed: count('completed'),
  }
}

/** 0–1, and 0 rather than NaN when nothing is assigned. */
export function completionRatio(totals: Totals): number {
  return totals.assigned === 0 ? 0 : totals.completed / totals.assigned
}

/* -------------------------------------------------------------------------- */
/* Ordering                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Which exercise to put at the top.
 *
 * Something already open wins — finishing a started attempt beats starting a new
 * one — then the easiest not-yet-started, which is the order the library already
 * arrives in. A completed exercise is never "up next": there is nothing to do.
 */
export function pickNext(exercises: readonly AssignedExercise[]): AssignedExercise | null {
  return (
    exercises.find((exercise) => exercise.progress.status === 'in_progress') ??
    exercises.find((exercise) => exercise.progress.status === 'not_started') ??
    null
  )
}

/**
 * What is left to do, then what has not been touched, then what is finished.
 *
 * The API sorts by difficulty and that order is kept *within* each group, which
 * is why this is a stable sort on a rank rather than a comparator that also
 * looks at difficulty. Two sources of truth for the same ordering is how the
 * list ends up disagreeing with itself when the server's sort changes.
 */
const STATUS_RANK: Record<ExerciseStatus, number> = { in_progress: 0, not_started: 1, completed: 2 }

export function orderForLibrary(exercises: readonly AssignedExercise[]): AssignedExercise[] {
  return exercises.slice().sort((a, b) => STATUS_RANK[a.progress.status] - STATUS_RANK[b.progress.status])
}

/**
 * The three shapes the row's button takes. `resume` is not the same as
 * `in_progress`: an attempt that was submitted but not passed leaves the
 * exercise in progress with nothing to resume, so the button has to say "Start"
 * and open a new attempt.
 */
export type ExerciseAction = 'start' | 'resume' | 'review'

export function actionFor(exercise: AssignedExercise): ExerciseAction {
  if (exercise.progress.openAttemptId !== null) return 'resume'
  return exercise.progress.status === 'completed' ? 'review' : 'start'
}

/* -------------------------------------------------------------------------- */
/* Per class                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * How far this student is through one class's exercises.
 *
 * Counted from the exercise list rather than read from `ClassSummary`, which
 * carries `exerciseCount` but knows nothing about *this* student's attempts.
 * Deriving both halves from the same array is what stops a card reading
 * "3 of 6" beside a list holding five.
 */
export function classProgress(
  exercises: readonly AssignedExercise[],
  classId: string,
): { assigned: number; completed: number } {
  const mine = exercises.filter((exercise) => exercise.classId === classId)
  return {
    assigned: mine.length,
    completed: mine.filter((exercise) => exercise.progress.status === 'completed').length,
  }
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                      */
/* -------------------------------------------------------------------------- */

/** BCP-47 tags for the two catalogues. Both are Philippine, and the app is not. */
const INTL_TAG: Record<Locale, string> = { en: 'en-PH', fil: 'fil-PH' }

/**
 * "12 Aug", or "12 Aug 2025" once the year stops being obvious.
 *
 * No relative time. "3 days ago" needs a plural rule per language and a decision
 * about what happens at 25 hours, and this app deliberately has no plural
 * machinery — see the note in `src/i18n/index.ts`. A date is unambiguous in both
 * catalogues and costs nothing.
 *
 * `now` is a parameter so the year rule can be tested without touching the
 * clock. Returns null for an unparseable timestamp rather than "Invalid Date",
 * and the caller drops the line.
 */
export function formatDay(iso: string, locale: Locale, now: Date = new Date()): string | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null

  const sameYear = date.getFullYear() === now.getFullYear()
  return new Intl.DateTimeFormat(INTL_TAG[locale], {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date)
}

/* -------------------------------------------------------------------------- */
/* Names                                                                      */
/* -------------------------------------------------------------------------- */

/** "Prof. Amelia Reyes" -> "Amelia". Mirrors the greeting in the emails. */
export function firstName(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter((part) => !/^(prof\.?|dr\.?|engr\.?|mr\.?|ms\.?|mrs\.?)$/i.test(part))
  return parts[0] ?? fullName.trim()
}

/* -------------------------------------------------------------------------- */
/* Searching                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The library, narrowed to what the student typed.
 *
 * Title and objective, case-folded, substring — no fuzzy matching and no
 * ranking. A student searching their own six-to-twenty exercises knows roughly
 * what the thing is called, and a fuzzy matcher's reward for that is a list
 * that also contains four things they did not ask for.
 *
 * An empty or whitespace query returns the list unchanged rather than an empty
 * one, which is what makes the field safe to render above a list that must
 * always be complete.
 */
export function filterLibrary(exercises: readonly AssignedExercise[], query: string): AssignedExercise[] {
  const needle = query.trim().toLocaleLowerCase()
  if (needle === '') return exercises.slice()

  return exercises.filter((exercise) => {
    const haystack = `${exercise.title} ${exercise.objective ?? ''}`.toLocaleLowerCase()
    return haystack.includes(needle)
  })
}

/* -------------------------------------------------------------------------- */
/* Activity                                                                   */
/* -------------------------------------------------------------------------- */

export interface ActivityEntry {
  exercise: AssignedExercise
  /** The attempt timestamp, already parsed — the caller sorts on nothing else. */
  at: Date
  /** "13:20", in the reader's locale. */
  time: string
}

export interface ActivityDay {
  /** Stable per calendar day, for a React key that is not an array index. */
  key: string
  /** "12 Aug", or "12 Aug 2025" once the year stops being obvious. */
  label: string
  entries: ActivityEntry[]
}

/**
 * The last few times this student opened something, newest first, grouped by
 * the day it happened on.
 *
 * This is the one section of the dashboard that is *not* a to-do list, and it
 * is built entirely from `progress.lastAttemptAt` — a field the API already
 * returns for every exercise. There is no attempt history endpoint, so there is
 * no attempt history here: one entry per exercise, being the last time it was
 * touched. Rendering it as a stream of every attempt would be inventing rows.
 *
 * `limit` exists because the rail it renders into is a rail, not a page. Six
 * entries is roughly a fortnight of ordinary use and about as far as anyone
 * scrolls a sidebar.
 */
export function groupActivity(
  exercises: readonly AssignedExercise[],
  locale: Locale,
  limit = 6,
  now: Date = new Date(),
): ActivityDay[] {
  const entries = exercises
    .flatMap((exercise) => {
      const iso = exercise.progress.lastAttemptAt
      if (iso === null) return []
      const at = new Date(iso)
      if (Number.isNaN(at.getTime())) return []
      return [{ exercise, at, time: formatClock(at, locale) }]
    })
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit)

  const days: ActivityDay[] = []
  for (const entry of entries) {
    // The local calendar day, not the UTC one: "yesterday evening" must not
    // land under today's heading because the timestamp crossed midnight in
    // Greenwich.
    const key = `${entry.at.getFullYear()}-${entry.at.getMonth()}-${entry.at.getDate()}`
    const last = days.at(-1)
    if (last && last.key === key) {
      last.entries.push(entry)
    } else {
      days.push({ key, label: formatDay(entry.at.toISOString(), locale, now) ?? '', entries: [entry] })
    }
  }

  return days
}

/** "13:20". Twenty-four hour in both catalogues, because a lab timetable is. */
export function formatClock(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_TAG[locale], {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

/** "Thursday, 4 September 2026" — the line under the greeting, and nothing else. */
export function formatToday(now: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_TAG[locale], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now)
}
