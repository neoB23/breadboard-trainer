# Smart Breadboard Diagnostic Trainer — Web Build Documentation

**Version:** 1.1
**Scope:** Full web replacement of the hardware trainer
**Structure:** Part A (Student Shell) → Part B (Diagnostic Engine) → Part C (Assignments, Grading & AI Coach). A part is not started until the previous one is complete and polished.

---

## 0.0 What Changed in Version 1.1

Three capabilities were added, and one contradiction that shipped in 1.0 was resolved. Everything
in Parts A and B stands unless a line below says otherwise.

### Added — teacher-created tasks carry real policy

In 1.0 an instructor could publish an exercise and that was the whole of it. There was no due
date, no time limit, no attempt cap, and no way to say "this one is an exam, no help." Version 1.1
introduces the **assignment** — an exercise handed to a class with a deadline, an optional
countdown timer, an attempt limit, a late policy, a help policy, and a grading scheme. Section 2.1
holds the schema; Phase 22 builds it.

### Added — automatic grading

Because the instructor captures the correct circuit in Learn Mode, the system already knows the
right answer before the student starts. A score therefore does not need a human. Phase 23 turns
the diagnostic report into a rubric-weighted mark with partial credit, applies late and hint
penalties, and gives the instructor an override with an audit trail.

### Added — the AI Coach

A language model that reads the diagnostic result and writes it back in plain, encouraging
language: what the student got right, what is wrong, and one question that points them at it.
**Its timing differs by mode, and that difference is the whole design:**

| Mode | When the Coach speaks |
|---|---|
| **Free Build** (`/sandbox`, ungraded practice) | Immediately, every time the student presses Run |
| **Assigned task** (graded, from a teacher) | Only after submission, and only once the assignment's release rule allows it |

Feedback during a graded task is feedback on an answer the student is being marked on. Releasing
it early is not a feature; it is the system grading a student on work it already corrected for
them. Phase 25 builds that gate, and it is enforced on the server — never by hiding text in the
browser.

### Resolved — the Tier 2 comparator cannot run in the browser

Version 1.0 asserted two rules that cannot both hold:

- **Non-negotiable 3** — the golden netlist never reaches a student client.
- **Non-negotiable 4** — the diagnostic engine runs entirely in the browser.

The Tier 2 comparator (Phase 14) works by comparing the student's netlist against the golden
netlist. If it runs in the browser, the golden netlist must be shipped to the browser, and any
student who opens the network tab has the answer key. The two rules are in direct conflict, and
1.0 never said which one wins.

**Rule 3 wins.** The engine splits by tier:

| Tier | Where it runs | Needs the answer key? |
|---|---|---|
| **Tier 1** — intrinsic rules (Phase 13) | Browser, live on every placement | No. Shorts, floating leads and reversed polarity are visible from the student's board alone |
| **Tier 2** — comparator (Phase 14) | Server, on an explicit scan or submit | Yes. The golden netlist never leaves the server |
| **DC solver** (Phase 16) | Browser | No |

The student's browser keeps its instant, zero-latency proactive warnings, which is what Phase 13
was for. Tier 2 becomes a deliberate act — the student presses **Check my work**, or submits — and
that is a better interaction anyway, because a comparator firing on every dragged lead was always
going to feel like nagging.

**This costs the accuracy numbers nothing.** The Phase 20 evaluation harness imports the
comparator directly as a pure function and runs it headless in Node. It never goes over HTTP.
Section 5's rule that every diagnostic rule is a pure, unit-tested function is unchanged, and so
are the reproducibility claims that rest on it.

---

## 0. Reading This Document

Phases are deliberately small — 3 to 7 working days each. Every phase has a **Definition of Done (DoD)**. A phase is not finished until every DoD box is checked. Do not start the next phase with unchecked boxes; in a capstone the compounding of half-finished phases is the single most common cause of a failed defense.

Part A produces a **complete, usable, empty application** — students can register, log in, see their class, open an exercise, and land in a workspace that has every panel, button, and layout in place. The 3D board is a static placeholder. This is intentional. When Part A ships you can put it in front of real students and run a usability pre-test before a single line of diagnostic logic exists.

---

## 1. System Overview

### 1.1 Stack

| Layer | Choice |
|---|---|
| Build tool | Vite |
| Framework | React 18 + TypeScript (strict) |
| 3D | Three.js via React Three Fiber + drei |
| State | Zustand |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Neon (serverless Postgres) |
| ORM / migrations | Drizzle ORM + drizzle-kit |
| API layer | Hono, deployed as Vercel Functions |
| Auth | Better Auth (self-hosted, Drizzle adapter) |
| File storage | Cloudflare R2 (or Vercel Blob) |
| Routing | React Router v6 |
| Forms | React Hook Form + Zod |
| Testing | Vitest + Testing Library + Playwright |
| Offline | vite-plugin-pwa + Dexie (IndexedDB) |
| Hosting | Vercel (SPA + API), Neon (database) |

### 1.1.1 Why This Shape

Neon is *only* Postgres. It has no auth service, no storage, no client SDK, and no policy layer you can safely expose to a browser. **The browser must never hold a Neon connection string.** That single fact forces an API tier into the architecture, which Supabase would have let you skip.

This is not a downside for your project — it is arguably an upside. Your most dangerous leak (the golden netlist reaching a student client) becomes structurally impossible, because no client ever queries the database at all. The API handler simply never selects that column for a student role. You trade a small amount of setup work for a much simpler security story.

What you gain over Supabase: **database branching**. Neon can fork the entire database per pull request and per CI run, which means your Phase 20 evaluation harness runs against a clean, isolated, seeded database every time without teardown scripts. For a project whose thesis rests on reproducible accuracy numbers, that is genuinely valuable.

What you must build yourself: authentication (Phase 3 grows by ~2 days) and file uploads (folded into Phase 6).

### 1.2 Folder Structure

```
src/
  app/              # router, providers, layout shells
  features/
    auth/           # login, register, session
    profile/        # user settings
    classes/        # class enrollment, roster
    exercises/      # exercise browse + detail
    workspace/      # the lab environment
    diagnostics/    # Part B: rules, comparator, faults
    telemetry/      # event logging
  board/            # PURE LOGIC — no React, no Three.js
    geometry.ts     # hole addressing
    nodes.ts        # union-find node collapse
    netlist.ts      # graph extraction
    solver/         # MNA DC solver
  render/           # R3F components (visual only)
  components/ui/    # shadcn primitives
  lib/              # api client, utils, constants
  types/            # shared TypeScript types
api/
  index.ts          # Hono app, mounted as a Vercel Function
  routes/           # auth, classes, exercises, attempts, events
  db/
    schema.ts       # Drizzle schema — single source of truth
    migrations/     # generated by drizzle-kit, committed
    client.ts       # Neon serverless driver + Drizzle
  middleware/       # session, role guards, error handling
shared/
  contracts/        # Zod schemas shared by api/ and src/
tests/
  fixtures/         # seeded fault corpus (Part B)
```

`shared/contracts/` holds Zod schemas imported by *both* the API and the frontend, so a route's request and response shapes are typed end to end without code generation. Define each endpoint's contract there before writing the handler.

**The `board/` directory must never import React or Three.js.** This is the single most important architectural rule in the project. It is what makes your logic unit-testable, and your accuracy metrics depend on being able to run thousands of headless test cases in seconds.

### 1.3 Route Map

