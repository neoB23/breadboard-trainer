import 'dotenv/config'

import { defineConfig } from 'drizzle-kit'

/**
 * drizzle-kit's view of the world. It mirrors api/db/client.ts: the same schema,
 * the same two drivers, chosen the same way — except that where the runtime
 * client wants the POOLED Neon string, drizzle-kit wants the DIRECT one.
 *
 * That is not a preference. Migrations run DDL inside a session-level
 * connection, and Neon's pooler in transaction mode will not hold one. Pointing
 * drizzle-kit at the pooled string produces confusing mid-migration failures;
 * pointing the runtime at the direct string works perfectly right up until a
 * full lab section exhausts the connection limit.
 *
 * With neither string set — the current state, no Neon project provisioned —
 * this falls through to PGlite against ./.pglite, so `generate`, `migrate`,
 * `push` and `studio` all work locally against a real Postgres 16. Relative to
 * the repo root, which is where drizzle-kit must be run from for that path to
 * line up with the one api/db/client.ts resolves.
 */

const shared = {
  schema: './api/db/schema.ts',
  out: './api/db/migrations',
  /** Prompt before anything destructive; print the SQL being applied. */
  strict: true,
  verbose: true,
} as const

const directUrl = process.env['DATABASE_URL_DIRECT']?.trim()
const pooledUrl = process.env['DATABASE_URL']?.trim()

if (!directUrl && pooledUrl) {
  console.warn(
    '[drizzle-kit] DATABASE_URL_DIRECT is not set — falling back to DATABASE_URL. ' +
      'If that is the pooled string (host contains "-pooler"), migrations may fail: ' +
      'drizzle-kit needs the direct one.',
  )
}

const migrationUrl = directUrl ?? pooledUrl

export default defineConfig(
  migrationUrl
    ? {
        ...shared,
        dialect: 'postgresql',
        dbCredentials: { url: migrationUrl },
      }
    : {
        ...shared,
        dialect: 'postgresql',
        driver: 'pglite',
        // Mirrors the same override in api/db/client.ts, so a throwaway test
        // database can be migrated with the committed migration files.
        dbCredentials: { url: process.env['PGLITE_DATA_DIR']?.trim() || './.pglite' },
      },
)
