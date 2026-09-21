import { eq, sql, type SQL } from 'drizzle-orm'
import { randomInt } from 'node:crypto'

import { JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH, type ClassSummary } from '../../shared/contracts/index.ts'
import { db } from '../db/client.ts'
import { classes, enrollments, exercises, profiles } from '../db/schema.ts'
import { toClassSummary } from './serializers.ts'

/**
 * Class reads and the join-code generator, shared by the student routes and the
 * instructor ones so a class card is assembled the same way on both sides.
 */

export interface ClassSummaryOptions {
  /**
   * Students count only what they can open. An instructor sees the true total,
   * drafts included — otherwise their own exercise list and their class card
   * disagree about how many exercises exist.
   */
  publishedExercisesOnly: boolean
}

/**
 * `studentCount` and `exerciseCount` are correlated subqueries rather than
 * stored counters or a GROUP BY over two joins. Stored counters drift; two
 * joins multiply each other's rows and quietly give every class
 * `students × exercises` for both numbers.
 *
 * The `::int` cast matters: Postgres `count(*)` is `bigint`, which both drivers
 * hand back as a string, and `studentCount` is typed `number` on the wire.
 */
export async function classSummaries(
  where: SQL | undefined,
  options: ClassSummaryOptions,
): Promise<ClassSummary[]> {
  const publishedOnly = options.publishedExercisesOnly ? sql` and ${exercises.published}` : sql.empty()

  const rows = await db
    .select({
      id: classes.id,
      instructorId: classes.instructorId,
      name: classes.name,
      code: classes.code,
      term: classes.term,
      archived: classes.archived,
      createdAt: classes.createdAt,
      instructorName: profiles.fullName,
      studentCount: sql<number>`(
        select count(*)::int from ${enrollments} where ${enrollments.classId} = ${classes.id}
      )`.mapWith(Number),
      exerciseCount: sql<number>`(
        select count(*)::int from ${exercises} where ${exercises.classId} = ${classes.id}${publishedOnly}
      )`.mapWith(Number),
    })
    .from(classes)
    .innerJoin(profiles, eq(profiles.id, classes.instructorId))
    .where(where)
    .orderBy(classes.name)

  return rows.map(toClassSummary)
}

/** One class, or undefined. Same projection as the list so the shapes cannot drift. */
export async function classSummary(
  classId: string,
  options: ClassSummaryOptions,
): Promise<ClassSummary | undefined> {
  const [row] = await classSummaries(eq(classes.id, classId), options)
  return row
}

/* -------------------------------------------------------------------------- */
/* Join codes                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Drawn from `JOIN_CODE_ALPHABET`, which has no O/0 and no I/1/L — these get
 * read off a whiteboard and typed on a phone. The generator must use that exact
 * string, or it will mint codes that `joinCodeInputSchema` rejects.
 *
 * `randomInt` rather than `Math.random`: this is a bearer token for class
 * membership, and 31^6 is small enough that a predictable sequence is worth
 * avoiding for free.
 */
export function generateJoinCode(): string {
  let code = ''
  for (let i = 0; i < JOIN_CODE_LENGTH; i += 1) {
    // charAt, not [], because noUncheckedIndexedAccess types the latter as
    // possibly undefined and the index here is bounded by construction.
    code += JOIN_CODE_ALPHABET.charAt(randomInt(JOIN_CODE_ALPHABET.length))
  }
  return code
}

/**
 * 31^6 is about 887 million, so a collision is rare but not impossible, and the
 * check-then-insert version has a race that only shows up when two instructors
 * create a class in the same second. Insert, catch the unique violation, retry.
 */
export async function withUniqueJoinCode<T>(insert: (code: string) => Promise<T>): Promise<T> {
  const attempts = 5

  for (let i = 0; i < attempts; i += 1) {
    try {
      return await insert(generateJoinCode())
    } catch (err) {
      if (!isJoinCodeCollision(err)) throw err
    }
  }

  throw new Error(`Could not mint a unique join code in ${attempts} attempts`)
}

/**
 * Postgres 23505 is unique_violation. The constraint name is checked too:
 * `classes` has exactly one unique constraint today, but a future one would
 * otherwise be retried five times and then reported as a code collision.
 */
function isJoinCodeCollision(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const candidate = err as { code?: unknown; constraint?: unknown; message?: unknown }

  if (candidate.code !== '23505') return false
  if (typeof candidate.constraint === 'string') return candidate.constraint === 'classes_code_unique'
  return typeof candidate.message === 'string' && candidate.message.includes('classes_code_unique')
}