| Route | Access | Purpose |
|---|---|---|
| `/` | public | Landing / redirect |
| `/login` | public | Sign in |
| `/register` | public | Sign up |
| `/forgot-password` | public | Reset request |
| `/reset-password` | token | Set new password |
| `/onboarding` | authed | First-run profile setup |
| `/dashboard` | student | Class list, assigned exercises, progress |
| `/exercises` | student | Browsable exercise library |
| `/lab/:exerciseId` | student | **The workspace** |
| `/results/:attemptId` | student | Post-attempt summary |
| `/settings` | authed | Profile, accessibility, language |
| `/teach` | instructor | Instructor home |
| `/teach/classes/:id` | instructor | Roster + class analytics |
| `/teach/exercises` | instructor | Exercise authoring list |
| `/teach/exercises/:id/capture` | instructor | **Learn Mode** |
| `/teach/reports/:classId` | instructor | Intervention analytics |
| `/sandbox` | student | **Free Build** — ungraded practice, immediate AI feedback |
| `/assignments/:id` | student | Task detail: policy, countdown, attempts left, start |
| `/teach/classes/:id/assignments` | instructor | Tasks assigned to this class |
| `/teach/assignments/new` | instructor | **The task builder** — deadline, timer, attempts, grading |
| `/teach/assignments/:id/edit` | instructor | Edit an assigned task |
| `/teach/assignments/:id/submissions` | instructor | Gradebook, overrides, release feedback |

---

## 2. Data Model

Create this in full during Phase 2. Adding columns later is cheap; restructuring relationships mid-project is not.

Author it in `api/db/schema.ts` using Drizzle, then generate migrations with `drizzle-kit generate`. The SQL below is the semantic target — Drizzle will emit equivalent DDL. Better Auth creates its own `user`, `session`, `account`, and `verification` tables; `profiles.id` references Better Auth's `user.id`.

```sql
-- Extends Better Auth's user table
create table profiles (
  id text primary key references "user"(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('student','instructor','admin')),
  student_number text,
  section text,
  locale text default 'en',
  onboarded_at timestamptz,
  created_at timestamptz default now()
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid references profiles(id) not null,
  name text not null,
  code text unique not null,          -- 6-char join code
  term text,
  archived boolean default false,
  created_at timestamptz default now()
);

create table enrollments (
  class_id uuid references classes(id) on delete cascade,
  student_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (class_id, student_id)
);

create table exercises (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id),
  class_id uuid references classes(id),
  title text not null,
  objective text,
  difficulty int check (difficulty between 1 and 5),
  schematic_url text,
  bom jsonb not null default '[]',    -- allowed components
  golden_netlist jsonb,               -- captured in Learn Mode
  netlist_version int default 1,
  published boolean default false,
  created_at timestamptz default now()
);

create table attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) not null,
  exercise_id uuid references exercises(id) not null,
  started_at timestamptz default now(),
  submitted_at timestamptz,
  completed boolean default false,
  final_state jsonb,                  -- board snapshot
  hints_used int default 0,
  faults_encountered int default 0,
  faults_self_resolved int default 0,
  duration_ms int
);

create table events (
  id bigserial primary key,
  attempt_id uuid references attempts(id) on delete cascade,
  ts timestamptz default now(),
  type text not null,                 -- place|remove|move|scan|fault|hint|resolve|submit
  payload jsonb
);
```

**Authorization model.** With Neon there is no RLS-as-a-service and no client-side database access, so **the API layer is the entire security boundary**. Enforce it in three places:

1. **Session middleware** — every route except auth resolves a session or returns 401.
2. **Role middleware** — `requireRole('instructor')` on all `/api/teach/*` routes.
3. **Ownership checks in handlers** — a student reading `attempts/:id` must own it; an instructor reading `classes/:id` must own it. Write a `assertOwns()` helper and call it in every handler that takes an ID.

**The golden netlist rule:** define two Drizzle select projections for exercises — `exerciseStudentColumns` (omits `golden_netlist`) and `exerciseInstructorColumns` (includes it). Student routes may only use the former. Never `select()` the whole exercises table in a student-facing handler. Add a unit test asserting that no student endpoint response object contains a `golden_netlist` key.

Also add Postgres RLS as defence in depth if you have time, using `SET LOCAL app.user_id` per request — but the API checks are what actually protect you, and they must exist regardless.

---

## 2.1 Assignments, Grading and AI Feedback

Added in version 1.1. Author these alongside Section 2 in `api/db/schema.ts`; they are created for
real in Phase 22. `exercises` stays exactly as it is — an exercise is a reusable piece of
courseware, and an **assignment** is one act of handing it to a class under a policy. Keeping them
apart is what lets the same exercise be untimed practice for one section and a timed quiz for
another.

```sql
-- One exercise, handed to one class, under one policy. This is "the task".
create table assignments (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid references exercises(id) not null,
  class_id uuid references classes(id) on delete cascade not null,
  created_by text references profiles(id) not null,

  title text,                        -- optional override of the exercise title
  instructions text,                 -- what this class in particular must do

  -- availability window ------------------------------------------------
  opens_at timestamptz,              -- null = open the moment it is published
  due_at timestamptz,                -- THE DEADLINE. null = no deadline
  closes_at timestamptz,             -- hard close. null = never closes
  late_policy text not null default 'blocked'
    check (late_policy in ('blocked','accepted','penalized')),
  late_penalty_pct int not null default 0,   -- % of total, per day late

  -- timer ---------------------------------------------------------------
  time_limit_s int,                  -- per-attempt countdown. null = untimed
  timer_mode text not null default 'none'
    check (timer_mode in ('none','soft','hard')),
  -- none = no timer shown
  -- soft = counts down and flags the overrun, does not stop the student
  -- hard = auto-submits whatever is on the board when it reaches zero

  -- attempts -------------------------------------------------------------
  max_attempts int,                  -- null = unlimited
  keep_score text not null default 'highest'
    check (keep_score in ('highest','latest','first','average')),

  -- help policy: how much the trainer helps DURING the task --------------
  live_diagnostics text not null default 'tier1'
    check (live_diagnostics in ('off','tier1','full')),
  -- off   = exam mode. No warnings at all until submit
  -- tier1 = intrinsic warnings only (shorts, floating leads). No answer-key comparison
  -- full  = tier 1 warnings plus on-demand "Check my work" against the golden netlist
  hints_allowed boolean not null default true,
  max_hints int,                     -- null = unlimited
  hint_penalty_pts numeric(6,2) not null default 0,   -- deducted per hint taken

  -- grading ---------------------------------------------------------------
  grading_mode text not null default 'auto'
    check (grading_mode in ('auto','auto_with_review','manual')),
  total_points numeric(6,2) not null default 100,
  pass_threshold_pct numeric(5,2) not null default 70,
  rubric jsonb not null default '{}',        -- see "The rubric" below

  -- AI Coach ---------------------------------------------------------------
  ai_feedback boolean not null default true,
  feedback_release text not null default 'after_due'
    check (feedback_release in ('immediate','after_submit','after_due','manual')),
  -- immediate    = free-build behaviour. Only legitimate on ungraded practice
  -- after_submit = the moment this student submits (safe when attempts are capped at 1)
  -- after_due    = when due_at passes, for everyone at once. THE DEFAULT
  -- manual       = when the instructor presses Release

  published boolean not null default false,
  created_at timestamptz default now()
);

-- attempts gains three columns. A null assignment_id is a free build.
alter table attempts add column assignment_id uuid references assignments(id) on delete set null;
alter table attempts add column expires_at timestamptz;   -- start + time_limit_s, server-computed
alter table attempts add column auto_submitted boolean not null default false;

-- One row per graded attempt. Separate from attempts because a grade has its own
-- lifecycle: it is computed, it may be overridden, and both facts must survive.
create table grades (
  attempt_id uuid primary key references attempts(id) on delete cascade,
  assignment_id uuid references assignments(id) on delete cascade not null,

  auto_score numeric(6,2) not null,
  auto_breakdown jsonb not null,     -- per-rubric-line detail, shown to the student
  penalty_late numeric(6,2) not null default 0,
  penalty_hints numeric(6,2) not null default 0,
  final_score numeric(6,2) not null,
  max_score numeric(6,2) not null,
  passed boolean not null,
  graded_at timestamptz default now(),

  override_score numeric(6,2),       -- null unless a human intervened
  override_note text,
  overridden_by text references profiles(id),
  overridden_at timestamptz
);

-- One row per generated coaching message. The visibility gate lives here.
create table ai_feedback (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid references attempts(id) on delete cascade not null,
  mode text not null check (mode in ('free_build','assignment')),
  status text not null default 'queued'
    check (status in ('queued','ready','failed','skipped')),

  -- THE GATE. Null means "generated, but nobody may read it yet".
  -- Every read path filters on visible_at <= now(). See Phase 25.
  visible_at timestamptz,

  digest jsonb not null,             -- the deterministic input, archived verbatim
  strengths jsonb,                   -- [{ id, text }]
  issues jsonb,                      -- [{ faultId, text, question }]
  next_step text,

  model text,                        -- e.g. 'claude-opus-5'
  prompt_version text,               -- bump when the system prompt changes
  input_tokens int,
  output_tokens int,
  grounding_ok boolean,              -- did the output pass the grounding check?
  fell_back boolean not null default false,   -- true = deterministic text was served
  created_at timestamptz default now()
);

create index assignments_class_idx on assignments(class_id);
create index assignments_due_idx on assignments(due_at) where published;
create index attempts_assignment_idx on attempts(assignment_id);
create index grades_assignment_idx on grades(assignment_id);
create index ai_feedback_attempt_idx on ai_feedback(attempt_id);
```

