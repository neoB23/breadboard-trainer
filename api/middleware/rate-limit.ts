import type { Context } from 'hono'

import { API_ERROR_CODES } from '../../shared/contracts/index.ts'
import type { AppEnv } from './context.ts'
import { ApiException } from './error.ts'

/**
 * Rate limiting for the endpoints where guessing is the attack: sign-in, and
 * anything that sends mail to an address the caller names.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS AND IS NOT
 *
 * It is an in-process fixed-window counter, which is what the build plan asks
 * for ("simple in-memory or Upstash counter"). It stops the obvious things: a
 * script walking a password list, and someone using the password-reset form as a
 * free outbound mailer.
 *
 * It is **not** a distributed limiter. Each serverless instance keeps its own
 * map, so the effective ceiling on Vercel is the configured limit multiplied by
 * however many instances happen to be warm. That is a real weakening and it is
 * written down here rather than discovered later: the fix is Upstash behind the
 * same `RateLimiter` interface, and nothing outside this file changes when it
 * arrives.
 *
 * It is also not a lockout. A locked account is a denial-of-service someone else
 * can trigger for you, so a refused request here always recovers on its own when
 * the window rolls over.
 * ---------------------------------------------------------------------------
 */

export interface RateLimitRule {
  /** Name of the bucket, so two rules never share a counter. */
  readonly name: string
  readonly limit: number
  readonly windowMs: number
}

interface Counter {
  count: number
  /** Epoch millis at which this window ends and the counter resets. */
  resetAt: number
}

/**
 * One map for the whole process. Entries are dropped lazily on read and swept
 * when the map grows past a ceiling — an unbounded map keyed by attacker-chosen
 * strings is itself a way to exhaust a function's memory.
 */
const counters = new Map<string, Counter>()

const MAX_TRACKED_KEYS = 10_000

export interface RateLimitResult {
  allowed: boolean
  /** Requests left in this window; 0 once refused. */
  remaining: number
  /** Whole seconds until the window rolls over. */
  retryAfterSeconds: number
}

/**
 * Counts one request against a rule. Pure bookkeeping — it never throws, so it
 * can be used for a soft signal as well as a hard refusal.
 */
export function consume(rule: RateLimitRule, identifier: string, now = Date.now()): RateLimitResult {
  const key = `${rule.name}:${identifier}`
  const existing = counters.get(key)

  if (!existing || existing.resetAt <= now) {
    if (counters.size >= MAX_TRACKED_KEYS) sweep(now)
    counters.set(key, { count: 1, resetAt: now + rule.windowMs })
    return { allowed: true, remaining: rule.limit - 1, retryAfterSeconds: 0 }
  }

  existing.count += 1
  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))

  if (existing.count > rule.limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds }
  }

  return { allowed: true, remaining: rule.limit - existing.count, retryAfterSeconds }
}

function sweep(now: number): void {
  for (const [key, counter] of counters) {
    if (counter.resetAt <= now) counters.delete(key)
  }
  // Every window is still live. Dropping the oldest half is worse than dropping
  // everything: a partial clear leaves the *newest* counters, which are the ones
  // an attacker is currently filling.
  if (counters.size >= MAX_TRACKED_KEYS) counters.clear()
}

/** Test seam. Never called from a request path. */
export function resetRateLimits(): void {
  counters.clear()
}

/* -------------------------------------------------------------------------- */
/* Identifying the caller                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The caller's address, as well as it can be known.
 *
 * On Vercel the platform sets `x-forwarded-for` and the left-most entry is the
 * real client; behind no proxy at all the header is absent and everything falls
 * into one shared bucket. It is spoofable by anyone talking to the function
 * directly, which is exactly why the rules below key on the address **and** the
 * account being attacked — rotating the header still cannot buy unlimited
 * attempts against one person's password.
 */
export function callerAddress(c: Context<AppEnv>): string {
  const forwarded = c.req.header('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  if (first) return first

  return c.req.header('x-real-ip')?.trim() || c.req.header('cf-connecting-ip')?.trim() || 'unknown'
}

/* -------------------------------------------------------------------------- */
/* Enforcement                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Counts the request and refuses it with a 429 once the window is full.
 *
 * The message names a wait rather than a policy. "Too many sign-in attempts.
 * Try again in 4 minutes." is something a student who has genuinely mistyped
 * their password three times can act on; "rate limit exceeded" is not.
 */
export function enforce(c: Context<AppEnv>, rule: RateLimitRule, identifier: string, subject: string): void {
  const result = consume(rule, identifier)
  if (result.allowed) return

  // Standard header, so a well-behaved client backs off without being told.
  c.header('Retry-After', String(result.retryAfterSeconds))

  throw new ApiException(
    429,
    API_ERROR_CODES.rateLimited,
    `Too many ${subject}. Try again in ${describeWait(result.retryAfterSeconds)}.`,
  )
}

function describeWait(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`
  const minutes = Math.ceil(seconds / 60)
  return minutes === 1 ? 'a minute' : `${minutes} minutes`
}

/* -------------------------------------------------------------------------- */
/* The rules                                                                  */
/* -------------------------------------------------------------------------- */

function ruleFromEnv(name: string, envVar: string, limit: number, windowMs: number): RateLimitRule {
  const configured = Number(process.env[envVar]?.trim())
  return {
    name,
    limit: Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : limit,
    windowMs,
  }
}

/**
 * Sign-in, per address **and** per account.
 *
 * Two rules rather than one, because they stop different things. The per-account
 * rule stops a botnet spreading a password list for one student across many
 * addresses; the per-address rule stops one machine spraying one password across
 * the whole roster, which the per-account rule would never see.
 *
 * Ten in fifteen minutes is deliberately generous. A student on a shared lab
 * network who has forgotten whether their password has a capital in it should
 * never meet this; a script trying the top 100 passwords should meet it on the
 * eleventh.
 */
export const LOGIN_BY_ACCOUNT = ruleFromEnv('login:account', 'RATE_LIMIT_LOGIN', 10, 15 * 60_000)
export const LOGIN_BY_ADDRESS = ruleFromEnv('login:address', 'RATE_LIMIT_LOGIN_IP', 30, 15 * 60_000)

/**
 * Anything that sends mail to an address the caller chose. Tighter, because the
 * cost of getting it wrong is someone else's inbox rather than the caller's own
 * time, and because a legitimate user needs at most two of these.
 */
export const EMAIL_SEND_BY_ACCOUNT = ruleFromEnv('email:account', 'RATE_LIMIT_EMAIL', 3, 15 * 60_000)
export const EMAIL_SEND_BY_ADDRESS = ruleFromEnv('email:address', 'RATE_LIMIT_EMAIL_IP', 10, 15 * 60_000)

/**
 * Registration. Loose enough that a lab section signing up together in one room
 * — one shared campus NAT address — does not hit it, tight enough that a script
 * cannot fill the `user` table.
 */
export const REGISTER_BY_ADDRESS = ruleFromEnv('register:address', 'RATE_LIMIT_REGISTER', 40, 60 * 60_000)

/**
 * Redeeming a token: verification links and password resets. Guessing a token is
 * hopeless, but an unlimited endpoint that hits the database on every call is
 * still worth a ceiling.
 */
export const TOKEN_REDEEM_BY_ADDRESS = ruleFromEnv('token:address', 'RATE_LIMIT_TOKEN', 20, 15 * 60_000)
