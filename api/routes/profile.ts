import { eq } from 'drizzle-orm'
import { Hono } from 'hono'

import {
  API_ERROR_CODES,
  onboardingRequestSchema,
  preferencesSchema,
  profileUpdateRequestSchema,
  type OnboardingResponse,
  type Profile,
  type ProfilePreferences,
  type ProfilePreferencesPatch,
  type ProfileResponse,
} from '../../shared/contracts/index.ts'
import { db } from '../db/client.ts'
import { profiles, user } from '../db/schema.ts'
import { sessionOf, type AppEnv } from '../middleware/context.ts'
import { ApiException } from '../middleware/error.ts'
import { parseJsonBody } from '../middleware/validate.ts'
import { toProfile } from './serializers.ts'

/**
 * The caller's own profile. Every handler here is scoped to `session.userId` and
 * none of them takes an `:id`, which is the point: there is no shape of request
 * that could aim one of these at somebody else's row, so there is nothing for
 * `assertOwns()` to check.
 *
 * `role` is absent from every write path. A student cannot promote themselves;
 * the only routes to `instructor` are the invite code at registration and an
 * admin. That omission is the control — see `assertMayRegisterAs`.
 */
export const profileRoute = new Hono<AppEnv>()

/* -------------------------------------------------------------------------- */
/* Reading                                                                    */
/* -------------------------------------------------------------------------- */

async function loadOwnProfile(userId: string): Promise<Profile> {
  const [row] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1)

  if (!row) {
    // The session resolved, so a profile existed a moment ago. It has been
    // deleted underneath a live session.
    throw new ApiException(401, API_ERROR_CODES.unauthorized, 'Sign in to continue.')
  }

  return toProfile(row)
}

profileRoute.get('/', async (c) => {
  const session = sessionOf(c)
  return c.json<ProfileResponse>({ profile: await loadOwnProfile(session.userId) })
})

/* -------------------------------------------------------------------------- */
/* PATCH /api/profile                                                         */
/* -------------------------------------------------------------------------- */

/**
 * `/settings`. Every field is optional so the form sends only what changed, and
 * `profileUpdateRequestSchema` refuses an empty body — an empty PATCH is a bug on
 * the caller's side, not a no-op worth a round trip.
 */
profileRoute.patch('/', async (c) => {
  const session = sessionOf(c)
  const body = await parseJsonBody(c, profileUpdateRequestSchema)

  const current = await loadOwnProfile(session.userId)

  const preferences = mergePreferences(current.preferences, body.preferences)

  const [updated] = await db
    .update(profiles)
    .set({
      ...(body.fullName !== undefined && { fullName: body.fullName }),
      ...(body.studentNumber !== undefined && { studentNumber: body.studentNumber }),
      ...(body.section !== undefined && { section: body.section }),
      ...(body.locale !== undefined && { locale: body.locale }),
      ...(body.preferences !== undefined && { preferences }),
    })
    .where(eq(profiles.id, session.userId))
    .returning()

  if (!updated) throw new Error(`profile ${session.userId} did not read back after update`)

  /**
   * Better Auth keeps its own copy of the name on `user.name`, and it is the one
   * that appears in the greeting of every email this system sends. Letting the
   * two drift means a student renames themselves in settings and then gets a
   * password-reset email addressed to whoever they used to be.
   */
  if (body.fullName !== undefined) {
    await db
      .update(user)
      .set({ name: body.fullName, updatedAt: new Date() })
      .where(eq(user.id, session.userId))
  }

  return c.json<ProfileResponse>({ profile: toProfile(updated) })
})

/**
 * Preferences merge rather than replace.
 *
 * The settings screen toggles one switch at a time. A replace would mean every
 * toggle has to send all four fields, so the first caller that forgets silently
 * turns the other three off — and the bug is invisible until a second setting is
 * already on.
 *
 * Two things make the merge honest. `preferencesPatchSchema` has no defaults, so
 * a key the caller did not send genuinely arrives absent rather than as `false`
 * (see the note on it in the contracts). And undefined values are filtered out
 * anyway, so a future schema change that reintroduces them cannot quietly turn
 * this back into a replace.
 *
 * The merged result is re-parsed through `preferencesSchema`, which is what
 * fills in a field that did not exist when the row was written — the reason this
 * is one jsonb column rather than four boolean ones.
 */
function mergePreferences(
  current: ProfilePreferences,
  patch: ProfilePreferencesPatch | undefined,
): ProfilePreferences {
  if (!patch) return current

  const sent = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined))
  return preferencesSchema.parse({ ...current, ...sent })
}

/* -------------------------------------------------------------------------- */
/* POST /api/profile/onboarding                                               */
/* -------------------------------------------------------------------------- */

/**
 * Closes out `/onboarding`: confirm identity, then stamp `onboarded_at`.
 *
 * Joining a class is deliberately *not* folded in here even though it is step 2
 * of the wizard. It has its own failure mode — "that code is not a class" — and
 * folding it in would mean a mistyped code rolls back the name the student just
 * confirmed. The wizard calls `POST /api/classes/join` for that step and this
 * endpoint at the end.
 *
 * Idempotent on purpose. A second call re-stamps rather than refusing: the
 * wizard is behind a redirect that fires on `onboarded_at === null`, and a
 * double submit landing on a 409 would strand someone on a screen they have
 * already finished.
 */
profileRoute.post('/onboarding', async (c) => {
  const session = sessionOf(c)
  const body = await parseJsonBody(c, onboardingRequestSchema)

  /**
   * The role comes from the session, never from the payload — there is no `role`
   * field in `onboardingRequestSchema` for exactly that reason. So the "a
   * student must have a student number" rule can only be enforced here, where
   * the role is known.
   */
  if (session.role === 'student' && !body.studentNumber) {
    throw new ApiException(400, API_ERROR_CODES.validationFailed, 'Enter your student number.', {
      studentNumber: ['Enter your student number.'],
    })
  }

  const [updated] = await db
    .update(profiles)
    .set({
      fullName: body.fullName,
      // An instructor has no student number and never gains one here.
      ...(session.role === 'student' && { studentNumber: body.studentNumber ?? null }),
      ...(body.section !== undefined && { section: body.section }),
      ...(body.locale !== undefined && { locale: body.locale }),
      onboardedAt: new Date(),
    })
    .where(eq(profiles.id, session.userId))
    .returning()

  if (!updated) throw new Error(`profile ${session.userId} did not read back after onboarding`)

  await db.update(user).set({ name: body.fullName, updatedAt: new Date() }).where(eq(user.id, session.userId))

  return c.json<OnboardingResponse>({ profile: toProfile(updated) })
})