### The rubric

`assignments.rubric` is five weighted lines. Every one of them is computed from data the system
already holds, which is what makes the grade reproducible — the same board submitted twice scores
identically, and a panelist can be shown exactly why.

| Line | Default weight | Computed from |
|---|---|---|
| Circuit correctness | 60 | Tier 2 comparator edit distance against the golden netlist |
| Component selection | 10 | Right parts from the BOM, values within tolerance |
| Polarity and orientation | 10 | Tier 1 polarity rules, IC notch orientation |
| No unsafe conditions | 10 | Zero blocking faults (dead short across the rails) at submit |
| Process | 10 | Hints taken, faults the student resolved without help |

Weights are per-assignment and must sum to `total_points`. An instructor who wants plain
right-or-wrong sets correctness to 100 and the rest to 0.

**Partial credit on the correctness line** is the one piece of real arithmetic:

```
correctness = clamp(0, 1, 1 - (editDistance / editBudget))
editBudget  = max(2, ceil(goldenEdgeCount * 0.25))
```

A perfect match scores full. Each edit the comparator needs costs a fraction. Past the Phase 14
depth cap of 4 the comparator returns "substantially different" rather than a diagnosis, and that
scores zero on this line — the system must not invent a partial mark out of a comparison it could
not actually make.

### Two rules the schema alone will not enforce

1. **A `feedback_release` of `immediate` on a graded assignment is a cheating channel.** The
   authoring form warns on it, and the API rejects `immediate` release combined with a
   `grading_mode` of `auto` and a `max_attempts` above 1. That pairing lets a student submit, read
   the correction, and resubmit until the mark is full.
2. **A `live_diagnostics` of `full` sends fault reports derived from the answer key during the
   attempt.** It never sends the key itself, so nothing leaks, but it is real help and should cost
   the student something. Pair it with `hint_penalty_pts`, or reserve it for practice assignments.

---

## 2.9 Amendments to Parts A and B

Version 1.1 changes seven things in phases that are already written. Each is small, and each is
much cheaper to do in its original phase than to retrofit.

| Phase | Amendment |
|---|---|
| **2** — API foundation | Add the Section 2.1 tables to the schema now. Creating four tables in the first migration costs nothing; adding them after attempts exist means backfilling. Extend the golden-netlist response-shape test to run over every route, not a list of routes |
| **5** — Student dashboard | The dashboard groups by **assignment**, not by exercise. Each card carries a due date, a countdown when one is within 48 hours, attempts remaining, and the score once released. Add a Free Build entry point beside the assigned work |
| **6** — Instructor shell | Add the assignment list and the task-builder form as a **shell** here: every field rendered and validated, saving to the real table, with nothing enforced yet. Phase 22 wires enforcement. Building the form early means the Phase 8 usability pre-test can put it in front of a real instructor, which is exactly the feedback that is expensive to get late |
| **7** — Workspace shell | The header timer becomes a **countdown** when the attempt has an `expires_at`, and stays an elapsed clock otherwise. Design both states now. Add the feedback panel's three withheld states from Phase 25 as static layouts |
| **13/14** — Diagnostics | Tier 1 stays in the browser. **Tier 2 moves to the API** behind `POST /api/attempts/:id/scan`, per Section 0.0. The comparator itself is unchanged and still a pure function; only its call site moves |
| **17** — Telemetry | Add event types `assign_start`, `timer_expire`, `submit_auto`, `grade`, `ai_request`, `ai_fallback`, `feedback_view`. Fault-isolation time must remain computable for the control group, which has no AI Coach at all |
| **20** — Evaluation harness | Unchanged, and deliberately so. It imports the comparator directly and never calls the API or the model. Add a second harness for the **grader**: the same 150 fixtures, asserting that scores are deterministic and monotonic in edit distance |

---

## 2.10 What Phase 21 Now Measures

The pilot gains a third arm. The comparison that matters is no longer one contrast but two, and
they answer different questions.

| Group | Diagnostics | AI Coach | Answers |
|---|---|---|---|
| Control | Off — pass/fail only | Off | Baseline: how long does fault isolation take unaided? |
| Experimental A | On | Off | Does deterministic diagnosis reduce isolation time? |
| Experimental B | On | On | Does plain-language coaching add anything on top? |

The ≥40% isolation-time claim belongs to **A against control**. That claim rests on the
deterministic engine and is unaffected by anything in Part C, which is precisely why the AI Coach
was kept out of the diagnostic path. B against A is a separate, smaller, and honestly reported
result about presentation.

**Feedback release must be identical across all three groups** during the pilot, or the groups
were not doing the same task. Set every pilot assignment to `after_due`.

---

# PART A — Student Shell

Goal: a polished, complete, empty application.

---

## Phase 0 — Project Setup
**Duration:** 2 days

**Tasks**
1. `npm create vite@latest` — React + TypeScript template
2. Enable `strict: true` and `noUncheckedIndexedAccess` in tsconfig
3. Install Tailwind, initialize shadcn/ui
4. Configure ESLint + Prettier, add pre-commit hook (husky + lint-staged)
5. Set up path aliases (`@/features`, `@/board`)
6. Initialize git, create GitHub repo, protect `main`
7. Create the `api/` workspace with Hono; add a `GET /api/health` route
8. Configure `vercel.json` to route `/api/*` to the function and everything else to the SPA
9. Configure the Vite dev proxy so `/api` hits the local Hono server — you want a single origin in dev and prod, which removes CORS from the project entirely
10. Create the Neon project; record both the **pooled** and **direct** connection strings
11. Connect Vercel, verify preview deploys on PR
12. Create `.env.example`, add `.env` to `.gitignore`

**Connection string rule:** use the **pooled** string (host contains `-pooler`) for the API at runtime, and the **direct** string for drizzle-kit migrations. Serverless functions open a connection per invocation; without pooling, one lab section of 35 students will exhaust Neon's connection limit.

**DoD**
- [ ] `npm run dev` serves a styled page
- [ ] `GET /api/health` returns 200 in local dev and on the deployed preview
- [ ] `npm run build` passes with zero TS errors in both `src/` and `api/`
- [ ] A pushed branch produces a working Vercel preview URL
- [ ] Committing badly formatted code is blocked by the hook

---

## Phase 1 — Design System
**Duration:** 3 days

Do this *before* building any screen. Retrofitting a design system across 15 finished pages costs a week you don't have.

**Tasks**
1. Define color tokens in `tailwind.config.ts`: background, surface, border, text-primary, text-muted, and five semantic states — `ok`, `warn`, `fault`, `info`, `neutral`
2. Pick two typefaces (one UI sans, one monospace for node IDs and values). Set a type scale: 12/14/16/20/24/32
3. Define spacing scale and a single border-radius value used everywhere
4. Build the base set: Button, Input, Select, Card, Badge, Dialog, Toast, Tooltip, Skeleton, EmptyState, Spinner
5. Build `<AppShell>`: header with logo + user menu, optional sidebar, main content slot
6. Build `<PageHeader>`: title, subtitle, breadcrumb, action slot
7. Create `/styleguide` route rendering every component in every state

