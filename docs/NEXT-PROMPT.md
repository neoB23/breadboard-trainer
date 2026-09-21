# Next-session prompt

Open Claude Code **in this folder** (`breadboard-trainer`), then paste everything below the
line. Say `ultracode` in the message if you want it to fan out across subagents.

---

Build **Phase 3 (Authentication)** and **Phase 4 (Onboarding & Profile)** from
`docs/build-plan.md`. Work to the DoD checklists in that file — a phase isn't done until every
box is genuinely checked.

**Read first:** `docs/build-plan.md` (Phases 3 and 4 are your spec), `docs/design-brief.md`
(the visual language — non-negotiable), `docs/phase-status.md`, `api/db/schema.ts`,
`api/middleware/`, `shared/contracts/`, `src/components/ui/index.ts`.

## Already done — don't redo it

Phases 0, 1, 2 plus a full design-system rebuild. Build is green, `npm test` is 50/50.
The API has a working security boundary: default-deny sessions, `requireRole`, `assertOwns`,
and a three-layer guard on the golden netlist (column projection → serializer whitelist →
response tripwire). Those 50 tests were mutation-tested, so if you change a guard and the
tests stay green, suspect your change, not the tests.

## Environment facts — don't fight these

- **No Neon, no Docker, no local Postgres.** Everything runs on PGlite via the dual-driver
  client in `api/db/client.ts`. Neon is the deploy target only; `DATABASE_URL` selects it.
- **No `RESEND_API_KEY`.** Put email behind a transport interface with two implementations:
  Resend when the key exists, and a dev one that logs the verification/reset URL to the server
  console. Token generation, expiry, single-use and the expired-link state must all be real.
- `better-auth` v1.7.1 is installed — **read its actual types in `node_modules` before writing
  against it**, don't assume the API from memory.

## Three things Phase 2 explicitly handed you

1. `api/middleware/session.ts` is a prepared seam — `SessionProvider` + `setSessionProvider()`.
   The default returns `null`, so protected routes are 401 until you install the real one.
   There's a dev provider fenced behind `DEV_AUTH=1` that throws on production/Vercel: leave
   that fencing intact.
2. `profiles` has **no `preferences` column**, but `profileSchema` in `shared/contracts`
   already requires one. Add it in a migration this phase — Phase 4's accessibility settings
   persist into it.
3. `/api/auth` is on `PUBLIC_PREFIXES` in `api/app.ts`, so default-deny does **not** cover it.
   Your `/api/auth/me` must apply `requireSession` itself or it returns 200 for anonymous
   callers. Test that explicitly.

## Hard rules

- TS strict + `noUncheckedIndexedAccess`. `npm run build` and `npm test` must stay green;
  the test count should only go up.
- Sessions are **httpOnly + Secure + SameSite=Lax cookies**. Never `localStorage` — one XSS
  bug would hand over every session.
- **Self-registration must not be able to create an instructor.** Gate it behind
  `INSTRUCTOR_INVITE_CODE`, and never trust a role field from the client. If anyone can
  register as faculty they can read every golden netlist, which defeats the whole system.
- Registration creates the auth user and the `profiles` row in the **same transaction**.
- Every user-facing error is human: "That email isn't registered", never
  `AuthApiError: invalid_credentials`.
- UI: Tailwind's stock palette is **deleted** — only design tokens compile. Controls are
  `rounded-pill`, surfaces `rounded-card`/`rounded-panel`, there is no middle radius. Build
  from the existing primitives (`Field`, `Input`, `Button`, `Checkbox`, `Select`, `Chip`…) —
  don't hand-roll form markup. Match the bar set by `src/features/landing/landing-page.tsx`.

## Phase 3 — Authentication

Better Auth + Drizzle adapter, mounted in Hono at `/api/auth/*`. Registration with the
conditional student-number / invite-code fields. Login, forgot-password, reset-password,
email verification (including the expired-link state). `AuthProvider` hydrating from
`GET /api/auth/me`. `<ProtectedRoute>` and `<RoleRoute>` — while status is `loading`, render a
quiet full-page state, **not** a redirect, or every refresh logs the user out. Redirect back to
the originally requested page after login, not always `/dashboard`. Rate-limit login and reset.
A student hitting an instructor route gets a designed 403, not a crash.

Polish the DoD actually names: loading state on every submit, double-submit impossible,
password show/hide toggle, Enter submits from any field, correct at 360px.

For `AuthLayout`, do something that belongs to *this* product — the netlist-comparison motif,
a board fragment, the terminal line. Not a centred card on a gradient.

## Phase 4 — Onboarding & Profile

Three-step onboarding (confirm name/student number → join a class by 6-char code → how this
works), forced exactly once when `onboarded_at` is null. `/settings` with name, password
change, and the accessibility toggles — persist them to `profiles.preferences` and apply on
load. The CSS for `.reduce-motion`, `.high-contrast`, `.text-larger` already exists in
`src/index.css`; wire the toggles to it.

**EN / Filipino language toggle.** The DoD says "no hardcoded English left" in Part A, so this
needs a real i18n layer, not a stub — set one up and route every existing Part A string
through it.

## Verification bar

Don't assert anything you didn't run. Specifically:

- Drive the real journey with curl: register → verification URL from the console → login →
  `/api/auth/me` → logout → 401. Report actual status codes.
- Prove the guards by request, not by reading code: `role=instructor` with no invite code and
  with a wrong invite code must both fail to produce an instructor; `/api/teach/*` is 403 with
  a student cookie and 401 with none; the login `Set-Cookie` carries `HttpOnly` and
  `SameSite=Lax`; the rate limiter actually starts refusing.
- Confirm no token reaches `localStorage`.
- Add these as real tests in `tests/` and run them.
- Screenshot the auth and onboarding screens at **1440px and 360px** so the responsive box is
  actually checked. Headless Edge works:
  `"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless --disable-gpu --no-sandbox --hide-scrollbars --user-data-dir=<temp> --virtual-time-budget=12000 --window-size=360,800 --screenshot=<out.png> "<url>"`
  On Windows, pass args via `Start-Process -ArgumentList` when the URL contains `?` or `#`.

Finish by updating `docs/phase-status.md` with what's genuinely closed and what isn't. Be
honest about gaps — a false green is worse than a known one.
