import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Where the per-test-file Postgres clusters live. Outside the repo, so a test
 * run can never touch the development database in `./.pglite` — and under one
 * parent, so `globalSetup` has a single place to sweep.
 */
export const TEST_CLUSTER_ROOT = join(tmpdir(), 'breadboard-trainer-tests')
