import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * Phase 2 DoD: "No Neon connection string exists anywhere in `src/` — grep the
 * bundle to confirm."
 *
 * Two scans, and they prove different things.
 *
 *   SOURCE  `src/` and `shared/` are scanned unconditionally. This is the scan
 *           that cannot rot: it holds whether or not a screen imports the API
 *           client yet, and it fails the moment someone pastes a connection
 *           string into a component.
 *
 *   BUNDLE  `dist/` is scanned only when it exists, because building inside the
 *           test run would put a 30-second Vite build in front of every `npm
 *           test`. `npm run verify` builds first and then runs this, which is
 *           the form CI should use.
 *
 * Read the bundle result with one caveat in mind: today it is a weaker proof
 * than it looks, because no screen imports `src/lib/api.ts` yet, so most of the
 * client's API surface is tree-shaken out of `dist/` entirely. It becomes a real
 * check from Phase 3 onward, which is exactly why it is written down now.
 */

const root = fileURLToPath(new URL('../..', import.meta.url))

const SECRET_NAMES =
  'DATABASE_URL|DATABASE_URL_DIRECT|BETTER_AUTH_SECRET|RESEND_API_KEY|R2_SECRET_ACCESS_KEY|R2_ACCESS_KEY_ID|INSTRUCTOR_INVITE_CODE|PGLITE_DATA_DIR'

/**
 * An actual credential, in any file. These are values, so a comment cannot
 * trip them and minification cannot hide them.
 */
const SECRET_VALUES: readonly { name: string; pattern: RegExp }[] = [
  { name: 'a postgres connection string', pattern: /postgres(ql)?:\/\/[^\s"'`]+/i },
  { name: 'a Neon host', pattern: /[a-z0-9-]+\.neon\.tech/i },
  { name: 'a pooled Neon host', pattern: /-pooler\.[a-z0-9.-]+/i },
  { name: 'a Resend API key', pattern: /\bre_[A-Za-z0-9]{16,}\b/ },
]

/**
 * Client code *reading* a server-only variable. Matching the bare name would
 * flag prose — `shared/contracts/errors.ts` names the invite-code gate in a
 * comment explaining what `invalid_invite_code` means, which is documentation,
 * not a leak. What matters is an access.
 */
const SECRET_ACCESS: readonly { name: string; pattern: RegExp }[] = [
  {
    name: 'a read of a server-only environment variable',
    pattern: new RegExp(String.raw`(?:process|import\.meta)\.env[^\n]{0,30}(?:${SECRET_NAMES})`),
  },
  {
    name: 'a server-only variable exposed to Vite',
    pattern: new RegExp(String.raw`VITE_(?:${SECRET_NAMES})`),
  },
]

/**
 * Bundle-only. Comments are gone by then, so a bare mention of one of these in
 * built output means real code referenced it — and `golden_netlist` has no
 * legitimate reason to appear in a client bundle at all.
 */
const BUNDLE_ONLY: readonly { name: string; pattern: RegExp }[] = [
  { name: 'a server-only variable name', pattern: new RegExp(SECRET_NAMES) },
  { name: 'a golden netlist key', pattern: /golden[_-]?netlist/i },
]

const TEXT = /\.(js|mjs|cjs|css|html|json|map|ts|tsx|svg)$/i

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return []

  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return filesUnder(path)
    return TEXT.test(entry) ? [path] : []
  })
}

function scan(files: readonly string[], rules: readonly { name: string; pattern: RegExp }[]): string[] {
  const hits: string[] = []

  for (const file of files) {
    const contents = readFileSync(file, 'utf8')
    for (const rule of rules) {
      const match = rule.pattern.exec(contents)
      if (match) hits.push(`${file.slice(root.length)} contains ${rule.name}: ${match[0].slice(0, 60)}`)
    }
  }

  return hits
}

describe('client source', () => {
  const files = [...filesUnder(join(root, 'src')), ...filesUnder(join(root, 'shared'))]

  it('is actually being scanned', () => {
    // Guards against the whole suite passing because the glob found nothing.
    expect(files.length).toBeGreaterThan(20)
  })

  it('holds no connection string and no credential', () => {
    expect(scan(files, SECRET_VALUES)).toEqual([])
  })

  it('never reads a server-only environment variable', () => {
    expect(scan(files, SECRET_ACCESS)).toEqual([])
  })
})

describe('the built client bundle', () => {
  const dist = join(root, 'dist')
  const built = existsSync(dist)
  const files = filesUnder(dist)

  it.skipIf(!built)('exists and was scanned', () => {
    expect(files.some((file) => file.endsWith('.js'))).toBe(true)
  })

  it.skipIf(!built)('holds no connection string and no credential', () => {
    expect(scan(files, SECRET_VALUES)).toEqual([])
  })

  it.skipIf(!built)('names no server-only variable and no golden netlist key', () => {
    expect(scan(files, BUNDLE_ONLY)).toEqual([])
  })
})
