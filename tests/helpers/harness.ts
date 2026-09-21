import { eq } from 'drizzle-orm'

import { app } from '../../api/app.ts'
import { db } from '../../api/db/client.ts'
import { attempts, exercises } from '../../api/db/schema.ts'
import { seed, SEED } from '../../api/db/seed.ts'
import { loadSessionForUser, setSessionProvider } from '../../api/middleware/session.ts'

/**
 * The real Hono app, driven over `app.request()` against the real migrated
 * database. Nothing is stubbed except the one thing Phase 2 has not built yet:
 * where a session comes from.
 *
 * The session provider installed here is the same seam Better Auth takes over
 * in Phase 3 — it reads an id from a header and looks up a genuine `profiles`
 * row, so role and identity in every test below come from the database, not
 * from a fixture object. An unknown id resolves to null, which is 401, exactly
 * as it will in production.
 */

export const TEST_USER_HEADER = 'x-test-user'

setSessionProvider(async (c) => {
  const userId = c.req.header(TEST_USER_HEADER)?.trim()
  if (!userId) return null
  return loadSessionForUser(userId)
})

export { SEED }

export const CRUZ = SEED.students[0]
export const SANTOS = SEED.students[1]
export const DIZON = SEED.students[2]
export const INSTRUCTOR = SEED.instructor

export interface CallOptions {
  method?: string
  as?: string | undefined
  body?: unknown
}

export interface Reply {
  status: number
  body: unknown
}

/** One request through the whole middleware chain, as a caller would make it. */
export async function call(path: string, options: CallOptions = {}): Promise<Reply> {
  const headers = new Headers()
  if (options.as !== undefined) headers.set(TEST_USER_HEADER, options.as)
  if (options.body !== undefined) headers.set('content-type', 'application/json')

  const res = await app.request(path, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
  })

  const text = await res.text()
  let body: unknown = text
  try {
    body = JSON.parse(text)
  } catch {
    // Left as the raw text; only the status matters for a non-JSON failure.
  }

  return { status: res.status, body }
}

let seeded = false

/** Idempotent, and cheap after the first call — the seed itself is upserts. */
export async function seedOnce(): Promise<void> {
  if (seeded) return
  await seed({ quiet: true })
  seeded = true
}

/**
 * An attempt owned by someone other than the caller under test. Inserted
 * directly rather than through `POST /api/attempts`, because the point is to
 * test the read guard, not to depend on the write path being correct.
 */
export async function createAttemptFor(studentId: string, exerciseId: string): Promise<string> {
  const [row] = await db.insert(attempts).values({ studentId, exerciseId }).returning({ id: attempts.id })
  if (!row) throw new Error('test fixture: attempt insert did not read back')
  return row.id
}

/** Proves the fixture is what the test thinks it is before asserting on it. */
export async function exerciseFixture(id: string): Promise<{
  published: boolean
  hasGoldenNetlist: boolean
  classId: string | null
}> {
  const [row] = await db
    .select({
      published: exercises.published,
      goldenNetlist: exercises.goldenNetlist,
      classId: exercises.classId,
    })
    .from(exercises)
    .where(eq(exercises.id, id))
    .limit(1)

  if (!row) throw new Error(`test fixture: exercise ${id} is missing`)
  return {
    published: row.published,
    hasGoldenNetlist: row.goldenNetlist !== null,
    classId: row.classId,
  }
}