**Critical constraint:** the `fault` color must be distinguishable from `ok` for red-green colorblind users. Do not encode fault state by color alone anywhere in this app — every fault indicator carries an icon or a text label. Your ISO 25010 accessibility score depends on this and it is trivially cheap now, expensive later.

**DoD**
- [ ] `/styleguide` renders all components in default, hover, focus, disabled, loading, and error states
- [ ] No hardcoded hex color appears in any component file
- [ ] Every interactive element has a visible keyboard focus ring
- [ ] Simulated deuteranopia check passes on the state palette

---

## Phase 2 — Neon, Drizzle & API Foundation
**Duration:** 4 days

**Tasks**
1. Install `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`
2. Author the full schema from Section 2 in `api/db/schema.ts`
3. Create `api/db/client.ts` — Neon HTTP driver wrapped in Drizzle, reading the pooled connection string
4. Generate and apply the first migration; **commit the migration files** and never edit the database by hand
5. Define the two exercise projections: `exerciseStudentColumns` and `exerciseInstructorColumns`
6. Build the Hono middleware chain: error handler → session resolver → role guard
7. Write the `assertOwns()` helper
8. Write a seed script: 1 instructor, 3 students, 1 class, 2 exercises
9. Create the frontend API client in `src/lib/api.ts` — a thin typed `fetch` wrapper that reads Zod contracts from `shared/contracts/`, sends credentials, and normalizes errors
10. Set up **Neon branching in CI**: each PR run forks the database, migrates, seeds, tests, and discards

**Neon branching setup** is worth the hour it costs. `neonctl branches create` in your GitHub Action gives every test run an isolated database seeded from scratch. This is what makes your Phase 20 accuracy numbers reproducible on demand, which is exactly the claim a panel will probe.

**DoD**
- [ ] `drizzle-kit generate` and `migrate` run clean against a fresh Neon branch
- [ ] Seed script populates a reset database with no errors
- [ ] No Neon connection string exists anywhere in `src/` — grep the bundle to confirm
- [ ] Requesting an exercise as a student returns an object with no `golden_netlist` key (asserted in a test)
- [ ] Requesting another student's attempt returns 403, not data
- [ ] CI creates, migrates, seeds, and deletes a Neon branch per run

---

## Phase 3 — Authentication
**Duration:** 6 days

Longer than it would be on a managed auth service — this is the main cost of choosing Neon. Budget for it honestly.

**Tasks**
1. Install Better Auth with the Drizzle adapter; generate and migrate its tables
2. Mount the Better Auth handler in Hono at `/api/auth/*`
3. Configure **httpOnly, Secure, SameSite=Lax session cookies**. Do not store tokens in `localStorage` — an XSS bug would hand over every session
4. Wire an email provider (Resend free tier) for verification and password reset
5. Extend registration to create the linked `profiles` row in the **same transaction** as the auth user — a half-created account is a support nightmare
6. `/register` — full name, email, password, role selector, student number (conditional on role). Zod validation, inline field errors
7. `/login` — email/password, "remember me", link to reset
8. `/forgot-password` and `/reset-password` flows
9. Email verification handling — including the "you clicked an expired link" state
10. `AuthProvider` with Zustand hydrating from `GET /api/auth/me` on load
11. `<ProtectedRoute>` and `<RoleRoute role="instructor">` wrappers
12. Rate-limit login and password-reset endpoints (simple in-memory or Upstash counter)
13. Logout clearing both cookie and client state

**Instructor accounts:** do not let anyone self-select the instructor role in production. Either gate it behind an invite code or have an admin promote accounts. Leaving it open means any student can read every golden netlist by registering as faculty — this defeats your entire system and a panelist will try it.

**Polish requirements** (these are what students actually feel):
- Loading state on every submit button; double-submit impossible
- Password field has a show/hide toggle
- Error messages are human: "That email isn't registered" not "AuthApiError: invalid_credentials"
- Enter key submits from any field
- After login, redirect to the page they originally requested, not always `/dashboard`
- Auth pages render correctly at 360px width

**DoD**
- [ ] Full journey works: register → confirm email → login → refresh page → still logged in → logout
- [ ] Every error path shows a readable message, no raw error strings
- [ ] Password reset works end to end on the deployed URL
- [ ] Direct navigation to `/dashboard` while logged out redirects to login, and returns after auth
- [ ] A student navigating to `/teach` sees a proper 403 page, not a crash
- [ ] Session cookie is httpOnly and Secure; no token appears in `localStorage`
- [ ] `/api/teach/*` returns 403 for a student session even when called directly with curl
- [ ] Self-registration cannot produce an instructor account
- [ ] Playwright test covers register/login/logout

---

## Phase 4 — Onboarding & Profile
**Duration:** 3 days

**Tasks**
1. `/onboarding` — 3 steps max: confirm name and student number → join a class by code → short "how this tool works" screen
2. Class join by 6-character code, with validation and a clear "code not found" state
3. Redirect to onboarding whenever `onboarded_at` is null
4. `/settings` — edit name, change password, language toggle (EN / Filipino), accessibility toggles: high contrast, reduced motion, larger text
5. Persist accessibility preferences to `profiles` and apply on load

**Note:** wire the accessibility toggles to real CSS now, even with only three screens to affect. Adding them after the 3D workspace exists means auditing every Three.js material and animation.

**DoD**
- [ ] New user is forced through onboarding exactly once
- [ ] Joining a class with a valid code creates the enrollment row
- [ ] Invalid code shows a helpful error and does not clear the field
- [ ] Reduced-motion setting disables all transitions app-wide
- [ ] Language toggle switches all Part A strings (no hardcoded English left)

---

## Phase 5 — Student Dashboard
**Duration:** 4 days

**Tasks**
1. `/dashboard` — enrolled classes, assigned exercises grouped by status (not started / in progress / completed), a small progress summary
2. `<ExerciseCard>` — title, difficulty dots, objective line, status badge, last attempt time, primary action button
3. `/exercises` — browsable library with search and difficulty filter
4. Exercise detail modal: objective, schematic image, bill of materials, estimated time, "Start" / "Resume"
5. `/results/:attemptId` — placeholder layout with the real sections stubbed (duration, faults encountered, faults self-resolved, hints used)
6. Empty states for: no classes joined, no exercises assigned, no attempts yet
7. Skeleton loaders on every data fetch

**DoD**
- [ ] Dashboard renders correctly for a brand-new account with zero data
- [ ] Every list has a designed empty state — no blank regions
- [ ] Nothing shifts layout when data loads (skeletons match final dimensions)
- [ ] Works at 360px, 768px, and 1440px
- [ ] Tab order through the dashboard is logical

---

## Phase 6 — Instructor Shell
**Duration:** 4 days

Build the instructor side thin here — enough to author and assign exercises. Analytics come in Part B once telemetry exists.

**Tasks**
1. `/teach` — owned classes, quick stats, create-class action
2. Create class: name, term, auto-generated join code with copy button
3. `/teach/classes/:id` — roster table, remove student, regenerate code
4. `/teach/exercises` — list, create, edit metadata (title, objective, difficulty, BOM, schematic upload), publish toggle
   - Uploads go to Cloudflare R2 via a **presigned URL issued by the API** — the browser never holds R2 credentials. Validate content type and cap file size server-side before issuing the URL
5. `/teach/exercises/:id/capture` — **Learn Mode shell only**: the layout, instructions panel, and a disabled "Capture Netlist" button. Wiring comes in Phase 12
6. `/teach/reports/:classId` — layout with placeholder cards

**DoD**
- [ ] Instructor can create a class, publish an exercise, and a student in that class sees it on their dashboard
- [ ] Unpublished exercises are invisible to students (verified at the API level, not just the UI)
- [ ] Schematic upload via presigned URL works; R2 credentials never reach the client
- [ ] Roster shows real enrolled students

---

## Phase 7 — Workspace Shell
**Duration:** 5 days

