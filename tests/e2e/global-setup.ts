import { existsSync, mkdirSync, rmSync } from 'node:fs'

/**
 * Clears the outbox before the suite runs, and nothing else.
 *
 * ---------------------------------------------------------------------------
 * WHY THE DATABASE IS NOT SET UP HERE
 *
 * Playwright starts its `webServer` entries **before** `globalSetup`. PGlite is a
 * single-writer database, so by the time this file runs the API already holds
 * the lock on `./.pglite` — and `drizzle-kit migrate` from here opens a second
 * instance against the same directory. That does not fail loudly. It corrupts
 * the cluster, and the symptom is every sign-in in the suite failing at once,
 * which reads as an auth bug.
 *
 * So migrating and seeding is the `test:e2e` npm script's job, sequenced ahead of
 * `playwright test` where no server exists yet.
 * ---------------------------------------------------------------------------
 */
export default function globalSetup(): void {
  const outbox = new URL('../../.e2e-outbox/', import.meta.url)

  // Cleared on the way in, not out, so a failed run's messages are still there
  // to read afterwards.
  if (existsSync(outbox)) rmSync(outbox, { recursive: true, force: true })
  mkdirSync(outbox, { recursive: true })
}
