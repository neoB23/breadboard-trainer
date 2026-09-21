import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { TEST_CLUSTER_ROOT } from './paths.ts'

/**
 * Sweeps the temporary Postgres clusters that earlier runs left behind.
 *
 * This has to be `globalSetup` rather than `setupFiles`. Each cluster is a live
 * PGlite data directory for as long as its test file is running, and test files
 * run concurrently — a sweep inside `setupFiles` deletes files out from under a
 * sibling worker's running database, which hangs the run rather than failing it.
 * `globalSetup` runs exactly once, before any worker exists, so everything it
 * finds is genuinely stale.
 *
 * Why the clusters are not deleted at the end instead: `api/db/client.ts` never
 * closes its PGlite instance, so the WASM runtime still holds file handles when
 * the process exits and Windows refuses the unlink. Cleaning up on the way in is
 * the only point at which the directories are reliably free.
 */
export default function setup(): void {
  mkdirSync(TEST_CLUSTER_ROOT, { recursive: true })

  for (const entry of readdirSync(TEST_CLUSTER_ROOT)) {
    try {
      rmSync(join(TEST_CLUSTER_ROOT, entry), { recursive: true, force: true })
    } catch {
      // A handle survived the process that made it. It will go next run.
    }
  }
}