The full lab layout with a static, non-interactive board. This is the last Part A phase and the most important one to get right, because this screen is where students spend 95% of their time.

**Layout**
```
┌──────────────────────────────────────────────────┐
│ Exercise title | timer | Help | Submit           │
├────────────┬────────────────────────┬────────────┤
│ Components │                        │ Feedback   │
│   tray     │      3D canvas         │   panel    │
│            │                        │            │
│ (BOM list) │  [static board mesh]   │ (empty     │
│            │                        │  state)    │
├────────────┴────────────────────────┴────────────┤
│ Objective strip | schematic toggle | hint button │
└──────────────────────────────────────────────────┘
```

**Tasks**
1. Three-column responsive layout; panels collapsible below 1024px
2. R3F canvas with orthographic camera, constrained OrbitControls (polar angle limited to the upper hemisphere, zoom clamped, pan bounded)
3. Static breadboard mesh — correct 830-point proportions, visible hole grid, center channel, four power rails, printed row labels. **Visual only; no interaction yet**
4. Components tray listing the exercise BOM with counts (drag not yet implemented)
5. Feedback panel with its empty state: "Start building. I'll check your work as you go."
6. Header: exercise title, elapsed timer, help, submit (disabled)
7. Schematic overlay toggle
8. Attempt creation on entry; resume an in-progress attempt if one exists
9. WebGL-unsupported fallback screen

**Performance gate:** the static scene must hold 60fps on a mid-range laptop with integrated graphics. If it doesn't now, it certainly won't with 20 components and live diagnostics. Merge the hole geometry into a single instanced mesh rather than 830 separate meshes.

**DoD**
- [ ] Board is visually recognizable as an 830-point breadboard with legible row labels
- [ ] Camera cannot be moved to a confusing or below-board angle
- [ ] 60fps sustained on integrated graphics
- [ ] Layout usable at 1024px; panels collapse gracefully below that
- [ ] Leaving and returning to `/lab/:id` resumes the same attempt
- [ ] Reduced-motion setting disables camera easing

---

## Phase 8 — Polish & Usability Pre-Test
**Duration:** 4 days

**This phase is why Part A exists.** Run it before touching diagnostics.

**Tasks**
1. Audit every screen against the styleguide; fix inconsistencies
2. Verify every loading, empty, and error state
3. Keyboard-only pass through the entire app
4. Screen-reader pass on auth and dashboard
5. Add global error boundary and a designed 404
6. Lighthouse: performance, accessibility, best practices — target ≥90 on accessibility
7. **Run a 5-user usability test** with actual students: register, join a class, open an exercise, describe what they expect to happen
8. Log every finding; fix all severity-1 and severity-2 issues before Part B

**DoD**
- [ ] Zero console errors or warnings in production build
- [ ] Lighthouse accessibility ≥ 90
- [ ] All 5 test users complete registration → workspace unaided
- [ ] Findings documented in `docs/usability-pretest-1.md` with fixes marked
- [ ] Tagged release `v0.1-shell` deployed

**Deliverable for your paper:** this pre-test is a legitimate methodology chapter section — formative evaluation preceding summative ISO 25010 evaluation. Document it properly.

---

# PART B — Diagnostic Engine

---

## Phase 9 — Board Geometry & Node Model
**Duration:** 4 days
Pure logic in `board/`. No UI.

**Tasks**
1. Hole addressing: `{ col: 1-63, row: 'A'-'J', half: 'upper'|'lower' }` plus rail addresses
2. Union-find collapsing each 5-hole strip (A–E and F–J per column) into one node
3. Rail nodes, **with the mid-board gap modeled as a real discontinuity** — this is a fault source, not an implementation detail
4. `getNode(hole): NodeId`, `getHolesInNode(nodeId): Hole[]`
5. Exhaustive unit tests: same-strip holes share a node; across-channel holes never do; rail segments are separate across the gap

**DoD**
- [ ] 100% branch coverage on `nodes.ts`
- [ ] All 830 holes map to exactly one node
- [ ] Node count matches physical reality (130 strips + rail segments)

---

## Phase 10 — Component Placement
**Duration:** 6 days
The longest and fiddliest phase. Budget generously.

**Tasks**
1. Component type definitions: resistor, LED, capacitor, diode, transistor, jumper, DIP IC, with lead counts, polarity flags, and value fields
2. Drag from tray → 3D board with hole snapping
3. Raycast against enlarged invisible collision planes per strip, resolve to nearest hole mathematically
4. Two-lead span: pick first hole, then second; live preview of the lead path
5. IC placement straddling the center channel with orientation (notch) and correct pin-to-hole mapping
6. Select, move, rotate, delete a placed component
7. Undo/redo stack
8. Placement rejection with a reason string (occupied hole, span too long, invalid IC position)
9. Serialize board state to `attempts.final_state`; restore on resume

**DoD**
- [ ] Every BOM component type can be placed, moved, rotated, deleted
- [ ] A 14-pin DIP snaps to correct pins across the channel every time
- [ ] Refreshing mid-build restores the exact board
- [ ] Undo/redo correct across 20 mixed operations
- [ ] Placement feels responsive — no perceptible lag while dragging

---

## Phase 11 — Netlist Extraction
**Duration:** 3 days

**Tasks**
1. Walk placed components → build a multigraph: nodes = electrical nodes, edges = components with type, value, polarity, endpoints
2. Canonical form: strip node labels, produce a stable serialization
3. JSON schema for the golden netlist, versioned from day one
4. Live recompute on every board change (memoized)

**DoD**
- [ ] Same circuit built on different rows produces identical canonical forms
- [ ] Different circuits never collide
- [ ] Extraction under 5ms for a 20-component board

---

## Phase 12 — Learn Mode
**Duration:** 3 days

**Tasks**
1. Enable the capture button in `/teach/exercises/:id/capture`
2. Instructor builds the reference circuit, previews the extracted netlist in readable form, confirms, saves to `exercises.golden_netlist`
3. Re-capture with version increment and a warning about existing attempts
4. Validate on capture: no floating leads, no shorts, all BOM components used

**DoD**
- [ ] Captured netlist round-trips: reload it, rebuild the board, forms match
- [ ] Capturing an invalid circuit is blocked with a specific reason
- [ ] Students still cannot read the column

---

## Phase 13 — Tier 1 Intrinsic Rules
**Duration:** 4 days
Faults detectable without the golden netlist. Powers proactive warnings.

**Rules to implement:** straddled component (both leads one node) · non-IC spanning center channel · IC not straddling channel · floating lead · self-jumper · direct V+/GND short · rail continuity assumed across the mid-board gap · reversed polarity on a polarized part relative to rails.

Each rule is a pure function returning `{ faultClass, nodeIds, rowLabels, severity, cause, guidingQuestion } | null`.

**Tasks**
1. Implement each rule with its own test file
2. Rule registry evaluated on every placement event
3. **Construction-progress heuristic** — suppress "open/floating" warnings until either the student marks a subcircuit complete or 8 seconds of inactivity pass on a dangling lead
4. Severity tiers: blocking (dead short) vs. advisory (floating lead)

**DoD**
- [ ] Each rule has ≥5 positive and ≥5 negative test cases
- [ ] No rule fires on a correctly built reference circuit
- [ ] Progress heuristic prevents nagging during normal construction
- [ ] Full Tier 1 evaluation under 10ms

---

## Phase 14 — Tier 2 Comparator
**Duration:** 7 days
Your core algorithmic contribution.

**Tasks**
1. Component matching: bipartite match student ↔ golden on type and value, backtracking search
2. Graph edit distance via depth-limited A*, capped at 4 edits
3. Edit-to-fault mapping (add edge → open; delete → extra wire; move endpoint → misplaced lead; adjacent move → off-by-one; swap endpoints → reversed polarity; attribute change → out-of-tolerance)
4. Weighted cost table reflecting novice fault frequency; infinite cost for impossible edits (polarity swap on a resistor)
5. Beyond the cap: return "substantially different" rather than a false diagnosis
6. Report only the most upstream fault when several are found

