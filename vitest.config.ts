import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

/**
 * The suite is API-only for now: every test drives the real Hono app against a
 * real Postgres (PGlite) that was migrated from the committed migration files.
 * Nothing here is mocked, because the thing under test is an authorisation
 * boundary and a mocked boundary proves nothing.
 *
 * `setupFiles` runs once per test file, before that file's imports are
 * evaluated, and gives each file its own throwaway data directory. That
 * ordering is load-bearing: `api/db/client.ts` reads `PGLITE_DATA_DIR` at module
 * scope, so the variable has to be set before anything imports it.
 *
 * `pool: 'forks'` because each worker holds an open PGlite instance — a WASM
 * runtime with native file handles — and a fresh process per file is the only
 * way to be sure the previous one released its lock.
 */
export default defineConfig({
  /**
   * The same two aliases `vite.config.ts` sets. Not duplication for its own
   * sake: a pure module under `src/` — the dashboard's ordering rules, say — is
   * worth testing here, and it imports the contracts by the alias the rest of
   * the client uses. Without this the import resolves in the browser and not in
   * the test runner, which is the least useful place for the two to disagree.
   */
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // Sweeps stale clusters once, before any worker exists. Doing it per file
    // would delete a sibling worker's live database mid-run.
    globalSetup: ['tests/setup/global.ts'],
    setupFiles: ['tests/setup/pglite.ts'],
    pool: 'forks',
    // PGlite boots a WASM Postgres and replays every migration per file.
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
})
