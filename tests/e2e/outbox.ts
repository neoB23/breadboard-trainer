import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * Reads what the API actually emailed.
 *
 * `EMAIL_OUTBOX_DIR` puts the dev transport into maildir mode (see
 * `api/auth/email.ts`), so the token in these files is the *same* token a Resend
 * delivery would have carried — same secret, same expiry, same single use. The
 * test opens the link that was sent rather than one it was handed.
 */

const OUTBOX = fileURLToPath(new URL('../../.e2e-outbox/', import.meta.url))

export interface OutboxMessage {
  to: string
  subject: string
  text: string
  html: string
  link: string | null
  sentAt: string
}

function all(): OutboxMessage[] {
  let names: string[]
  try {
    names = readdirSync(OUTBOX).filter((name) => name.endsWith('.json'))
  } catch {
    return []
  }

  // Filenames lead with a millisecond timestamp, so lexical order is send order.
  return names.sort().flatMap((name) => {
    /**
     * A file that will not parse is skipped rather than thrown on.
     *
     * The transport renames into place, so this should not happen — but the
     * caller is a poll loop with a deadline, and "wait and look again" is the
     * right answer to a half-written file either way. Throwing here turns a
     * transient read into a failed test, which is how this flaked once before
     * the rename was added.
     */
    try {
      return [JSON.parse(readFileSync(`${OUTBOX}${name}`, 'utf8')) as OutboxMessage]
    } catch {
      return []
    }
  })
}

/**
 * Waits for the newest message to an address.
 *
 * Polls rather than reading once: the API sends after the response has already
 * gone back to the browser, so the test can reach this before the file exists.
 * A fixed sleep would be a flake waiting for a slow machine.
 */
export async function waitForEmail(to: string, options: { after?: number; timeoutMs?: number } = {}) {
  const { after = 0, timeoutMs = 10_000 } = options
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const matching = all().filter((message) => message.to === to)
    if (matching.length > after) {
      const latest = matching[matching.length - 1]
      if (latest) return latest
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  const seen = all().map((m) => m.to)
  throw new Error(
    `no email to ${to} within ${timeoutMs}ms (wanted more than ${after}). ` +
      `Outbox holds ${seen.length}: ${seen.join(', ') || 'nothing'}`,
  )
}

export function countEmailsTo(to: string): number {
  return all().filter((message) => message.to === to).length
}

/** The path and query of the action link, ready for `page.goto()`. */
export function linkPath(message: OutboxMessage): string {
  if (!message.link) throw new Error(`message "${message.subject}" carries no link`)
  const url = new URL(message.link)
  return `${url.pathname}${url.search}`
}
