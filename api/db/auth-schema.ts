import { boolean, index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

/**
 * Better Auth's four tables, authored by hand rather than by its CLI.
 *
 * The CLI emits a standalone file with its own conventions; this project has
 * one migration history, one schema graph and one naming convention, and a
 * second generator writing into it would drift the first time either side is
 * upgraded. So the shapes below are transcribed from the library's own source —
 * `getAuthTables()` in `node_modules/@better-auth/core/dist/db/get-tables.mjs`,
 * which is the authority on what the adapter will look for.
 *
 * ---------------------------------------------------------------------------
 * THE ONE RULE THAT BREAKS THIS AT RUNTIME RATHER THAN AT COMPILE TIME
 *
 * The Drizzle adapter resolves a column as `schema[model][fieldName]`, where
 * `fieldName` is Better Auth's own camelCase field name. It never sees the SQL
 * column name. So the **property keys below must stay camelCase** —
 * `emailVerified`, not `email_verified` — while the string passed to each column
 * helper is the snake_case SQL name this project uses everywhere else. Renaming
 * a property key here produces a clean build and a 500 on the first sign-in.
 * ---------------------------------------------------------------------------
 *
 * Ids are `text`, not `uuid`: Better Auth generates its own opaque ids and hands
 * them to the adapter as strings. That is why `profiles.id` and every column
 * pointing at a person is text.
 */

/* -------------------------------------------------------------------------- */
/* user                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * `user` is a reserved word in Postgres. Drizzle quotes every identifier it
 * emits, so the table is `"user"` in SQL and nothing has to be renamed — but any
 * hand-written SQL against it must quote it too.
 *
 * Credentials are not here. The password hash lives on `account`, which is
 * Better Auth's shape and a good one: an account can also be an OAuth identity,
 * and a user may hold several.
 */
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/* -------------------------------------------------------------------------- */
/* session                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * One row per signed-in browser. `token` is the value carried in the httpOnly
 * cookie; it is never returned in a response body and never reaches `src/`.
 *
 * ON DELETE CASCADE is Better Auth's own semantic: deleting a user must not
 * leave sessions behind that still resolve.
 */
export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [
    /** "Every session this person holds" — sign-out-everywhere, and the cascade. */
    index('session_user_idx').on(t.userId),
  ],
)

/* -------------------------------------------------------------------------- */
/* account                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The credential, or a linked provider identity. For email + password there is
 * exactly one row per user, with `providerId = 'credential'` and the scrypt hash
 * in `password`.
 *
 * `issuer` is part of the uniqueness key in Better Auth 1.7 — the library
 * declares a unique index on (issuer, accountId) itself, so it is declared here
 * rather than left for the adapter to wish for.
 */
export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    issuer: text('issuer').notNull(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    /** Scrypt hash. Never selected into anything that leaves the API. */
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('account_issuer_account_id_idx').on(t.issuer, t.accountId),
    index('account_user_idx').on(t.userId),
  ],
)

/* -------------------------------------------------------------------------- */
/* verification                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Short-lived proofs: email verification and password reset both land here.
 * `identifier` names what is being proved, `value` is the token, and
 * `expires_at` is what makes an expired link a *distinguishable* state rather
 * than a generic failure — Phase 3 requires the UI tell those two apart.
 *
 * Rows are deleted on use, which is what makes a link single-use.
 */
export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
)

/* -------------------------------------------------------------------------- */
/* row types                                                                  */
/* -------------------------------------------------------------------------- */

export type AuthUserRow = typeof user.$inferSelect
export type AuthSessionRow = typeof session.$inferSelect
export type AuthAccountRow = typeof account.$inferSelect
export type AuthVerificationRow = typeof verification.$inferSelect

/**
 * The object handed to `drizzleAdapter(db, { schema })`. Keyed by Better Auth's
 * model names — `user`, not `users`.
 *
 * Passed explicitly rather than letting the adapter fall back to
 * `db._.fullSchema`, so the four tables it may touch are listed in one place and
 * `exercises` is not reachable from it even in principle.
 */
export const authTables = { user, session, account, verification } as const