**DoD**
- [ ] Correct-but-different-rows builds produce **zero** faults — this is the headline metric
- [ ] Single-fault cases resolve to the correct single edit
- [ ] Comparator completes under 100ms on a 20-component board
- [ ] Cost table externalized to a config file and documented for your appendix

---

## Phase 15 — Fault Presentation
**Duration:** 4 days

**Tasks**
1. Row-level highlight in 3D: pulse the offending strip, dim the rest
2. Feedback panel card: fault class badge, plain-language cause, guiding question, "show me" button that focuses the camera
3. Icon + text on every fault indicator (never color alone)
4. Hint ladder: guiding question → narrowed hint → explicit correction, each requiring a deliberate click, each logged
5. Fault resolution detection with positive confirmation
6. Bilingual fault strings (EN / Filipino)

**DoD**
- [ ] Every fault class has a distinct icon, cause text, and guiding question in both languages
- [ ] Highlighted row is unmistakable at default zoom
- [ ] Hint escalation is logged with timestamps
- [ ] Fixing a fault produces immediate positive feedback

---

## Phase 16 — DC Solver
**Duration:** 4 days

**Tasks**
1. Modified nodal analysis, ~200 lines, Gaussian elimination
2. Stamps for resistor, DC source, ideal-ish diode/LED, capacitor as open at DC
3. Singular-matrix detection → maps to floating-node fault
4. Value/tolerance checks and simple behavioral verdicts (does the LED conduct, is current within range)

**DoD**
- [ ] Solver matches hand calculations on 10 reference circuits
- [ ] Singular matrices are caught, never crash
- [ ] Solve under 20ms

---

## Phase 17 — Telemetry
**Duration:** 3 days

**Tasks**
1. Event logger writing to `events` — place, remove, move, scan, fault, hint, resolve, submit
2. Batched writes with offline queue in IndexedDB, flushed on reconnect
3. Attempt finalization computing duration, faults encountered, faults self-resolved, hints used
4. `/results/:attemptId` populated with real data

**DoD**
- [ ] Every meaningful action produces exactly one event
- [ ] Offline actions sync on reconnect with no duplicates
- [ ] "Fault isolation time" is computable per fault from timestamps
- [ ] Results page matches raw event data on manual audit

---

## Phase 18 — Instructor Analytics
**Duration:** 4 days

**Tasks**
1. `/teach/reports/:classId` — most common fault classes, average isolation time, self-resolution rate, students flagged as struggling
2. Per-student attempt drill-down with fault timeline
3. CSV export (you will need this for your statistics)

**DoD**
- [ ] Charts render correctly with real seeded data and with zero data
- [ ] CSV opens cleanly in Excel
- [ ] Instructor can identify the three most-failed exercises in under 30 seconds

---

## Phase 19 — Offline & PWA
**Duration:** 3 days

**Tasks**
1. `vite-plugin-pwa`, app shell precached
2. Cache assigned exercises and their public metadata for offline use
3. Queue attempts and events offline; sync on reconnect
4. Visible online/offline indicator

**DoD**
- [ ] Full exercise completable with network disabled after first load
- [ ] Reconnect syncs everything with no loss or duplication
- [ ] Installable on Android and desktop Chrome

---

## Phase 20 — Evaluation Harness
**Duration:** 5 days
This phase produces your results chapter. Do not skip it or do it by hand.

**Tasks**
1. Build the **150-fault seeded corpus** as JSON fixtures: `{ description, expectedFaultClass, expectedRows, boardState, exerciseId }`. Cover all fault classes proportionally
2. Include ≥20 **negative cases** — correct circuits built on different rows, which must produce zero faults
3. Headless test runner: load fixture → run comparator → compare to expected
4. Report generator: localization accuracy, classification accuracy, false-positive rate, per-class confusion matrix
5. Wire into CI so accuracy is recomputed on every push

**DoD**
- [ ] `npm run eval` prints the full accuracy report
- [ ] Localization ≥ 90%
- [ ] Classification ≥ 85%
- [ ] False positives on correct builds ≤ 5%
- [ ] Confusion matrix exported for your appendix

---

## Phase 21 — Pilot & ISO 25010 Evaluation
**Duration:** 2 weeks

**Tasks**
1. Recruit participants: students (experimental + control) and instructors
2. Control condition: same exercises with diagnostics disabled — feedback panel shows pass/fail only. **You need this group for the ≥40% claim**
3. Run sessions, collect telemetry
4. Administer the ISO/IEC 25010 instrument across functional suitability, performance efficiency, usability, reliability, and portability
5. Compute weighted mean, target ≥ 4.20
6. Statistical comparison of isolation time between groups

**DoD**
- [ ] ≥30 student participants
- [ ] Control and experimental data collected under identical exercises
- [ ] Weighted mean ≥ 4.20
- [ ] Isolation-time reduction computed with significance test
- [ ] Raw data archived and reproducible

---

# PART C — Assignments, Grading & AI Coach

Part C is what turns a practice tool into something an instructor can actually run a course on.
It starts only when Part B's comparator is real and tested, because both the grade and the AI
Coach are functions of the comparator's output. Building either one on top of a diagnostic engine
you do not yet trust produces a grade you cannot defend.

---

## Phase 22 — Assignments & Task Policy
**Duration:** 5 days

The teacher-facing task builder, and the student-facing consequences of it.

**Tasks**
1. Add the `assignments` table and the three new `attempts` columns from Section 2.1. Generate and
   commit the migration
2. Zod contracts in `shared/contracts/assignments.ts`, imported by both sides. The window, timer,
   attempts, help and grading groups each get their own object so the form can render them as
   sections without reshaping the payload
3. `/teach/classes/:id/assignments` — the task list for a class: title, due date, submitted count,
   average score, published toggle
4. `/teach/assignments/new` — **the task builder**, five collapsible sections:

   | Section | Fields |
   |---|---|
   | Basics | exercise picker, title override, instructions |
   | Window | opens at, due at, closes at, late policy, late penalty per day |
   | Timer | time limit, timer mode (none / soft / hard) |
   | Attempts | max attempts, which score to keep |
   | Help & grading | live diagnostics level, hints allowed, max hints, hint penalty, grading mode, total points, rubric weights, pass threshold |

   Every field has a sensible default, so an instructor in a hurry picks an exercise, sets a due
   date, and presses Assign. Nothing else is required
5. `/teach/assignments/:id/edit` — the same form, with a warning banner when attempts already
   exist and a hard block on lowering `total_points` after grades have been issued
6. Validation the form enforces before submit: `opens_at < due_at < closes_at`; rubric weights sum
   to `total_points`; `late_penalty_pct` is only editable when `late_policy` is `penalized`;
   `max_hints` only when `hints_allowed`
7. **Server-side window enforcement.** Starting an attempt before `opens_at` or after `closes_at`
   returns 403. Submitting after `due_at` is accepted, rejected, or flagged late according to
   `late_policy`. The client's clock is never consulted for any of this
8. **Timer.** On attempt creation the server computes `expires_at` from `started_at` and
   `time_limit_s` and returns it. The workspace header counts down to that timestamp, not to a
   duration it was handed. On `hard` mode the server auto-submits on the first request that
   arrives past `expires_at`, and a cron-style sweep finalises attempts from students who simply
   closed the tab. `auto_submitted` records which happened
9. Student surfacing: assigned tasks on `/dashboard` grouped by due date with a countdown pill,
   and `/assignments/:id` showing the policy in plain language before the student starts — "You
   have 45 minutes. One attempt. Feedback after the deadline."
10. Attempt-cap enforcement, with the remaining count shown before the student commits

**The clock rule.** Deadlines and timers are decided by the server, always. A student who changes
their system clock, or whose laptop is simply wrong, must not gain or lose a second. Every
duration the client displays is derived from a server timestamp it was given.

