import { app } from '../../api/app.ts'
import { capturingTransport, type CapturingTransport } from '../../api/auth/email.ts'
import { setEmailTransport } from '../../api/auth/auth.ts'
import { installBetterAuthSessionProvider } from '../../api/routes/auth.ts'
import { db } from '../../api/db/client.ts'
import { seed, SEED } from '../../api/db/seed.ts'
import { resetRateLimits } from '../../api/middleware/rate-limit.ts'
import { profiles, user, verification } from '../../api/db/schema.ts'

/**
 * The Phase 3 harness. Distinct from `helpers/harness.ts`, and the difference is
 * the whole point.
 *
 * The Phase 2 harness installs a session provider that reads a user id from a
 * header, because there was no way to prove a session yet. Everything below
 * drives the **real** one: a request carries a cookie or it carries nothing, and
 * the cookie is one Better Auth actually issued. A test that proved the security
 * boundary against a header-based impersonator would be proving something the
 * deployed system does not do.
 *
 * Importing this module re-installs the Better Auth provider, so a file must not
 * import both harnesses — module evaluation order would decide which one wins,
 * and that is not a thing to leave to chance.
 */

installBetterAuthSessionProvider()

export { SEED }

/**
 * Seeded accounts all share this. Widened to `string` on purpose: `SEED` is
 * `as const`, and a literal type here would make every `signIn(email, other)`
 * call a type error.
 */
export const SEED_PASSWORD: string = SEED.password

export const SEED_EMAIL = {
  instructor: 'reyes@faculty.example.edu',
  cruz: 'cruz@students.example.edu',
  santos: 'santos@students.example.edu',
  /** The account deliberately left with `onboarded_at` null. */
  dizon: 'dizon@students.example.edu',
} as const

/* -------------------------------------------------------------------------- */
/* Email capture                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Replaces the console transport for the whole file. Verification and reset
 * links are read out of here rather than scraped from stdout, which is the only
 * way to assert on a token without making the test depend on log formatting.
 */
export const mailbox: CapturingTransport = capturingTransport()
setEmailTransport(mailbox)

/** The most recent message sent to an address, or undefined. */
export function lastMessageTo(email: string) {
  return [...mailbox.sent].reverse().find((message) => message.to === email)
}

/**
 * The action link out of an email body. Returns the whole URL, so a test can
 * assert on where it points as well as pull the token out of it.
 */
export function linkFrom(text: string): string {
  const match = /https?:\/\/\S+/.exec(text)
  if (!match) throw new Error(`no link in email body:\n${text}`)
  return match[0]
}

export function tokenFrom(text: string): string {
  const token = new URL(linkFrom(text)).searchParams.get('token')
  if (!token) throw new Error(`link carries no token: ${linkFrom(text)}`)
  return token
}

/* -------------------------------------------------------------------------- */
/* Cookie jar                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A browser's cookie store, reduced to what these tests need: name, value, and
 * whether the response was clearing it.
 *
 * Deliberately not a real cookie implementation — no domain, no path matching,
 * no expiry arithmetic. Every request here goes to one origin, and pretending
 * otherwise would mean testing the jar rather than the API.
 */
export class CookieJar {
  private readonly cookies = new Map<string, string>()

  /** Absorbs every `Set-Cookie` on a response, honouring `Max-Age=0` as a delete. */
  absorb(response: Response): void {
    for (const raw of response.headers.getSetCookie()) {
      const [pair, ...attributes] = raw.split(';')
      const separator = pair?.indexOf('=') ?? -1
      if (!pair || separator < 0) continue

      const name = pair.slice(0, separator).trim()
      const value = pair.slice(separator + 1).trim()

      const cleared =
        value === '' || attributes.some((attribute) => /^\s*max-age\s*=\s*0\s*$/i.test(attribute))

      if (cleared) this.cookies.delete(name)
      else this.cookies.set(name, value)
    }
  }

  header(): string | undefined {
    if (this.cookies.size === 0) return undefined
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ')
  }

