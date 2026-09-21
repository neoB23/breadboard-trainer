import { randomUUID, timingSafeEqual } from 'node:crypto'

import { hashPassword } from 'better-auth/crypto'
import { eq } from 'drizzle-orm'

import {
  API_ERROR_CODES,
  type ProfilePreferences,
  type RegisterRequest,
  type Role,
} from '../../shared/contracts/index.ts'
import { db, supportsTransactions, type Database } from '../db/client.ts'
import { account, profiles, user } from '../db/schema.ts'
import { ApiException } from '../middleware/error.ts'

/**
 * Registration: the invite gate, and the one write in this system that has to be
 * atomic.
 *
 * Better Auth's own `POST /sign-up/email` is not used here, and this file is the
 * reason. It creates the auth user and links the credential account in two
 * separate calls with no transaction around them, and it knows nothing about
 * `profiles` — so on its own it can leave three different half-accounts behind.
 * A user with no profile is the worst of them: `loadSessionForUser` returns null
 * for it, so the person can sign in and then be 401 on every screen, with no way
 * to tell support what is wrong.
 */

/* -------------------------------------------------------------------------- */
/* The instructor gate                                                        */
/* -------------------------------------------------------------------------- */

/**
 * THE control this phase exists for.
 *
 * An instructor can read every golden netlist. If a student can register as
 * faculty, they can read the answer to every exercise in the system and the
 * whole trainer is a formality — so the role on the request body is never
 * trusted, and the only way to `role: 'instructor'` is a code that is not in the
 * repository.
 *
 * Fails **closed**. With `INSTRUCTOR_INVITE_CODE` unset there is no code that
 * works, so instructor self-registration is impossible rather than unguarded.
 * That is the opposite of the usual "if no secret is configured, skip the check"
 * default, and it is deliberate: an unconfigured deployment should have no
 * faculty accounts, not open ones.
 */
export function assertMayRegisterAs(role: Role, inviteCode: string | undefined): void {
  if (role === 'student') return

  // Not reachable through `signupRoleSchema`, which offers only student and
  // instructor — but a widened enum later must not silently open a third door.
  if (role !== 'instructor') {
    throw new ApiException(403, API_ERROR_CODES.forbidden, 'That account type cannot be created here.')
  }

  const expected = process.env['INSTRUCTOR_INVITE_CODE']?.trim()

  if (!expected) {
    console.warn(
      '[auth] an instructor sign-up was refused because INSTRUCTOR_INVITE_CODE is not set. ' +
        'Set it to issue faculty accounts.',
    )
    throw new ApiException(
      403,
      API_ERROR_CODES.invalidInviteCode,
      'Instructor accounts are not being issued here. Ask your department to set one up for you.',
    )
  }

  if (!inviteCode || !constantTimeEquals(inviteCode.trim(), expected)) {
    throw new ApiException(
      403,
      API_ERROR_CODES.invalidInviteCode,
      'That instructor invite code is not valid.',
      {
        inviteCode: ['That instructor invite code is not valid.'],
      },
    )
  }
}

/**
 * Length is compared first and separately, because `timingSafeEqual` throws on
 * mismatched lengths rather than returning false. Leaking the length of an
 * invite code is not a meaningful disclosure; leaking a character at a time
 * would be.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/* -------------------------------------------------------------------------- */
/* Creating the account                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Better Auth's credential account, transcribed from its own sign-up path.
 * The sign-in handler looks an account up by exactly this triple — provider id,
 * issuer, and the user's own id as the account id — so a value that drifts here
 * produces an account nobody can sign in to.
 */
const CREDENTIAL_PROVIDER_ID = 'credential'
const CREDENTIAL_ISSUER = 'local:credential'

/** Every toggle off. Matches what `preferencesSchema` parses `{}` into. */
const INITIAL_PREFERENCES: ProfilePreferences = {
  theme: 'light',
  highContrast: false,
  reducedMotion: false,
  largerText: false,
}

export interface CreatedAccount {
  userId: string
  email: string
  fullName: string
}

/**
 * Creates the auth user, the credential and the profile as one unit.
 *
 * Password hashing happens *before* anything is written, so a hashing failure —
 * or a password the algorithm refuses — cannot leave a user row behind. That is
 * the same ordering Better Auth uses, and for the same reason.
 */
export async function createAccountWithProfile(input: RegisterRequest): Promise<CreatedAccount> {
  await assertEmailAvailable(input.email)

  const userId = randomUUID()
  const passwordHash = await hashPassword(input.password)

  const write = async (tx: Database): Promise<void> => {
    await tx.insert(user).values({
      id: userId,
      name: input.fullName,
      email: input.email,
      // Registration never verifies anything. The link in the mailbox does.
      emailVerified: false,
    })

    await tx.insert(account).values({
      id: randomUUID(),
      providerId: CREDENTIAL_PROVIDER_ID,
      issuer: CREDENTIAL_ISSUER,
      accountId: userId,
      userId,
      password: passwordHash,
    })

    await tx.insert(profiles).values({
      id: userId,
      fullName: input.fullName,
      role: input.role,
      // A student always has one — `registerRequestSchema` refuses without it.
      // An instructor never does, and `null` is the honest value.
      studentNumber: input.role === 'student' ? (input.studentNumber ?? null) : null,
      section: input.section ?? null,
      locale: 'en',
      preferences: INITIAL_PREFERENCES,
      // Null. Phase 4 sends every new account through onboarding on exactly
      // this, and stamping it here would skip the class-join step.
      onboardedAt: null,
    })
  }

  if (supportsTransactions) {
    await db.transaction(async (tx) => {
      await write(tx)
    })
    return { userId, email: input.email, fullName: input.fullName }
  }

  /**
   * No transaction available — this is the neon-http driver, which has none.
   *
   * The compensating path is a delete of the user row, which cascades to the
   * account and the profile. It is strictly weaker than a transaction: if the
   * process dies between the first insert and the failure, the orphan survives.
   * What it does buy is that the *observable* failure modes are the same, and
   * that an orphan can only ever be a user with no profile — which
   * `loadSessionForUser` already refuses to treat as signed in.
   */
  try {
    await write(db)
  } catch (err) {
    await db
      .delete(user)
      .where(eq(user.id, userId))
      .catch((cleanupError: unknown) => {
        console.error(
          `[auth] registration for ${input.email} failed and the compensating delete of ` +
            `user ${userId} also failed. That row is an orphan and needs removing by hand.`,
          cleanupError,
        )
      })
    throw err
  }

  return { userId, email: input.email, fullName: input.fullName }
}

/**
 * A friendly refusal rather than a unique-constraint violation surfacing as a
 * 500.
 *
 * This does make the endpoint an account-existence oracle: ask it about an
 * address and it tells you whether that address is registered. That is a real
 * disclosure, and it is accepted here because the alternative — accepting the
 * registration and saying nothing — leaves a student staring at a "check your
 * email" screen for an email that will never arrive, on an account that is not
 * theirs. Every registration form of consequence makes the same trade. The two
 * endpoints where the trade is *not* worth it, sign-in and password reset, are
 * both deliberately silent about whether an address exists.
 */
async function assertEmailAvailable(email: string): Promise<void> {
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1)

  if (existing) {
    throw new ApiException(409, API_ERROR_CODES.emailTaken, 'That email already has an account.', {
      email: ['That email already has an account. Sign in instead, or reset your password.'],
    })
  }
}
