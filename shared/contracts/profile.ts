import { z } from 'zod'

import {
  blankAsAbsent,
  fullNameSchema,
  localeSchema,
  optionalTextSchema,
  roleSchema,
  sectionSchema,
  studentNumberSchema,
  timestampSchema,
  userIdSchema,
} from './common.ts'

/**
 * `profiles` — the application's half of a user. Better Auth owns `user`,
 * `session`, `account` and `verification`; everything the app cares about
 * (name, role, class identity, preferences) lives here, keyed by the same id.
 */

/* -------------------------------------------------------------------------- */
/* Accessibility preferences                                                   */
/* -------------------------------------------------------------------------- */

export const themeSettingSchema = z.enum(['light', 'dark', 'system'])
export type ThemeSetting = z.infer<typeof themeSettingSchema>

/**
 * Mirrors the `Preferences` interface in `src/app/preferences.ts`, which is the
 * local half of this. Phase 4 task 5 requires the choices persist to `profiles`
 * and apply on load, so they follow a student to a lab machine.
 *
 * Section 2 of the build plan has no column for these. Add one — a single
 * `preferences jsonb not null default '{}'` rather than four booleans, because
 * Part B will add more toggles (camera easing, fault highlight intensity) and
 * each one would otherwise be a migration.
 *
 * Every field has a default, so a row written before a toggle existed still
 * parses and the new toggle simply reads as off.
 */
export const preferencesSchema = z.object({
  theme: themeSettingSchema.default('light'),
  highContrast: z.boolean().default(false),
  reducedMotion: z.boolean().default(false),
  largerText: z.boolean().default(false),
})
export type ProfilePreferences = z.infer<typeof preferencesSchema>

/**
 * What `/settings` sends when one switch moves — and deliberately **not**
 * `preferencesSchema.partial()`.
 *
 * Every field above carries a `.default()`, and in Zod 4 an optional field that
 * wraps a default still resolves that default when the key is absent. So
 * `preferencesSchema.partial().parse({ highContrast: true })` returns all four
 * fields, three of them at their defaults — and a server that merges that over
 * the stored row has performed a silent *replace*, turning off every toggle the
 * caller did not happen to mention.
 *
 * Restating the fields without defaults is what keeps an absent key absent.
 * `tests/api/onboarding.test.ts` covers the merge, because the failure is
 * invisible until a second setting is already on.
 */
export const preferencesPatchSchema = z.object({
  theme: themeSettingSchema.optional(),
  highContrast: z.boolean().optional(),
  reducedMotion: z.boolean().optional(),
  largerText: z.boolean().optional(),
})
export type ProfilePreferencesPatch = z.infer<typeof preferencesPatchSchema>

/* -------------------------------------------------------------------------- */
/* The profile                                                                 */
/* -------------------------------------------------------------------------- */

export const profileSchema = z.object({
  id: userIdSchema,
  fullName: z.string(),
  role: roleSchema,
  studentNumber: z.string().nullable(),
  section: z.string().nullable(),
  locale: localeSchema,
  /** Null until onboarding completes. The router redirects on exactly this. */
  onboardedAt: timestampSchema.nullable(),
  preferences: preferencesSchema,
  createdAt: timestampSchema,
})
export type Profile = z.infer<typeof profileSchema>

/**
 * A profile as seen by someone who is not its owner — a roster row, an exercise
 * author line. No locale, no preferences, no onboarding state: none of that is
 * anyone else's business, and the smaller shape means a handler cannot leak the
 * rest by forgetting a projection.
 */
export const publicProfileSchema = z.object({
  id: userIdSchema,
  fullName: z.string(),
  role: roleSchema,
  studentNumber: z.string().nullable(),
  section: z.string().nullable(),
})
export type PublicProfile = z.infer<typeof publicProfileSchema>

/* -------------------------------------------------------------------------- */
/* PATCH /api/profile                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Every field optional so `/settings` can send only what changed, but at least
 * one must be present — an empty PATCH is a bug on the caller's side, not a
 * no-op worth a database round trip.
 *
 * `role` is absent by design. A student cannot promote themselves, and the only
 * way to become an instructor is the invite code at registration or an admin.
 */
export const profileUpdateRequestSchema = z
  .object({
    fullName: fullNameSchema,
    studentNumber: optionalTextSchema(32),
    section: optionalTextSchema(32),
    locale: localeSchema,
    preferences: preferencesPatchSchema,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { error: 'Nothing to update.' })
export type ProfileUpdateRequest = z.infer<typeof profileUpdateRequestSchema>

export const profileResponseSchema = z.object({ profile: profileSchema })
export type ProfileResponse = z.infer<typeof profileResponseSchema>

/* -------------------------------------------------------------------------- */
/* POST /api/profile/onboarding                                                */
/* -------------------------------------------------------------------------- */

/**
 * Closes out `/onboarding` — confirm identity, then stamp `onboarded_at`.
 *
 * Joining a class is *not* folded in here even though it is step 2 of the
 * wizard: it has its own failure mode ("code not found") that must not roll
 * back the name the student just confirmed. The wizard calls
 * `POST /api/classes/join` for that step and this endpoint at the end.
 */
export const onboardingRequestSchema = z
  .object({
    fullName: fullNameSchema,
    studentNumber: blankAsAbsent(studentNumberSchema),
    section: blankAsAbsent(sectionSchema),
    locale: localeSchema.optional(),
  })
  .superRefine((value, ctx) => {
    // Instructors have no student number, so the requirement cannot be
    // expressed on the field itself — the API re-checks against the session
    // role regardless, since role is not in this payload.
    if (value.studentNumber !== undefined && value.studentNumber.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['studentNumber'],
        message: 'Enter your student number.',
      })
    }
  })
export type OnboardingRequest = z.infer<typeof onboardingRequestSchema>

export const onboardingResponseSchema = z.object({ profile: profileSchema })
export type OnboardingResponse = z.infer<typeof onboardingResponseSchema>