  has(name: string): boolean {
    return this.cookies.has(name)
  }

  names(): string[] {
    return [...this.cookies.keys()]
  }

  clear(): void {
    this.cookies.clear()
  }
}

/* -------------------------------------------------------------------------- */
/* Requests                                                                   */
/* -------------------------------------------------------------------------- */

export interface Reply {
  status: number
  body: unknown
  headers: Headers
  /** Every `Set-Cookie` on the response, unparsed — for asserting on flags. */
  setCookies: string[]
}

export interface CallOptions {
  method?: string
  body?: unknown
  jar?: CookieJar
  headers?: Record<string, string>
}

/**
 * One request through the whole middleware chain, exactly as a browser would
 * make it. If a jar is passed, its cookies go out and any new ones come back in.
 */
export async function call(path: string, options: CallOptions = {}): Promise<Reply> {
  const headers = new Headers(options.headers)
  if (options.body !== undefined) headers.set('content-type', 'application/json')

  const cookie = options.jar?.header()
  if (cookie) headers.set('cookie', cookie)

  const response = await app.request(path, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
  })

  options.jar?.absorb(response)

  const text = await response.text()
  let body: unknown = text
  try {
    body = JSON.parse(text)
  } catch {
    // Left as raw text; only the status matters for a non-JSON failure.
  }

  return {
    status: response.status,
    body,
    headers: response.headers,
    setCookies: response.headers.getSetCookie(),
  }
}

/** Signs in and returns a jar holding the session cookie. */
export async function signIn(email: string, password = SEED_PASSWORD): Promise<CookieJar> {
  const jar = new CookieJar()
  const reply = await call('/api/auth/login', {
    method: 'POST',
    body: { email, password },
    jar,
  })

  if (reply.status !== 200) {
    throw new Error(`sign-in for ${email} failed with ${reply.status}: ${JSON.stringify(reply.body)}`)
  }
  return jar
}

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

let seeded = false

export async function seedOnce(): Promise<void> {
  if (seeded) return
  await seed({ quiet: true })
  seeded = true
}

/**
 * Registers, reads the verification link out of the captured mailbox, redeems
 * it, and signs in. The full first-run journey, as one call, for tests that need
 * a live account rather than the journey itself.
 */
export async function registerAndVerify(input: {
  fullName: string
  email: string
  password: string
  studentNumber?: string
}): Promise<{ userId: string; jar: CookieJar }> {
  const registered = await call('/api/auth/register', {
    method: 'POST',
    body: {
      fullName: input.fullName,
      email: input.email,
      password: input.password,
      role: 'student',
      studentNumber: input.studentNumber ?? '2026-00001',
    },
  })

  if (registered.status !== 201) {
    throw new Error(`registration failed with ${registered.status}: ${JSON.stringify(registered.body)}`)
  }

  const message = lastMessageTo(input.email)
  if (!message) throw new Error(`no verification email was sent to ${input.email}`)

  const verified = await call('/api/auth/verify-email', {
    method: 'POST',
    body: { token: tokenFrom(message.text) },
  })
  if (verified.status !== 200) {
    throw new Error(`verification failed with ${verified.status}: ${JSON.stringify(verified.body)}`)
  }

  const jar = await signIn(input.email, input.password)
  const userId = (registered.body as { user: { id: string } }).user.id
  return { userId, jar }
}

/**
 * Ages a stored reset token so the expired-link branch can be exercised without
 * a test that sleeps for an hour. It moves the row's own `expires_at`, which is
 * the same field the production path reads — nothing is stubbed.
 */
export async function expireResetToken(token: string): Promise<void> {
  const { eq } = await import('drizzle-orm')
  await db
    .update(verification)
    .set({ expiresAt: new Date(Date.now() - 60_000) })
    .where(eq(verification.identifier, `reset-password:${token}`))
}

/** Every account the tests created, for assertions about what landed in the database. */
export { db, profiles, user, verification, resetRateLimits }
