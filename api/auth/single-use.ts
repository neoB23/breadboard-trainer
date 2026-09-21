import { createHash } from 'node:crypto'

import { and, eq, like, lt } from 'drizzle-orm'

import { db } from '../db/client.ts'
import { verification } from '../db/auth-schema.ts'

/**
 * Replay tombstones for email-verification links.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * Better Auth's two token types are not built the same way, and only one of them
 * is single-use on its own:
 *
 *   password reset — a random value stored in `verification` and consumed with a
 *     delete. Genuinely single-use, and this file is not involved.
 *
 *   email verification — a stateless HS256 JWT with an `exp` claim. Nothing is
 *     stored, so nothing is consumed: the same link keeps verifying an already
 *     verified address until it expires. That is not dangerous here (there is no
 *     auto-sign-in, so a replay grants nothing) but "the link works once" is a
 *     property this project claims, and a claim that rests on "replaying it
 *     happens to be harmless" is not the same as the property.
 *
 * So the first successful redemption writes a tombstone and every later one is
 * refused. The token is hashed first — a live credential must not sit in the
 * database in the form that would let someone use it.
 * ---------------------------------------------------------------------------
 *
 * The rows live in Better Auth's own `verification` table under an identifier
 * prefix the library never looks up, which is the same shape it uses for
 * `reset-password:<token>`. A separate table would be a migration and a sweeper
 * for something this table already is.
 */

/** Namespaced so it can never collide with an identifier Better Auth queries. */
const TOMBSTONE_PREFIX = 'redeemed:email-verification:'

function identifierFor(token: string): string {
  // sha-256 rather than the raw token: the tombstone outlives the token's
  // usefulness only by minutes, but a table of live verification JWTs is a
  // table of live credentials.
  return `${TOMBSTONE_PREFIX}${createHash('sha256').update(token).digest('hex')}`
}

export interface Redemption {
  /** False when this token has already been redeemed. */
  claimed: boolean
}

/**
 * Claims a token, returning false if someone already has.
 *
 * Check-then-insert rather than an upsert on a unique index, because adding a
 * constraint to a table the library owns is a change the library did not agree
 * to. The race window is two concurrent clicks on the same link, and both
 * winning is the same end state as one winning — the address gets verified once
 * either way.
 *
 * `expiresAt` is the token's own expiry, so a tombstone never outlives the thing
 * it is tombstoning; `sweepExpired` clears them out afterwards.
 */
export async function claimToken(token: string, expiresAt: Date): Promise<Redemption> {
  const identifier = identifierFor(token)

  const [existing] = await db
    .select({ id: verification.id })
    .from(verification)
    .where(eq(verification.identifier, identifier))
    .limit(1)

  if (existing) return { claimed: false }

  await db.insert(verification).values({
    id: `redeem_${createHash('sha256').update(`${identifier}:${Date.now()}`).digest('hex').slice(0, 24)}`,
    identifier,
    // The row is a marker; there is nothing to store and nothing to read back.
    value: '1',
    expiresAt,
  })

  return { claimed: true }
}

/**
 * Drops tombstones whose tokens have expired anyway.
 *
 * Called opportunistically from the redeem path rather than on a schedule —
 * there is no scheduler in a serverless deployment, and the table only grows
 * when someone actually clicks a link. Failure is swallowed: a stale row is
 * housekeeping, and it must never be the reason a verification fails.
 */
export async function sweepExpiredRedemptions(now = new Date()): Promise<void> {
  try {
    // Scoped by the identifier prefix, not by the marker value — this table
    // belongs to Better Auth, and a sweep that could reach its rows would be a
    // sweep that eventually deletes someone's live password-reset token.
    await db
      .delete(verification)
      .where(and(like(verification.identifier, `${TOMBSTONE_PREFIX}%`), lt(verification.expiresAt, now)))
  } catch (err) {
    console.warn('[auth] could not sweep expired verification tombstones', err)
  }
}
