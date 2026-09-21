import { mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'

/**
 * Outbound email, behind one interface and three implementations.
 *
 * There is no `RESEND_API_KEY` on this machine and there may not be one on the
 * day this is defended, so the shape of the system cannot depend on a live
 * provider. What must not be faked is everything *around* the send: the token,
 * its expiry, its single use, and the expired-link screen at the other end are
 * all real regardless of which transport is installed. Only the delivery changes:
 *
 *   resend   a live provider, when `RESEND_API_KEY` and `EMAIL_FROM` are both set
 *   outbox   a directory of JSON files, when `EMAIL_OUTBOX_DIR` is set — this is
 *            what lets the Playwright suite open a link the server genuinely sent
 *   console  the fallback: a framed block on the server's stdout
 *
 * That is a deliberately small seam. The alternative people reach for is to skip
 * verification entirely in development, which means the verification path is
 * first exercised in production, on a stranger's account.
 */

export interface EmailMessage {
  to: string
  subject: string
  /** Plain-text body. Always populated — some clients never render the HTML. */
  text: string
  html: string
}

export interface EmailTransport {
  /** Named so a log line can say which one actually ran. */
  readonly name: string
  send(message: EmailMessage): Promise<void>
}

/* -------------------------------------------------------------------------- */
/* Resend                                                                     */
/* -------------------------------------------------------------------------- */

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/**
 * Plain `fetch` rather than the `resend` SDK: the whole client is one POST, and
 * a dependency that exists to build one JSON body is a dependency that has to be
 * kept up to date, audited, and bundled into a serverless function.
 *
 * A failed send throws. Callers decide what that means — registration must not
 * roll back a created account because a mail relay was briefly down, whereas
 * "resend my verification email" has nothing to report if it did not send.
 */
export function resendTransport(apiKey: string, from: string): EmailTransport {
  return {
    name: 'resend',
    async send(message) {
      const response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
      })

      if (!response.ok) {
        // Read the body for the log, not for the caller: Resend's failures name
        // the domain and the API key, neither of which belongs in a response.
        const detail = await response.text().catch(() => '')
        throw new Error(`Resend refused the message (${response.status}): ${detail.slice(0, 500)}`)
      }
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Console                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The development transport. Prints the message to the server console with the
 * action link on its own line, so it can be copied straight out of the terminal
 * running `npm run dev:api`.
 *
 * It is loud on purpose. A quiet fallback is one that stays installed by
 * accident, and a verification email that goes to a log file in production is
 * indistinguishable from one that was never sent.
 */
export function consoleTransport(): EmailTransport {
  return {
    name: 'console',
    async send(message) {
      const link = firstUrl(message.text)
      const rule = '─'.repeat(72)

      console.warn(
        [
          '',
          rule,
          `[email:console] ${message.subject}`,
          `           to   ${message.to}`,
          link ? `           link ${link}` : '           link (none in body)',
          rule,
          message.text.trim(),
          rule,
          '',
        ].join('\n'),
      )
    },
  }
}

/** The action link, pulled out so it is one copyable line rather than buried in prose. */
function firstUrl(text: string): string | null {
  const match = /https?:\/\/\S+/.exec(text)
  return match?.[0] ?? null
}

/* -------------------------------------------------------------------------- */
/* Outbox                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Writes each message to a directory as JSON — a maildir, essentially.
 *
 * It exists so an end-to-end test can drive the *real* verification flow: the
 * browser registers, the server mints a genuine token with a genuine expiry, and
 * the test opens the link it actually sent. The alternative is a test-only
 * endpoint that hands out tokens, which is a hole in the auth surface that
 * exists purely to be tested through — exactly the kind of code that survives
 * into production.
 *
 * Nothing about the token is faked. Only the transport is a directory instead of
 * an SMTP hop.
 *
 * Fenced the same way `DEV_AUTH` is in `middleware/session.ts`: it throws rather
 * than warns on a production-like runtime, because writing every password-reset
 * link to disk on a real deployment is a credential leak with a filename.
 */
export function outboxTransport(dir: string): EmailTransport {
  assertNotProductionLike(
    `EMAIL_OUTBOX_DIR is set on a production-like runtime. It writes every ` +
      `verification and password-reset link to disk in plain text. Unset it.`,
  )

  mkdirSync(dir, { recursive: true })

  return {
    name: 'outbox',
    async send(message) {
      // Sortable by name, unique per message: the reader wants "the newest one
      // for this address" and a lexical sort has to give it that.
      const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`
      const file = join(dir, `${stamp}.json`)

      const body = JSON.stringify(
        { ...message, link: firstUrl(message.text), sentAt: new Date().toISOString() },
        null,
        2,
      )

      /**
       * Written to a temporary name and renamed into place, which is the whole
       * reason a maildir is shaped like this.
       *
       * `writeFileSync` is not atomic: a reader polling the directory can open
       * the file between the create and the last byte and get truncated JSON.
       * That is not theoretical — it flaked the password-reset end-to-end test
       * once, as `SyntaxError: Unexpected end of JSON input`. `rename` within one
       * directory is atomic, so a file is either absent or complete.
       *
       * The `.tmp` suffix keeps the half-written file out of the reader's glob
       * as well, so neither half of the race can bite.
       */
      const pending = `${file}.tmp`
      writeFileSync(pending, body)
      renameSync(pending, file)
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Selection                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Silent transport, for the test suite. Sending real mail from a test run is a
 * way to get a domain suspended; logging four framed blocks per test file is a
 * way to make the output unreadable. `sent` is exposed so a test can assert that
 * a verification email was in fact produced, and read the link out of it.
 */
export interface CapturingTransport extends EmailTransport {
  readonly sent: EmailMessage[]
}

export function capturingTransport(): CapturingTransport {
  const sent: EmailMessage[] = []
  return {
    name: 'capture',
    sent,
    async send(message) {
      sent.push(message)
    },
  }
}

/**
 * Which transport this process gets.
 *
 * Resend only when a key *and* a from-address are both present: Resend rejects a
 * send with no `from`, and discovering that on the first real registration is
 * worse than falling back here with a warning.
 */
export function selectEmailTransport(): EmailTransport {
  // Checked first, and it throws rather than falls through on a real runtime —
  // an outbox is a deliberate development choice, never a fallback.
  const outbox = process.env['EMAIL_OUTBOX_DIR']?.trim()
  if (outbox) {
    console.warn(`[email] EMAIL_OUTBOX_DIR=${outbox} — messages are written to disk, not sent.`)
    return outboxTransport(outbox)
  }

  const apiKey = process.env['RESEND_API_KEY']?.trim()
  const from = process.env['EMAIL_FROM']?.trim()

  if (apiKey && from) return resendTransport(apiKey, from)

  if (apiKey && !from) {
    console.warn('[email] RESEND_API_KEY is set but EMAIL_FROM is not — falling back to the console.')
  }

  // Not a silent default. On a real deployment this line is the only warning
  // that nobody is receiving their verification link.
  if (isProductionLike()) {
    console.error(
      '[email] No RESEND_API_KEY — verification and password-reset links are being written to ' +
        'the server log instead of being delivered. This is a development transport running on a ' +
        'production-like runtime.',
    )
  }

  return consoleTransport()
}

function isProductionLike(): boolean {
  const onVercel = (process.env['VERCEL'] ?? process.env['VERCEL_ENV'] ?? '') !== ''
  return process.env['NODE_ENV'] === 'production' || onVercel
}

/** Thrown rather than logged — a warning in a log nobody reads is not a control. */
function assertNotProductionLike(message: string): void {
  if (isProductionLike()) throw new Error(message)
}
