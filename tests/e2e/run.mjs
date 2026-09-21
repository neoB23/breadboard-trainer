import { spawnSync } from 'node:child_process'

/**
 * The e2e entry point: migrate, seed, then Playwright — all against the
 * suite's own PGlite cluster.
 *
 * ---------------------------------------------------------------------------
 * WHY THE SUITE HAS ITS OWN DATABASE AND ITS OWN PORTS
 *
 * PGlite takes exactly one writer. When the suite shared `./.pglite` and ports
 * 5173/3001 with `npm run dev`, a developer's running dev pair got silently
 * reused by Playwright's `reuseExistingServer` — an API with the wrong env (no
 * outbox, real rate limits), a cluster with two writers, and a database whose
 * state the developer was mutating by hand mid-run. Every one of those
 * produced failures that looked like product bugs.
 *
 * So the suite lives at `.pglite-e2e` and ports 5273/3101 (see
 * playwright.config.ts), and this wrapper exists because the env var has to
 * reach three different child processes — drizzle-kit, the seed, and
 * Playwright — and npm scripts cannot set one cross-platform without another
 * dependency.
 * ---------------------------------------------------------------------------
 */

const env = { ...process.env, PGLITE_DATA_DIR: '.pglite-e2e' }
// The suite must never think it is talking to Neon.
delete env.DATABASE_URL
delete env.DATABASE_URL_DIRECT

const steps = [
  ['npx drizzle-kit migrate', []],
  ['npx tsx api/db/seed.ts --quiet', []],
  ['npx playwright test', process.argv.slice(2)],
]

for (const [command, extra] of steps) {
  const full = [command, ...extra].join(' ')
  const result = spawnSync(full, { stdio: 'inherit', env, shell: true })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
