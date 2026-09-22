# Phase status

Tracks [`build-plan.md`](build-plan.md). A phase is not finished until every box is ticked.

**Where things stand:** Phases 0–4 are built, and every box in them is now ticked. `npm run
build` is clean, `npm run lint` reports warnings only, `npm test` is **128 passing**, and
`npm run test:e2e` is **23 passing** in a real browser. Three boxes across the whole plan are
unticked and every one of them is blocked on an account nobody has created yet (Neon, Vercel,
GitHub) rather than on code.

`/dashboard` has since been built out past what Phase 3 needed of it — see
[The dashboard](#the-dashboard) below.

**Plan moved to version 1.2** (21 September 2026). We stay on the breadboard, and the
lighting-circuits pivot was not adopted. The Free Build Coach becomes active and runs on a
self-hosted Qwen model. Two phases are new: 26 (suggestion rules and pattern recognizer, run after
Phase 16) and 27 (active coaching, run after Phase 24). Nothing built so far is affected.

---

## Phase 0 — Project Setup ✅

| #   | Task                                             | State                                                             |
| --- | ------------------------------------------------ | ----------------------------------------------------------------- |
| 1   | Vite, React + TypeScript                         | ✅                                                                |
| 2   | `strict` + `noUncheckedIndexedAccess`            | ✅ in all four tsconfigs                                          |
| 3   | Tailwind, shadcn/ui                              | ✅ Tailwind 3.4; shadcn primitives authored in `src/components/ui` |
| 4   | Linting, formatting, pre-commit hook             | ✅ oxlint + Prettier, husky + lint-staged                         |
| 5   | Path aliases                                     | ✅ `@/*` and `@shared/*`, in tsconfig and Vite                    |
| 6   | Git init, GitHub repo, protect `main`            | ⚠️ initialised locally on `main`; **remote not created**          |
| 7   | `api/` workspace with Hono, `GET /api/health`    | ✅                                                                |
| 8   | `vercel.json` routing                            | ✅                                                                |
| 9   | Vite dev proxy for `/api`                        | ✅                                                                |
| 10  | Neon project, pooled + direct strings            | ❌ **not created** — see Outstanding                              |
| 11  | Connect Vercel, verify preview deploys           | ❌ **not connected** — see Outstanding                            |
| 12  | `.env.example`, `.env` gitignored                | ✅                                                                |

### Definition of Done

- [x] `npm run dev` serves a styled page
- [x] `GET /api/health` returns 200 in local dev
- [ ] …and on the deployed preview — **blocked on Vercel not being connected**
- [x] `npm run build` passes with zero TS errors in `src/`, `api/`, `tests/` and the node configs
- [ ] A pushed branch produces a working Vercel preview URL — **blocked, same reason**
- [x] Committing badly formatted code is blocked by the hook

---

## Phase 1 — Design System ✅ (rebuilt twice; see the note below)

| #   | Task                                    | State                                                     |
| --- | --------------------------------------- | --------------------------------------------------------- |
| 1   | Colour tokens, five semantic states     | ✅ `src/styles/tokens.css`, mapped in `tailwind.config.ts` |
| 2   | Typefaces and a type scale              | ✅ Inter + JetBrains Mono, self-hosted                     |
| 3   | Spacing scale, radius scale             | ✅ radius by role — see `design-system.md`                 |
| 4   | Base component set                      | ✅ 16 primitives                                           |
| 5   | `<AppShell>`                            | ✅ header, user menu, optional collapsible sidebar         |
| 6   | `<PageHeader>`                          | ✅ breadcrumb, title, subtitle, action slot                |
| 7   | `/styleguide`                           | ✅ every component, every state, colour-vision simulator   |

### Definition of Done

- [x] `/styleguide` renders all components in default, hover, focus, disabled, loading and
      error states — hover and focus as forced-class columns beside the live ones
- [x] No hardcoded hex colour appears in any component file — verified by grep. The two
      exceptions live outside `src/`: the `theme-color` meta tags in `index.html` (the tag
      cannot take a CSS variable) and `public/board.svg`
- [x] Every interactive element has a visible keyboard focus ring — one global
      `:focus-visible` rule in `src/index.css`
- [x] Simulated deuteranopia check passes on the state palette

**On that last box.** The picker in the `/styleguide` header applies a real `feColorMatrix`
simulation and keeps the choice in the URL, so a simulation can be linked or screenshotted:

```
http://localhost:5173/styleguide?vision=deuteranopia
```

The state palette now uses conventional hues — green / amber / red / blue — which converge
under deuteranopia exactly as expected. What keeps them apart is lightness (`ok` L30, `warn`
L38, `fault` L45) and, above that, a mandatory icon shape per tone on `StatusBadge` and
`Callout`. Colour is the third signal, never the first. Re-run this check whenever a screen
that signals state is added.

---

## Design: two rebuilds, and where it landed

Worth reading before touching a screen, because the code contains no trace of the first two
and someone will otherwise re-derive them.

**Rebuild 1 (during Phase 2)** replaced the original system with a dark, near-black language
against a reference the project owner supplied: lime accent, Clash Display + Satoshi, hairlines
instead of shadows, pills for every control, a `$ ls ./exercises` terminal line above each page
title, a scrolling marquee on the landing page.

**Rebuild 2 (during Phase 4)** replaced *that*, on the owner's instruction: *"it should be more
professional looking rather than aesthetic… running in white and maybe blue… the user is a
student and teacher, UX is priority."* The references given were
[Tinkercad](https://www.tinkercad.com/) and a second education product.

What that meant in practice:

| Was                                    | Is                                                     |
| -------------------------------------- | ------------------------------------------------------ |
| Near-black ground, lime accent          | White surfaces on a faint grey page, one blue accent    |
| `ok` **was** the brand accent           | Conventional states: green right, amber warn, red wrong |
| Clash Display at 40–76px                | Inter throughout, headings 24–48px                      |
| Pills for inputs *and* buttons          | Pills for buttons; 8px for anything you type into       |
| 11px labels at 0.18em, all caps         | 14px sentence-case labels                               |
| `$ terminal --line` above every title   | Removed                                                 |
| Scrolling marquee of jargon             | Removed                                                 |
| Diagonal contour wash behind sections   | Removed                                                 |
| Dark default                            | Light default; dark kept as a Settings toggle           |

[`design-brief.md`](design-brief.md) is the current contract and it records the history for the
same reason. The rule that decides future calls: *if a change makes the app look more
distinctive at the cost of a student reading a label more slowly, it is the wrong change.*

---

## Phase 2 — Neon, Drizzle & API Foundation ✅

Full schema, dual-driver client, middleware chain, routes, seed.

**Local dev runs on PGlite, not Neon.** `api/db/client.ts` selects its driver from the
environment: Neon HTTP when `DATABASE_URL` is set, PGlite against a local `.pglite/` directory
otherwise. Same schema and same committed migrations either way.

### Definition of Done

- [x] `drizzle-kit generate` and `migrate` run clean against a fresh database
- [x] Seed populates a reset database with no errors — idempotent, verified re-runnable
- [x] No connection string anywhere in `src/` — grepped in source **and in the built bundle**
- [x] A student request for an exercise returns no `golden_netlist` key
- [x] Requesting another student's attempt returns 403, not data
- [ ] CI creates, migrates, seeds and deletes a Neon branch per run — **blocked on Neon**

**The golden netlist has three independent layers**, not one: the `exerciseStudentColumns`
projection, a serializer whitelist, and a response tripwire that scans student-bound JSON for a
`goldenNetlist` key at any depth. That redundancy was found by mutation testing.

**The bundle tripwire earned its keep in Phase 3.** `tests/bundle/client-secrets.test.ts` was
written in Phase 2 with a note saying it was a weaker proof than it looked, because no screen
imported `src/lib/api.ts` yet. The moment screens did, it failed — twice, for two different real
reasons. Both are fixed and both are worth knowing:

1. Importing from the `@shared/contracts` **barrel** dragged `exerciseInstructorSchema` — and
   with it the literal string `goldenNetlist` — into the student bundle. Fixed by adding
   `"sideEffects": ["**/*.css"]` to `package.json`, which lets Rollup drop unused modules.
2. The dev-only golden-netlist scan in `src/lib/api.ts` was guarded *inside* the function, so
   the argument expression `config.allowGoldenNetlist` survived minification as a property
   read. Fixed by moving the `import.meta.env.DEV` check to the call site.

**Untested:** the Neon driver branch has still never executed.

---

## Phase 3 — Authentication ✅

Better Auth 1.7.1 with the Drizzle adapter, behind this project's own contracts.

### Tasks

| #   | Task                                            | State                                                     |
| --- | ----------------------------------------------- | --------------------------------------------------------- |
| 1   | Better Auth + Drizzle adapter, tables migrated  | ✅ `api/db/auth-schema.ts`, migration `0001`               |
| 2   | Handler mounted at `/api/auth/*`                | ✅ **as an explicit allow-list** — see the deviation below |
| 3   | httpOnly, Secure, SameSite=Lax cookies          | ✅ verified on the wire and via `getCookies()`             |
| 4   | Email provider                                  | ✅ transport interface; Resend impl + console impl         |
| 5   | Profile row in the same transaction             | ✅ `api/auth/registration.ts`                              |
| 6   | `/register` with conditional fields             | ✅                                                        |
| 7   | `/login` with remember-me                       | ✅                                                        |
| 8   | `/forgot-password`, `/reset-password`           | ✅                                                        |
| 9   | Email verification, incl. the expired state     | ✅ five distinct outcomes                                  |
| 10  | `AuthProvider` hydrating from `/api/auth/me`    | ✅                                                        |
| 11  | `<ProtectedRoute>` / `<RoleRoute>`              | ✅ plus `<PublicOnlyRoute>`                                |
| 12  | Rate-limit login and reset                      | ✅ `api/middleware/rate-limit.ts`                          |
| 13  | Logout clears cookie and client state           | ✅                                                        |

### Definition of Done

- [x] Full journey works: register → confirm email → login → refresh page → still logged in →
      logout. Driven twice: by curl against the dev server, and by
      `tests/api/auth-journey.test.ts` through the real middleware chain with a real cookie jar
- [x] Every error path shows a readable message, no raw error strings —
      `translateAuthError()` maps every Better Auth code to a sentence written for a student
- [x] Password reset works end to end — request → emailed token → new password → old password
      refused → new one accepted. **Locally**, not on a deployed URL (see Outstanding)
- [x] Direct navigation to `/dashboard` while logged out redirects to login, and returns after
      auth — asserted in `tests/e2e/auth.spec.ts`, in a real browser
- [x] A student navigating to `/teach` sees a proper 403 page, not a crash
- [x] Session cookie is httpOnly and Secure; no token appears in `localStorage` — `HttpOnly`
      and `SameSite=Lax` asserted on the live `Set-Cookie`; `Secure` asserted by recomputing
      the cookie for an https origin through Better Auth's own `getCookies()`, since this
      machine has no TLS; `document.cookie` and both web storages checked in-browser
- [x] `/api/teach/*` returns 403 for a student session even when called directly with curl
- [x] Self-registration cannot produce an instructor — no code, wrong code, and *no configured
      code* all refused, and each leaves no row behind
- [x] **Playwright test covers register/login/logout** — `tests/e2e/auth.spec.ts`, 12 cases in
      real Edge. See the note below on how it is installed without a browser download

### Deviation 1 — the Better Auth handler is not mounted wholesale

Task 2 says "mount the Better Auth handler in Hono at `/api/auth/*`". What is mounted is an
explicit allow-list of this project's own routes, each calling `auth.api.*` underneath. Three
reasons, all security rather than taste:

1. `POST /sign-up/email` would be reachable, and it creates an auth user with no profile row
   and no invite-code check — the two controls this phase exists to add.
2. Better Auth returns `{ token: session.token }` in its sign-in and sign-up bodies. The
   contracts forbid a token in any response body.
3. The wire shapes would be Better Auth's rather than the contracts'.

Nothing is given up: the credential handling, the cookie, the tokens and their expiry are all
still Better Auth's. `api/auth/auth.ts` configures it and `api/routes/auth.ts` is the only
caller. The one thing that crosses the boundary out of the library is the `Set-Cookie` header.

### Deviation 2 — Playwright, with no browser download

Playwright normally pulls ~300 MB of browser binaries per engine. It is installed here with
`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` and pointed at the Edge already on the machine via
`channel: 'msedge'`. Total cost: 14 MB of `playwright-core`.

The trade is one engine rather than three: these tests prove the flows work in a real
Chromium-family browser and say nothing about Firefox or WebKit. Widening that is
`npx playwright install` plus two entries in `projects` — nothing else changes.

```bash
npm run test:e2e     # migrates, seeds, then runs Playwright against both dev servers
npm run test:e2e:ui  # the same, in Playwright's UI mode
```

Two things the suite needs, and neither weakens the thing being tested:

- **An outbox.** `EMAIL_OUTBOX_DIR` puts the email transport into maildir mode, so a test can
  open the link the server genuinely sent instead of being handed a token through a back door.
  The token, its expiry and its single use are all real. It throws on a production-like runtime,
  fenced exactly like `DEV_AUTH`.
- **Raised rate limits.** The suite signs in more than ten times, which is the real limiter's
  per-account ceiling. The limiter itself is proved in `tests/api/auth-boundary.test.ts` against
  its configured values.

One ordering trap cost an hour and is worth writing down: **Playwright starts its `webServer`
before `globalSetup`.** PGlite takes a single writer, so migrating from `globalSetup` opens a
second instance against a directory the API already holds — which corrupts the cluster rather
than failing loudly, and the symptom is every sign-in in the suite failing at once. Migration
and seeding are therefore sequenced in the `test:e2e` script, ahead of Playwright.

`tests/browser/verify.mjs` — the zero-dependency CDP script that stood in for this — has been
**deleted**. Playwright covers all seven of its assertions and more; two implementations of the
same checks is exactly the drift this document keeps warning about.

### What the end-to-end suite found

Both of these were real, and neither was reachable from the API tests — which is the argument
for the box existing at all.

1. **`/register` silently did nothing when submitted.** React Hook Form defaults an untouched
   field to `''`, and `studentNumberSchema.optional()` rejects an empty string. For an
   instructor — who never sees the student-number field — validation failed on a field that was
   not on screen, so the error had nowhere to render and the button appeared dead.
   `blankAsAbsent()` in `shared/contracts/common.ts` is the fix; the register form also gained
   an `onInvalid` branch that says something out loud rather than swallowing an error it cannot
   place. Covered now in the fast tests too.
2. **The three accessibility switches had no accessible name.** Radix renders a switch as a
   `<button>`, and although HTML says a button is labelable, Chrome does not expose a
   `<label for>` as a button's name — screen readers announced them as unlabelled. They now
   carry `aria-labelledby` and `aria-describedby` explicitly.

### Three things worth knowing

**Verification links are single-use, and it took a fix.** Better Auth's verification token is a
stateless HS256 JWT — nothing is stored, so nothing is consumed, and the same link keeps
succeeding until it expires. `api/auth/single-use.ts` writes a replay tombstone. The **order**
matters: verify first, claim second. Claiming first gives a *forged* token a tombstone of its
own, so the second attempt at a link that was never valid reports "already used" instead of
"not valid" — which is the exact distinction this endpoint exists to make, inverted. That bug
was caught in a screenshot and is now covered by a regression test.

**Password-reset tokens are single-use already** (Better Auth stores and deletes them), but it
returns the same `INVALID_TOKEN` for expired, forged and spent. `/reset-password` reads the
row's `expires_at` *before* redeeming so it can tell an expired link — which gets a resend
button — from a forged one, which does not.

**The sign-in failure message deliberately does not follow the plan's wording.** The plan
suggests "That email isn't registered". That is an account-existence oracle, and Better Auth
correctly answers identically for a wrong address and a wrong password. The copy is human
*and* silent about which half was wrong.

---

## Phase 4 — Onboarding & Profile ✅

### Definition of Done

- [x] New user is forced through onboarding exactly once — gated on `profiles.onboarded_at`,
      which is stamped by the last step; asserted across a fresh sign-in, not just in one session
- [x] Joining a class with a valid code creates the enrollment row
- [x] Invalid code shows a helpful error and does not clear the field — three distinct API
      codes (`join_code_not_found`, `already_enrolled`, `validation_failed`) so the screen has
      something specific to say beside the input, and nothing resets the form
- [x] Reduced-motion setting disables all transitions app-wide — asserted in a real browser
      against computed style, not by reading the CSS
- [x] Language toggle switches all Part A strings (no hardcoded English left) — see below

### On "no hardcoded English left"

`src/i18n/` is a real layer, not a stub: `en.ts` is the source of truth, `fil.ts` is typed as
`Catalog` (derived from `keyof typeof en`), so a missing key is a **build error** rather than a
silent English fallback. That is the only way this box can be honestly ticked.

Audited by grep across `src/features` and `src/components` for user-visible literals: zero
remain. The last four were `aria-label`s in primitives (`Breadcrumb`, `Close`, `Progress`,
`Dismiss`) — never seen, always read — and they now go through the catalogue too.

`/styleguide` is deliberately exempt: a development tool that ships to no student.

**Technical vocabulary stays in English in both catalogues** — netlist, breadboard, resistor,
node, rail. Philippine electronics engineering is taught in English, and inventing Tagalog
equivalents would produce a UI whose vocabulary matches nothing the student meets again. The
reasoning is at the top of `fil.ts`.

**Language names are endonyms.** `settings.language.en` is `'English'` in *both* files. This was
a real bug found by the browser check: with it translated, a Filipino speaker looking for
English saw "Ingles".

### The three Phase 2 handoff notes, closed

1. **`setSessionProvider()`** — the real Better Auth provider is installed at module load of
   `api/routes/auth.ts`. The `DEV_AUTH=1` fencing is untouched and still works.
2. **`profiles.preferences`** — added in migration `0001` as `jsonb not null default '{}'`.
   Phase 4's accessibility settings persist into it.
3. **`/api/auth/me` is inside a public prefix** — it applies `requireSession` itself, and so
   does `/api/auth/change-password`. `tests/api/auth-boundary.test.ts` asserts 401 for both
   explicitly, which is the regression that would otherwise ship silently.

### A contract bug found on the way

`profileUpdateRequestSchema` used `preferencesSchema.partial()`. In Zod 4 an optional field
wrapping a `.default()` **still resolves that default** for an absent key — so a patch of one
toggle arrived complete, and the server's merge was silently a *replace*, turning off every
setting the caller had not mentioned. Invisible until a second setting is already on. Fixed
with a separate `preferencesPatchSchema` that carries no defaults, plus an undefined filter in
the merge; covered in `tests/api/onboarding.test.ts`.

---

## What is in the test suite

128 fast tests across 9 files, plus 23 in a real browser. The four Phase 2 files are unchanged;
the rest are:

| File                             | Covers                                                             |
| -------------------------------- | ------------------------------------------------------------------ |
| `tests/api/auth-journey.test.ts` | register → verify → login → refresh → logout, reset, change password, token replay and expiry, and that no token appears in any body |
| `tests/api/auth-boundary.test.ts`| the public-prefix 401s, default-deny, role 403 vs 401, the instructor gate in four shapes, cookie flags, and the rate limiter actually refusing |
| `tests/api/onboarding.test.ts`   | onboarding exactly once, class join and its three failures, preference persistence and merge, and that neither endpoint can write a role |
| `tests/unit/dashboard-library.test.ts` | what the dashboard decides, with no DOM: the status ordering, "resume" versus "start" for an attempt handed in unfinished, per-class counting, and the date rule |
| `tests/e2e/auth.spec.ts`         | the same journeys in a real browser (`npm run test:e2e`): register → confirm → sign in → refresh → sign out, the reset link, the 403, the instructor gate, onboarding once, both languages, reduced motion, and that nothing credential-shaped reaches web storage |
| `tests/e2e/board.spec.ts`        | the landing demo end to end, the reduced-motion stop, the lazy 3D split, and the no-WebGL fallback |
| `tests/e2e/dashboard.spec.ts`    | the featured exercise, the full library and its order, the three row actions, the first-run state in Filipino, and the exercise brief — including that an exercise which is not yours is a designed refusal |

`tests/unit/` is the first suite here that touches no database, which is why `vitest.config.ts`
now carries the same `@`/`@shared` aliases as `vite.config.ts`: a pure module under `src/` has
to resolve the same way in the runner as it does in the browser.

The auth tests drive the **real** session provider — a request carries a cookie Better Auth
issued or it carries nothing. `tests/helpers/auth-harness.ts` is separate from the Phase 2
harness for exactly that reason, and **a test file must not import both**: the Phase 2 harness
installs a header-based impersonator, and whichever module evaluates last wins.

---

## Outstanding — needs an account, not code

1. **Create the GitHub repo and push.** The working tree is on `main` with no commit and no
   remote, left that way so the first commit is yours.

   ```bash
   git add -A
   git commit -m "feat: phases 0-4 — setup, design system, API, auth, onboarding"
   gh repo create breadboard-trainer --private --source=. --push
   ```

2. **Create the Neon project.** `DATABASE_URL` must be the **pooled** string (host contains
   `-pooler`); `DATABASE_URL_DIRECT` the **direct** one. Getting this backwards works locally
   and then exhausts Neon's connection limit the first time a full lab section is on the app.

3. **Connect Vercel**, and set these three:

   | Variable                 | Why                                                             |
   | ------------------------ | --------------------------------------------------------------- |
   | `BETTER_AUTH_SECRET`     | Signs every session and every email token. `openssl rand -base64 32`. The API **refuses to start** without it on a production-like runtime |
   | `INSTRUCTOR_INVITE_CODE` | Without it, instructor sign-up **fails closed** — no faculty accounts, not open ones |
   | `RESEND_API_KEY` + `EMAIL_FROM` | Without both, verification links are written to the server log and nobody receives them. Logged as an error on a production-like runtime |

4. **CI.** Phase 2 task 10's Neon-branch-per-PR action. Worth doing when Neon exists. The
   end-to-end suite runs there unchanged — it already sets `forbidOnly`, one retry and the
   GitHub reporter when `CI` is set — but note it needs Edge or Chrome on the runner, or
   `npx playwright install chromium` and a `channel` swap.

---

## Running it locally

```bash
npm install
npx drizzle-kit migrate          # creates ./.pglite from the committed migrations
npm run db:seed                  # one instructor, three students, one class, two exercises
INSTRUCTOR_INVITE_CODE=let-me-teach-2026 npm run dev
```

Every seeded account signs in with **`breadboard-dev-2026`**:

| Account                       | Role       | Note                                 |
| ----------------------------- | ---------- | ------------------------------------ |
| `reyes@faculty.example.edu`   | instructor | reaches `/teach`                     |
| `cruz@students.example.edu`   | student    | onboarded, enrolled                  |
| `santos@students.example.edu` | student    | onboarded, enrolled, locale `fil`    |
| `dizon@students.example.edu`  | student    | **not onboarded** — use for `/onboarding` |

Registering a new account prints the verification link to the terminal running the API, framed
and on its own line. There is no `RESEND_API_KEY` here, so the console transport is what runs.

**Do not `taskkill /F` the API process.** PGlite is a real Postgres and a hard kill can leave
the cluster in a state it refuses to reopen. If that happens: `rm -rf .pglite`, migrate, seed.

---

## The dashboard

`/dashboard` is no longer the placeholder Phase 3 left behind. It now shows, all from
`GET /api/classes` and `GET /api/exercises`:

- **The exercise to open now**, full width, with the board it builds. "Resume" only when there
  is an attempt left open — an attempt submitted without passing leaves the exercise in
  progress with nothing to reopen, and the button says "Start".
- **Three counts and the ratio they make**, over a hairline bar. Not progress over time; no
  endpoint produces one.
- **The whole library.** This is the part that was missing: before it, a student with six
  assigned exercises could reach exactly one of them from this screen. Rows, not cards, so the
  layout is the same at one exercise and at twenty; unfinished first, finished last; the
  featured row marked rather than removed, so the list is always the complete set.
- **Per-class completion** on each class card, counted from this student's own exercise list
  rather than the class's published count — the two answer different questions.

The decisions live in `src/features/dashboard/library.ts` and are tested without a DOM.

`/lab/:exerciseId` exists now too, as **the exercise brief**: the objective, the parts, the
attempt count and a bare board, with the workspace itself named as Phase 10. It was built
because the dashboard's primary action pointed at the 404, which is the worst thing a
"Start this exercise" button can do — it makes every honest claim beside it look like a mock.
The guard is the API's: `GET /api/exercises/:id` refuses an unpublished exercise and one
belonging to a class you are not in, and the screen only reports the answer.

---

## Not started

Phases 5 onward. `src/board/`, `src/render/` and the diagnostics features are still empty.

Registered routes: `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`,
`/verify-email`, `/onboarding`, `/dashboard`, `/lab/:exerciseId`, `/settings`, `/teach`,
`/styleguide`, and the 404.

`/teach` is still a **deliberate placeholder** — Phase 6 builds it. It exists because a role
guard needs something to guard. It is not a mock: it says plainly which phase fills it in, and
the `requireRole('instructor')` behind it is real.