**DoD**
- [ ] An instructor can assign an exercise with a deadline, a timer and an attempt cap in under a minute
- [ ] A student sees the task, its countdown, and its policy before starting
- [ ] Starting outside the window returns 403 from the API, tested with curl
- [ ] A `hard` timer auto-submits at zero, and also auto-submits an abandoned attempt
- [ ] Changing the client clock changes nothing about the deadline or the timer
- [ ] The attempt cap cannot be exceeded, including by calling the API directly
- [ ] Rubric weights that do not sum to the total are rejected by the API, not only by the form

---

## Phase 23 — Automatic Grading
**Duration:** 5 days

The instructor already captured the correct circuit in Learn Mode. The mark follows from it.

**Tasks**
1. `api/grading/rubric.ts` — a pure function `grade(digest, rubric, policy) -> Breakdown`. No
   database, no network, no clock. Everything it needs arrives as arguments, which is what makes
   it unit-testable and what makes a disputed grade reproducible on demand
2. Implement the five rubric lines from Section 2.1, including the partial-credit formula on the
   correctness line
3. Penalties: late (per day past `due_at`, only when `late_policy` is `penalized`) and hints
   (`hint_penalty_pts` per hint taken). Floor the final score at zero
4. `POST /api/attempts/:id/submit` becomes the grading transaction: freeze the board, run the
   Tier 2 comparator server-side, write `grades`, and enqueue the AI feedback row. One
   transaction — a submitted attempt with no grade row must be impossible
5. `keep_score` resolution across multiple attempts (highest / latest / first / average), computed
   at read time so changing the policy re-derives cleanly
6. `/results/:attemptId` grows a **score breakdown**: each rubric line, points earned out of
   points possible, and one sentence saying why. This is visible immediately — the score is not
   the coaching, and withholding a number while the student stares at a spinner helps nobody
7. `/teach/assignments/:id/submissions` — the gradebook: student, attempts used, score, late flag,
   submitted at, status. Sortable, with a "needs review" filter for `auto_with_review`
8. Instructor override: edit any score with a required note. `auto_score` is never overwritten;
   the override sits beside it and both are shown
9. CSV export of the gradebook
10. `grading_mode` of `manual` skips auto-scoring but still runs diagnostics and still stores the
    breakdown, so the instructor grades with the analysis in front of them

**DoD**
- [ ] Same board submitted twice produces byte-identical breakdowns
- [ ] A correct circuit built on different rows scores full marks — the Phase 14 headline metric, now with money on it
- [ ] Partial credit is monotonic: more edits away from correct never scores higher
- [ ] Late and hint penalties apply exactly once and never push a score below zero
- [ ] Submitting cannot produce an attempt without a grade row, verified by killing the request mid-flight
- [ ] Override preserves the automatic score and requires a note
- [ ] CSV opens cleanly in Excel with one row per student per assignment
- [ ] `grade()` has ≥30 unit tests covering every rubric line and both penalties

---

## Phase 24 — AI Coach on Free Build
**Duration:** 5 days

Free Build is `/sandbox`: no exercise, no grade, no deadline. A student builds whatever they like
and presses **Run**. This is where the Coach speaks immediately, because there is nothing to cheat
on.

### What the Coach is, and what it is not

The Coach **does not diagnose**. It never decides whether a circuit is right, never locates a
fault, never assigns a mark, and never sees the golden netlist. The deterministic engine does all
of that first and hands the Coach a finished result. The Coach's only job is to say that result in
language a first-year student wants to read.

This split is not squeamishness about language models. It is what keeps the project's central
claim intact: the accuracy numbers in the results chapter come from a deterministic function that
returns the same answer every time it is run. Put a model in that path and the numbers stop being
reproducible, and the first panelist to ask "would it say the same thing tomorrow?" has taken the
contribution apart.

```
board state
    │
    ▼
Tier 1 rules (browser) ─┐
Tier 2 comparator (API) ─┼──▶  DIAGNOSTIC DIGEST  ──▶  AI Coach  ──▶  student reads it
DC solver (browser) ────┘         (facts, JSON)         (words)
                                       │
                                       └──▶  grade()  ──▶  score
```

The digest feeds the grade and the Coach alike. The grade never passes through the model.

**Tasks**
1. Install `@anthropic-ai/sdk`. The key lives in `ANTHROPIC_API_KEY` on the server only — add it
   to `.env.example` and confirm it never appears in the client bundle
2. `api/ai/digest.ts` — build the digest from the diagnostic report. A fixed, small shape:

```jsonc
{
  "context":  { "mode": "free_build", "objective": "..." },
  "verdict":  "correct" | "faulted" | "substantially_different",
  "correct":  [{ "id": "c1", "what": "resistor value", "detail": "330Ω, right for 10mA at 5V" }],
  "faults":   [{ "id": "f1", "class": "open_circuit", "rows": ["14","15"],
                 "cause": "...", "guidingQuestion": "...", "severity": "blocking" }],
  "process":  { "durationMs": 742000, "hintsUsed": 1, "faultsSelfResolved": 2 }
}
```

3. `api/ai/coach.ts` — one call to `claude-opus-5`. Settings that matter:
   - `output_config: { format: ... }` — structured outputs, so the response is always
     `{ strengths[], issues[], nextStep }` and never prose that has to be parsed
   - `output_config: { effort: "low" }` — this is short, tightly-specified writing. Sweep low
     against medium on real digests during this phase and keep whichever reads better
   - `thinking: { type: "adaptive" }` — the default on Opus 5; leave it on
   - `cache_control: { type: "ephemeral" }` on the system prompt, which is identical on every
     request and is the bulk of the input
   - Streaming on the free-build path, so text appears as it is written
4. **The system prompt is a contract**, versioned in `api/ai/prompts/coach.v1.ts` and recorded in
   `ai_feedback.prompt_version`. It states: you are given a completed analysis; you may only
   describe faults present in `faults[]` and strengths present in `correct[]`; you may not add,
   merge, rank or invent any; never state the fix outright when a guiding question is supplied;
   name at least one genuine strength; 150 words or fewer; second person; no blame
5. **The grounding check** — the safety mechanism that makes this defensible. After the model
   responds, verify that every fault id and every row label it cites exists in the digest. Any
   invention fails the check, sets `grounding_ok` to false, and serves the deterministic template
   text instead. The student sees good feedback either way; the difference is only whether it was
   written by the model or assembled from Phase 15's strings
6. **Fallback path.** No API key, an outage, a rate limit, a refusal, or a failed grounding check
   all resolve to the same thing: the Phase 15 deterministic cause-and-question text, rendered in
   the same card. `fell_back` records it. The trainer must be fully usable with the model switched
   off — a lab with no internet still teaches
7. Rate limit per student, and a monthly project ceiling with a kill switch, so a runaway loop
   cannot spend the budget
8. Free Build UI: a **Run** button, a result card with strengths first, then issues, then one next
   step. Bilingual output (EN / Filipino) driven by the profile locale
9. Log tokens and the model to `ai_feedback` on every call

**Cost.** A digest plus the cached system prompt runs roughly 1,500 input and 250 output tokens.
At Opus 5 rates that is about **$0.014 per feedback**, and prompt caching cuts the input share
substantially after the first call in a window. A 30-student pilot at ten exercises each is about
**$4**. Cost is not a reason to compromise the design here. If it ever becomes one, the model is a
single constant and `claude-sonnet-5` or `claude-haiku-4-5` are drop-in — but that is a decision
to make on measured quality, not in advance.

**DoD**
- [ ] Pressing Run on a broken free build returns coaching within 3 seconds
- [ ] The feedback names a real strength every time, including on a badly broken board
- [ ] Every fault mentioned exists in the digest — asserted by an automated grounding test over 50 fixtures
- [ ] Deleting `ANTHROPIC_API_KEY` degrades to deterministic text with no visible error
- [ ] A digest with `verdict: correct` produces praise and no invented criticism
- [ ] `ANTHROPIC_API_KEY` does not appear in the built client bundle — grep to confirm
- [ ] Filipino output is idiomatic, checked by a native speaker, not machine round-tripped
- [ ] Token usage and model are recorded for every call

---

## Phase 25 — AI Coach on Assigned Tasks, and the Release Gate
**Duration:** 4 days

