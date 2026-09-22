import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * `src/board/` is the diagnostic engine, and two things depend on it staying
 * pure: the unit tests that run it headless, and the API, which imports it by
 * relative path to grade submissions on the server.
 *
 * The second is why the rule is stricter than "no React". The API runs under
 * tsx and as a bundled Vercel function, neither of which knows the client's
 * `@/` alias; and a runtime import of `@shared/...` would need a resolver the
 * API does not configure. A type-only import is erased before any of that
 * matters, so it is the one kind of alias import allowed.
 */

const BOARD_DIR = fileURLToPath(new URL('../../src/board', import.meta.url))

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sources(path)
    return entry.name.endsWith('.ts') ? [path] : []
  })
}

const IMPORT = /^\s*import\s+(type\s+)?[\s\S]*?\sfrom\s+'([^']+)'/gm

describe('src/board purity', () => {
  const files = sources(BOARD_DIR)

  it('has files to check', () => {
    expect(files.length).toBeGreaterThan(3)
  })

  it.each(files.map((file) => [file.slice(BOARD_DIR.length + 1), file]))(
    '%s imports only siblings, and the contracts by type',
    (_name, file) => {
      const text = readFileSync(file, 'utf8')
      const offences: string[] = []
      for (const match of text.matchAll(IMPORT)) {
        const typeOnly = match[1] !== undefined
        const from = match[2] ?? ''
        if (from.startsWith('./') && from.endsWith('.ts')) continue
        if (typeOnly && from.startsWith('@shared/')) continue
        offences.push(from)
      }
      expect(offences).toEqual([])
    },
  )
})
