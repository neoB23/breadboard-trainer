import { z } from 'zod'

import {
  blankAsAbsent,
  emailSchema,
  fullNameSchema,
  okSchema,
  passwordSchema,
  sectionSchema,
  signupRoleSchema,
  studentNumberSchema,
  timestampSchema,
  userIdSchema,
} from './common.ts'
import { profileSchema } from './profile.ts'

/**
 * Phase 3. Better Auth owns the credential handling and the cookie; these
 * contracts describe the thin layer around it — the extra registration fields,
 * and the session shape the app actually wants (Better Auth's user plus our
 * profile row, fetched together so the shell hydrates in one request).
 *
 * No token ever appears in any of these shapes. The session lives in an
 * httpOnly, Secure, SameSite=Lax cookie; a token in a response body would end
 * up in localStorage within a week and hand every session to an XSS bug.
 */

/* -------------------------------------------------------------------------- */
/* Session                                                                     */
/* -------------------------------------------------------------------------- */

/** Better Auth's `user` row, narrowed to what the client is allowed to see. */
export const authUserSchema = z.object({
  id: userIdSchema,
  email: z.string(),
  emailVerified: z.boolean(),
  createdAt: timestampSchema,
})
export type AuthUser = z.infer<typeof authUserSchema>

export const sessionSchema = z.object({
  user: authUserSchema,
  profile: profileSchema,
})
export type Session = z.infer<typeof sessionSchema>

/**
 * `GET /api/auth/session` — what AuthProvider calls on every page load.
 *
 * It answers **200 with null** when signed out rather than 401. A 401 here is
 * not an error condition, it is the ordinary state of a logged-out visitor on
 * the landing page, and modelling it as a thrown error means every consumer
 * writes a catch that swallows real failures too.
 *
 * `GET /api/auth/me` stays behind the session middleware and does 401 — use it
 * where a session is genuinely required.
 */
export const sessionResponseSchema = sessionSchema.nullable()
export type SessionResponse = z.infer<typeof sessionResponseSchema>

export const meResponseSchema = sessionSchema
export type MeResponse = z.infer<typeof meResponseSchema>

/* -------------------------------------------------------------------------- */
/* POST /api/auth/register                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Two conditional fields, both enforced here *and* on the server:
 *
 *  - a student must give a student number, since the roster is useless without
 *    it and asking later never happens;
 *  - an instructor must present the invite code. Leaving instructor
 *    self-selection open means any student can read every golden netlist by
 *    registering as faculty, which defeats the entire system. This check
 *    existing on the client is a convenience; the API check is the control.
 */
export const registerRequestSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: passwordSchema,
    role: signupRoleSchema,
    // `blankAsAbsent`, not `.optional()`: a form field that is not rendered
    // still submits as an empty string, and these schemas reject one. See the
    // note on the helper.
    studentNumber: blankAsAbsent(studentNumberSchema),
    section: blankAsAbsent(sectionSchema),
    inviteCode: blankAsAbsent(z.string().trim().min(1)),
  })
  .superRefine((value, ctx) => {
    if (value.role === 'student' && !value.studentNumber) {
      ctx.addIssue({
        code: 'custom',
        path: ['studentNumber'],
        message: 'Enter your student number.',
      })
    }
    if (value.role === 'instructor' && !value.inviteCode) {
      ctx.addIssue({
        code: 'custom',
        path: ['inviteCode'],
        message: 'An instructor invite code is required.',
      })
    }
  })
export type RegisterRequest = z.infer<typeof registerRequestSchema>

/**
 * The profile row is created in the same transaction as the auth user, so a
 * successful register always has both. Whether a *session* also exists depends
 * on whether verification is required — the flag says so explicitly instead of
 * making the client infer it from a missing cookie.
 */
export const registerResponseSchema = z.object({
  user: authUserSchema,
  profile: profileSchema,
  emailVerificationRequired: z.boolean(),
})
export type RegisterResponse = z.infer<typeof registerResponseSchema>

/* -------------------------------------------------------------------------- */
/* POST /api/auth/login, /logout                                               */
/* -------------------------------------------------------------------------- */

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: 'Enter your password.' }),
  /** Long-lived cookie vs. session cookie. Lab machines are shared. */
  rememberMe: z.boolean().default(false),
})
export type LoginRequest = z.infer<typeof loginRequestSchema>

export const loginResponseSchema = sessionSchema
export type LoginResponse = z.infer<typeof loginResponseSchema>

export const logoutResponseSchema = okSchema
export type LogoutResponse = z.infer<typeof logoutResponseSchema>

/* -------------------------------------------------------------------------- */
/* Password reset and verification                                             */
/* -------------------------------------------------------------------------- */

export const forgotPasswordRequestSchema = z.object({ email: emailSchema })
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>

/**
 * Always `{ ok: true }`, whether or not the address is registered. Answering
 * differently turns this endpoint into an account-existence oracle, and the
 * screen copy has to match — "if that address is registered, we have sent a
 * link". Rate-limit it regardless.
 */
export const forgotPasswordResponseSchema = okSchema
export type ForgotPasswordResponse = z.infer<typeof forgotPasswordResponseSchema>

export const resetPasswordRequestSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
})
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>

export const resetPasswordResponseSchema = okSchema
export type ResetPasswordResponse = z.infer<typeof resetPasswordResponseSchema>

/**
 * `/reset-password` and the verification link both need to tell an expired link
 * apart from a forged one — an expired link is a recoverable state with a
 * resend button, an invalid token is not. That distinction rides on the error
 * code (`expired_token` vs `invalid_token`), not on this shape.
 */
export const verifyEmailRequestSchema = z.object({ token: z.string().min(1) })
export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>

export const verifyEmailResponseSchema = okSchema
export type VerifyEmailResponse = z.infer<typeof verifyEmailResponseSchema>

export const resendVerificationRequestSchema = z.object({ email: emailSchema })
export type ResendVerificationRequest = z.infer<typeof resendVerificationRequestSchema>

export const resendVerificationResponseSchema = okSchema
export type ResendVerificationResponse = z.infer<typeof resendVerificationResponseSchema>

/** `/settings` — changing a password requires proving you hold the old one. */
export const changePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(1, { error: 'Enter your current password.' }),
    newPassword: passwordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    error: 'Choose a password you have not used here before.',
    path: ['newPassword'],
  })
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>

export const changePasswordResponseSchema = okSchema
export type ChangePasswordResponse = z.infer<typeof changePasswordResponseSchema>