Same Coach, same digest, one difference: on a graded task nobody reads it until the assignment
says they may.

### Why the gate exists

An assigned task is an assessment. Coaching delivered while the student can still change their
answer is the system correcting the work it is about to mark. The student's score then measures
how well the trainer explains circuits, not how well the student understands them — and the
control group in Phase 21 becomes incomparable, because the two groups were not doing the same
task.

So on an assignment the Coach runs at submit and the text sits in the database, unread, until
`visible_at` passes.

**Tasks**
1. `visible_at` is computed **on the server at submit**, from the assignment's `feedback_release`:

   | `feedback_release` | `visible_at` becomes |
   |---|---|
   | `immediate` | now — rejected by the API on multi-attempt auto-graded assignments |
   | `after_submit` | now |
   | `after_due` | the assignment's `due_at` |
   | `manual` | null, until the instructor presses Release |

2. `GET /api/attempts/:id/feedback` returns the text only when `visible_at` is non-null and in the
   past. Otherwise it returns a `withheld` payload carrying the release time and nothing else.
   **The text must never be sent to a client that is not allowed to display it.** Sending it with
   a "hidden" flag is not a gate; it is the answer key with a checkbox
3. Generate at submit, not at release. The digest reflects the board as submitted, and generating
   later means holding board state for a batch job and getting a queue of API calls all landing
   the moment a deadline passes
4. Release on `after_due` needs no job: the read path compares `visible_at` to now. A scheduled
   sweep exists only to send notifications
5. `/teach/assignments/:id/submissions` gains a **Release feedback** action for `manual`, both for
   one student and for the whole class
6. Student-side states, all designed, none of them a blank panel:
   - *Submitted, feedback pending* — "Your work is in. Feedback opens Friday 5:00 PM."
   - *Released* — the full card
   - *Withheld and overdue* — the instructor has not released it yet
7. During a task the feedback panel obeys `live_diagnostics`. On `off` it shows the objective and
   the timer and nothing else. On `tier1` it shows intrinsic warnings only. On `full` it adds a
   **Check my work** button that runs the server-side comparator
8. **Integrity tests, which are the real deliverable of this phase:**
   - Calling the feedback endpoint before release returns no feedback text, asserted on the raw
     response body
   - The same for a submitted-but-not-due attempt, an unsubmitted attempt, and another student's
     attempt
   - No student-reachable response anywhere in the app contains a `golden_netlist` key — extend
     the existing Phase 2 response-shape test to cover every Part C route
   - With `live_diagnostics` of `off`, no fault information reaches the client before submit
9. Instructors see the digest and the coaching for any attempt at any time, on their own routes

**DoD**
- [ ] Feedback text is absent from the API response until release, verified against the raw body
- [ ] A student cannot reach another student's feedback, grade, or digest
- [ ] `after_due` releases for the whole class at the deadline with no manual step
- [ ] `manual` release works per student and for the whole class
- [ ] Exam mode (`live_diagnostics: off`) leaks nothing during the attempt
- [ ] Every withheld state has a designed screen naming when feedback opens
- [ ] The Phase 2 golden-netlist response test covers every Part C route
- [ ] An instructor sees everything for their own class, always

---

## 3. Timeline Summary

| Part | Phases | Working days |
|---|---|---|
| A — Student Shell | 0–8 | 35 |
| B — Diagnostic Engine | 9–20 | 50 |
| C — Assignments, Grading & AI Coach | 22–25 | 19 |
| Evaluation | 21 | 10 |
| **Total** | | **~114 days (≈23 weeks)** |

Add 20% buffer. Phases 10 and 14 are still the most likely to overrun.

**Phase 21 runs last**, after Part C, despite its number — the pilot needs assignments, grading
and the Coach in place to measure the three arms in Section 2.10. The numbering is kept as it is
so that `docs/phase-status.md` and every existing reference stay valid.

**If the schedule slips**, cut in this order: Phase 25's manual release mode, then Phase 24's
bilingual output, then Phase 23's CSV export. Do not cut the Phase 25 release gate. An assignment
system that leaks corrections during a graded task is worse than no assignment system, because it
produces numbers that look like results and are not.

---

## 4. Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Golden netlist leaks to students | Fatal to premise | Column-projection split at the API layer; response-shape test; no client DB access; Tier 2 runs server-side |
| Self-registered instructor accounts | Total bypass of the above | Invite code or admin promotion; Phase 3 DoD |
| Neon connection exhaustion under a full lab | Outage during evaluation | Pooled connection string; load-test with 40 concurrent sessions before pilot |
| Cold-start latency on serverless functions | Feels sluggish to students | Tier 1 stays client-side and covers live warnings; Tier 2 is user-initiated, not per-keystroke |
| Graph edit distance too slow | Blocks live feedback | Depth cap of 4; precompute matching; profile in Phase 14 |
| False positives on valid alternate builds | Destroys student trust, and now also produces a wrong grade | ≥20 negative fixtures; ≤5% FP gate; grader harness in Phase 20 |
| 3D performance on lab machines | Unusable on school PCs | Instanced geometry; 60fps gate in Phase 7; test on actual lab hardware early |
| Proactive warnings feel naggy | Usability score collapses | Construction-progress heuristic; validated in pre-test |
| Panel objects "this is just Tinkercad" | Defense risk | Lead with the fault taxonomy and isomorphism matcher as the contribution |
| Scope creep into AC/transient analysis | Missed deadline | DC-only is written into scope; refuse additions |
| **AI feedback reaches a student mid-task** | **Invalidates every grade and the pilot itself** | **Server-side `visible_at` gate; text never sent to a client that may not show it; integrity tests in Phase 25 DoD** |
| **The model invents a fault the engine never found** | **Student chases a problem that is not there; trust gone** | **Grounding check rejects any fault or row not in the digest; falls back to deterministic text; 50-fixture automated test** |
| **Panel objects "the AI is doing the diagnosis"** | **Defense risk — the contribution looks like a wrapper** | **Architecture diagram showing the model strictly downstream of the digest; Phase 20 accuracy numbers computed with the model absent; Coach can be switched off entirely and the trainer still works** |
| **Anthropic API outage or exhausted budget during the pilot** | **Sessions stall mid-evaluation** | **Deterministic fallback path is the same code path, exercised in the Phase 24 DoD; monthly ceiling with a kill switch; pilot runs on `after_due` so no session ever waits on a live call** |
| **Auto-grade disputed by a student** | **Instructor loses confidence in the whole system** | **`grade()` is pure and re-runnable on the stored digest; the breakdown shows every line; override with a mandatory note keeps both numbers** |
| **Client clock manipulation to beat a timer** | **Timed assessments meaningless** | **Every deadline and expiry is a server timestamp; the client only counts down to one; server auto-submits past `expires_at`** |

---

## 5. Non-Negotiables

1. `board/` never imports React or Three.js.
2. No fault is ever communicated by color alone.
3. The golden netlist never reaches a student client, and no database credential or API key ever
   reaches any client.
4. The diagnostic engine is deterministic and pure. Tier 1 and the DC solver run in the browser;
   Tier 2 runs on the API because it needs the golden netlist. The API never *decides* anything a
   pure function could not — it only runs those functions where the data is.
5. Every diagnostic rule is a pure, unit-tested function.
6. **No generative AI in the diagnostic path.** The model receives a completed diagnostic digest
   and writes prose. It never determines whether a circuit is correct, never locates or classifies
   a fault, never computes a grade, and never sees the golden netlist. Every number in the results
   chapter is produced with the model absent.
7. **Every AI output is grounded.** Any fault, row or claim not present in the digest fails the
   grounding check and the deterministic text is served instead.
8. **The trainer is fully usable with the AI switched off.** The Coach is an improvement to how
   feedback reads, never a dependency for feedback existing.
9. **On a graded task, no feedback reaches the student before the assignment releases it** — and
   the gate is server-side, because a client-side gate is not a gate.
10. **Deadlines, timers and attempt caps are enforced by the server.** The client displays them; it
    never decides them.
11. A phase with unchecked DoD boxes is not finished.
