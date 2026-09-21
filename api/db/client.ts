import { fileURLToPath } from 'node:url'

import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

import * as schema from './schema.ts'

/**
 * The database handle. One export, two drivers, and nothing downstream is
 * allowed to care which one it got.
 *
 *   DATABASE_URL set   -> Neon over HTTP (@neondatabase/serverless).
 *   DATABASE_URL unset -> PGlite, a real Postgres 16 compiled to WASM, writing
 *                         to ./.pglite in the repo root.
 *
 * PGlite is not a mock or an in-memory shim — it is the actual Postgres engine,
 * so check constraints, `gen_random_uuid()`, jsonb and cascade semantics all
 * behave exactly as they will on Neon. That is what makes it safe to develop and
 * run the whole test suite against it while no Neon project exists yet.
 *
 * ---------------------------------------------------------------------------
 * POOLED vs DIRECT — get this backwards and it works locally, then falls over
 * during a lab section.
 *
 *   DATABASE_URL        the POOLED string (host contains `-pooler`). Used here,
 *                       at runtime. Each serverless invocation opens its own
 *                       connection; 35 students on the app at once will exhaust
 *                       Neon's direct connection limit without the pooler in
 *                       front.
 *   DATABASE_URL_DIRECT the DIRECT string (no `-pooler`). Used only by
 *                       drizzle-kit, whose migrations need a session-level
 *                       connection that PgBouncer in transaction mode will not
 *                       give. See drizzle.config.ts.
 *
 * Neither string may ever reach the browser. The API is the entire security
 * boundary in this architecture; there is no client-side database access and no
 * RLS-as-a-service to fall back on.
 * ---------------------------------------------------------------------------
 */

const connectionString = process.env['DATABASE_URL']?.trim()

/**
 * Repo-root ./.pglite, resolved from this file so cwd never matters — vitest,
 * tsx and drizzle-kit all run from different ones.
 *
 * `PGLITE_DATA_DIR` overrides it so the test suite can point at a throwaway
 * directory. A PGlite data directory is a single-writer lock, so tests sharing
 * the development database would both corrupt it and refuse to open it while
 * `npm run dev:api` is running.
 */
const pgliteDataDir =
  process.env['PGLITE_DATA_DIR']?.trim() || fileURLToPath(new URL('../../.pglite/', import.meta.url))

/**
 * The narrowest type both drivers satisfy. Deliberately not `NeonHttpDatabase`:
 * that would advertise `.batch()`, which PGlite does not implement, and the
 * failure would only show up at runtime on whichever driver was not being used
 * that day. Everything the app actually needs — select, insert, update, delete,
 * transactions, `db.query` — lives on this base class.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>

async function createDb(): Promise<Database> {
  if (connectionString) {
    warnIfNotPooled(connectionString)
    // Imported dynamically so the PGlite WASM payload is never pulled into the
    // deployed function, and so a production-only install (no devDependencies)
    // still boots.
    const { drizzle } = await import('drizzle-orm/neon-http')
    return drizzle(connectionString, { schema })
  }

  const { drizzle } = await import('drizzle-orm/pglite')
  return drizzle({ connection: { dataDir: pgliteDataDir }, schema })
}

export const db: Database = await createDb()

/**
 * Whether `db.transaction()` actually works on the driver this process got.
 *
 * PGlite is a real Postgres session, so it does. Drizzle's neon-http driver has
 * no transaction support at all — `db.transaction()` throws — because HTTP
 * requests to Neon are one statement at a time with no session to hold `BEGIN`
 * open. The `Database` type advertises the method on both, so this is the only
 * way to know before calling it.
 *
 * One place cares: registration, which must create an auth user and a profile
 * row together (Phase 3 task 5). Where there is no transaction it falls back to
 * writing them in order and deleting the user if the profile fails — the delete
 * cascades, so the compensating path lands on the same end state. See
 * `api/auth/registration.ts`.
 */
export const supportsTransactions: boolean = !connectionString

export { schema }
export type * from './schema.ts'

/**
 * The pooled/direct mix-up is silent: the direct string connects fine and only
 * fails under concurrency, by which point a class is already sitting in the lab.
 * Cheap to catch here, expensive to diagnose later.
 */
function warnIfNotPooled(url: string): void {
  if (url.includes('neon.tech') && !url.includes('-pooler')) {
    console.warn(
      '[db] DATABASE_URL looks like a Neon DIRECT string (no "-pooler" in the host). ' +
        'Runtime must use the POOLED string; the direct one belongs in DATABASE_URL_DIRECT ' +
        'for drizzle-kit only.',
    )
  }
}
