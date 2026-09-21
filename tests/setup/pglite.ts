import { mkdirSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'

import { TEST_CLUSTER_ROOT } from './paths.ts'

/**
 * A fresh, migrated database per test file.
 *
 * Runs before the test file's own imports, which is what lets it set
 * `PGLITE_DATA_DIR` in time for `api/db/client.ts` to pick it up at module
 * scope. The instance opened here is closed again before the tests run, because
 * a PGlite data directory takes exactly one writer and `api/db/client.ts` is
 * about to become it.
 *
 * The schema comes from `api/db/migrations`, not from `drizzle-kit push` and not
 * from the schema module — so a migration that does not actually apply fails the
 * whole suite rather than passing against a schema pushed straight from source.
 *
 * The directory is unique per file because test files run concurrently and each
 * cluster takes one writer. Deleting them is `tests/setup/global.ts`'s job, on
 * the way into the next run; see the note there for why not on the way out.
 */

mkdirSync(TEST_CLUSTER_ROOT, { recursive: true })

const dataDir = mkdtempSync(join(TEST_CLUSTER_ROOT, 'db-'))
process.env['PGLITE_DATA_DIR'] = dataDir

// The API must never think it is talking to Neon during a test.
delete process.env['DATABASE_URL']
delete process.env['DATABASE_URL_DIRECT']

const migrationsFolder = fileURLToPath(new URL('../../api/db/migrations', import.meta.url))

const client = new PGlite(dataDir)
await migrate(drizzle(client), { migrationsFolder })
await client.close()
