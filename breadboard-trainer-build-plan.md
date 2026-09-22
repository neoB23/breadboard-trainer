# Smart Breadboard Diagnostic Trainer — Web Build Documentation

**Version:** 1.2
**Scope:** Full web replacement of the hardware trainer
**Structure:** Part A (Student Shell) → Part B (Diagnostic Engine) → Part C (Assignments, Grading & AI Coach). A part is not started until the previous one is complete and polished.

---

## 0.0 What Changed in Version 1.2

Four decisions, and three things 1.1 got wrong about Free Build that the second decision exposed.
Everything in 1.1 stands unless a line below says otherwise.

### Decided — we stay on the breadboard

The lighting-circuits proposal in [`pivot-plan.md`](pivot-plan.md) is **not adopted**. The domain
stays the breadboard, Part B keeps its 1.1 phases, and nothing built in Phases 0–4 moves. The
pivot plan is kept for the record only.

### Changed — the Free Build Coach is active

In 1.1 the Coach in Free Build waited to be asked: it spoke when the student pressed **Run**. In
1.2 it watches the board. When the student pauses, it says one thing: the most important mistake
on the board or, when there is none, one suggestion. If the same mistake is still there a minute
later, it narrows the hint. When the student fixes it, it says so. **Run** stays, and still gives
the full summary.

| Mode | When the Coach speaks |
|---|---|
| **Free Build** | Each time the board settles after a change that matters, plus a full summary on Run |
| **Assigned task** | Unchanged from 1.1: only after submission, and only once the release rule allows it |

Nothing about assigned tasks changes. Active coaching is Free Build only, and the server
enforces that (Phase 27).

### Added — suggestions, computed rather than invented

"Suggestion" cannot mean "whatever the model thinks of". A novice told by a language model to use
a 10 Ω resistor burns out an LED, and a grounding check cannot catch advice that has no fact
behind it to check against. So suggestions come from the engine, exactly as faults do. Phase 26
adds two deterministic pieces:

- **Suggestion rules.** The circuit works, or will, but is poor practice: an LED so dim it looks
  dead, two LEDs sharing one resistor, a resistor running hot.
- **A pattern recognizer.** It names common sub-circuits (a voltage divider, an LED with its
  resistor, a transistor switch), reads their values off the DC solver, and carries a few curated
  "try this next" ideas for each.

The engine decides what to say. The model decides only how to word it.

### Changed — the Coach runs on a free, self-hosted Qwen model

1.1 specified a paid, per-request commercial API. 1.2 uses an **open-weight Qwen instruct model**,
**self-hosted** on a machine the school controls and served by Ollama or vLLM. There is no charge
per request, and no board state leaves the school.

That trade works because of a decision 1.1 already made: the model never diagnoses anything. It is
handed a finished digest and asked to word one item from it in under 60 words. A 4–9B-parameter
model should be able to do that, and Phase 24 measures whether the chosen one does. Where it words
something badly, the grounding check catches it and serves the deterministic text instead. That is
the same path the trainer takes with the model switched off.

The Coach talks to the model through one adapter, `api/ai/provider.ts`, which speaks the
OpenAI-compatible chat-completions protocol. Ollama, vLLM, llama.cpp and most hosted Qwen
providers serve that protocol. The base URL and the model tag are configuration, so moving to a
bigger model, other hardware or a hosted provider later changes config, not code.

### Resolved — three things 1.1 got wrong about Free Build

**Free Build has no answer key, so it has no Tier 2.** The 1.1 free-build digest carried a
comparator verdict (`correct`, `faulted`, `substantially_different`). The comparator needs a golden
netlist, and a free build has none. The free-build digest is now built from Tier 1, the DC solver
and Phase 26 only, and its verdict is `clean` or `issues`.

**Streaming and grounding cannot happen in the order 1.1 put them.** 1.1 streamed the Coach's text
to the student as it was written and checked its grounding once it was finished. A failed check
would then retract words the student had already read. In 1.2 the student receives no model text
until the complete message has passed the check. The deterministic fault cards still appear
instantly, so nobody watches a spinner, and the Coach's wording follows a few seconds later.

**Free Build has no attempt row.** 1.1 made `ai_feedback.attempt_id` `not null` and treated a free
build as an attempt with no assignment. The sandbox as built keeps its board in the browser on
purpose (`src/features/sandbox/sandbox-page.tsx`). An attempt appears in an instructor's drill-down
and in Phase 20's numbers, and a doodle belongs in neither. 1.2 keeps that design and adds a small
`sandbox_sessions` table (Section 2.1). Each coaching message belongs to either an attempt or a
sandbox session, never both. The board is sent with each coaching request and is not stored.

### Amendments to existing phases

| Phase | Amendment |
|---|---|
| **13** — Tier 1 | The rule registry gains a third severity, `suggestion`, below `advisory`. Phase 26's rules register there, so one pass returns faults and suggestions together |
| **15** — Fault presentation | Every fault class needs all three hint-ladder rungs written, in both languages. Phase 27 climbs the ladder automatically in Free Build, and the deterministic path serves these strings whenever the model does not answer |
| **16** — DC solver | Expose per-component current, voltage drop and power in the solver result. Phase 26 reads them |
| **17** — Telemetry | Free Build does not write to `events`, which hangs off attempts. Coaching outcomes are recorded on `ai_feedback` instead (Section 2.1) |
| **20** — Evaluation harness | Add fixtures for every Phase 26 rule and pattern, including equivalent alternatives that must draw no suggestion. Report them separately from the headline accuracy numbers |
| **21** — Pilot | Free Build coaching follows the student's arm. See Section 2.10 |

### What this costs

Phase 26 adds 5 days to Part B. Phase 27 adds 6 days to Part C. Phase 24 grows by a day for the
model bake-off. The total moves from about 114 working days to about **126** (≈25 weeks). See
Section 3.

### What the team needs to decide

1. **Where the model runs.** Recommended: one school machine with a GPU, running Ollama or vLLM,
   reachable only from the API through an authenticated tunnel. The alternative is a free hosted
   Qwen endpoint. That is fine for development, but free tiers cap requests per minute and per day
   well below what a full lab in active mode sends, and some keep prompts. Read the terms before
   sending anything to one.
2. **The Free Build default.** Recommended: **Active**, with Quiet one click away. The alternative
   is On request, which is 1.1's behaviour.
3. **Which Qwen model.** Not decided in advance. Phase 24 runs a bake-off, and the smallest model
   that clears the bar wins.

---

## 0.1 What Changed in Version 1.1

Kept as written. Where 1.2 changes something below, 1.2 wins.

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
| AI Coach model | Open-weight Qwen instruct model, self-hosted on Ollama or vLLM, behind an OpenAI-compatible adapter |

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
    suggestions/    # Phase 26: advisory rules
    patterns/       # Phase 26: sub-circuit library + recognizer
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
  ai/               # Part C: digest, provider adapter, grounding, prompts
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
| `/sandbox` | student | **Free Build** — ungraded practice; the AI Coach watches and nudges as you build |
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

-- 1.2. One row per Free Build sitting. It holds no board: the board stays in the
-- browser, exactly as src/features/sandbox/sandbox-page.tsx keeps it. Never joined
-- into attempts, instructor drill-downs, Phase 18 analytics or Phase 20 numbers.
create table sandbox_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id text references profiles(id) on delete cascade not null,
  started_at timestamptz default now(),
  last_active_at timestamptz default now(),
  coach_level text not null default 'active'
    check (coach_level in ('off','on_request','active')),   -- the student's own choice
  coach_calls int not null default 0,        -- model calls made
  coach_fallbacks int not null default 0,    -- deterministic text served instead
  coach_skipped int not null default 0       -- triggers dropped: unchanged board, pacing, Quiet
);

-- 1.2. The ceiling an instructor sets on Free Build for their class. Across a
-- student's classes the most restrictive value wins, read on the server per request.
alter table classes add column sandbox_coach text not null default 'active'
  check (sandbox_coach in ('off','deterministic','active'));
-- off           = pass/fail only in Free Build, like the Phase 21 control arm
-- deterministic = Tier 1 and Phase 26 cards and nudges in Phase 15 wording. Never the model
-- active        = the same, worded by the model, falling back to deterministic

-- One row per generated coaching message. The visibility gate lives here.
create table ai_feedback (
  id uuid primary key default gen_random_uuid(),
  -- exactly one owner: an attempt (graded or ungraded) or a Free Build session
  attempt_id uuid references attempts(id) on delete cascade,
  sandbox_session_id uuid references sandbox_sessions(id) on delete cascade,
  check ((attempt_id is null) <> (sandbox_session_id is null)),
  mode text not null check (mode in ('free_build','assignment')),
  triggered_by text not null default 'run'
    check (triggered_by in ('run','settle','escalation','submit')),
  status text not null default 'queued'
    check (status in ('queued','ready','failed','skipped')),

  -- THE GATE. Null means "generated, but nobody may read it yet".
  -- Every read path filters on visible_at <= now(). See Phase 25.
  visible_at timestamptz,

  digest jsonb not null,             -- the deterministic input, archived verbatim
  strengths jsonb,                   -- [{ id, text }]
  issues jsonb,                      -- [{ faultId, text, question }]
  suggestions jsonb,                 -- 1.2: [{ suggestionId, text }]
  next_step text,

  -- 1.2, active coaching. Null on Run summaries and on assignments
  revision int,                      -- the board revision this message speaks to
  board_hash text,                   -- canonical netlist + finding ids; the change gate
  focus_id text,                     -- the one fault or suggestion the message is about
  hint_level int check (hint_level between 1 and 3),   -- question, narrowed hint, fix

  provider text,                     -- e.g. 'ollama', 'vllm'
  model text,                        -- the exact model tag served, e.g. 'qwen3:8b'
  prompt_version text,               -- bump when the system prompt changes
  input_tokens int,
  output_tokens int,
  latency_ms int,
  grounding_ok boolean,              -- did the output pass the grounding check?
  fell_back boolean not null default false,   -- true = deterministic text was served

  -- 1.2, what happened next. Stands in for Phase 17 events in Free Build
  shown_at timestamptz,
  resolved_at timestamptz,           -- the focus finding left the board
  rating smallint check (rating in (-1, 1)),   -- thumbs down / up
  created_at timestamptz default now()
);

create index assignments_class_idx on assignments(class_id);
create index assignments_due_idx on assignments(due_at) where published;
create index attempts_assignment_idx on attempts(assignment_id);
create index grades_assignment_idx on grades(assignment_id);
create index ai_feedback_attempt_idx on ai_feedback(attempt_id);
create index ai_feedback_sandbox_idx on ai_feedback(sandbox_session_id);
create index sandbox_sessions_student_idx on sandbox_sessions(student_id);
```

Free Build coaching rows are kept for 90 days, which is long enough to tune the Coach against,
and then a sweep deletes them. A doodle's coaching deserves no longer a life than the doodle.

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
| **13/14** — Diagnostics | Tier 1 stays in the browser. **Tier 2 moves to the API** behind `POST /api/attempts/:id/scan`, per Section 0.1. The comparator itself is unchanged and still a pure function; only its call site moves |
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

**Free Build must follow the arm too.** Active coaching exists outside assignments, so a control
student could practise in the sandbox with the model's help and quietly stop being a control. The
class-level `sandbox_coach` setting closes that for the length of the pilot:

| Group | `sandbox_coach` |
|---|---|
| Control | `off` — pass/fail only, the same as its assignments |
| Experimental A | `deterministic` — cards and nudges, no model |
| Experimental B | `active` |

`sandbox_sessions` counts tell the write-up how much each group practised, which is a confound the
panel will ask about.

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

## Phase 26 — Suggestion Rules & Pattern Recognizer
**Duration:** 5 days
Added in 1.2. Numbered 26 so that no existing reference moves. It **runs here**, after Phase 16,
because it reads the solver's output. Pure logic in `board/`. No UI and no model.

A fault says the circuit is wrong. A suggestion says it works, or will, but could be better. A
student in Free Build needs the second far more often than the first, because most free builds
are not broken. They are unfinished, or naive. This phase is what lets the Coach say something
useful about them without making anything up.

**Suggestion rules.** They are written for the parts actually on the Free Build shelf (resistors,
a red LED, two capacitors, a 2N2222, a 1N4148, jumpers). Each is a pure function returning
`{ rule, nodeIds, rowLabels, detail, advice } | null`, the same discipline as Phase 13.

| Rule | Fires when | Reads |
|---|---|---|
| `led_dim` | LED forward current is below ~2 mA. A 10 kΩ on a red LED at 5 V gives about 0.3 mA, which is barely a glow | solver |
| `led_margin` | LED current is above ~15 mA. It works now and dies early | solver |
| `resistor_hot` | A resistor dissipates more than half its ¼ W rating | solver |
| `leds_share_resistor` | Two or more LEDs in parallel share one series resistor | topology |
| `base_no_resistor` | A transistor base connects straight to a supply rail | topology |
| `collector_no_load` | A transistor collector connects straight to the supply with nothing to switch | topology |

The thresholds live in a config file beside the Phase 14 cost table and are documented for the
appendix. The rule set grows with the shelf: putting an IC on it brings decoupling and
floating-input rules with it.

**Pattern recognizer.** It works from a small library of sub-circuits, each a tiny netlist:

| Pattern | Values it reports | Example "try next" |
|---|---|---|
| LED with series resistor | LED current | Swap the 220 Ω for the 1 kΩ. What happens to the brightness, and why? |
| Voltage divider | Output voltage | Put the LED on the tap. Is the tap still at the voltage you worked out? |
| RC network | Time constant τ | Swap the 100 nF for the 10 µF. What happens to τ? |
| Transistor switch | Base and collector current, saturated or not | What does the base resistor protect? |
| Diode in series | Forward drop | Turn the diode around. Predict first, then try |

Every "try next" idea is written by the team, reviewed by an instructor, bilingual, and carries an
id. The model may pick one and word it. It may not write its own.

**Tasks**
1. The six rules, each with its own test file
2. The `suggestion` severity in the Phase 13 registry, so one evaluation pass returns both faults
   and suggestions
3. The pattern library in `board/patterns/`: five patterns as JSON netlists, each with the solver
   values it reports and two or three curated try-next ideas in English and Filipino
4. The recognizer. It finds every instance of every pattern on the board and reports rows and
   values. A pattern matches when all of its parts and connections are present. Extra connections
   on its outer nodes are allowed; extra connections inside it are not. On a 20-component board a
   plain search over candidate mappings is fast enough, so it needs no clever algorithm
5. Negative cases, the same idea as Phase 14's headline metric: equivalent alternatives draw
   nothing. That covers the resistor on either side of the LED, a divider's resistors swapped in
   position, and a part moved to an equivalent row

**DoD**
- [ ] Each rule has ≥5 positive and ≥5 negative test cases
- [ ] No suggestion fires on a correctly built reference circuit
- [ ] The resistor on either side of an LED is recognised as the same pattern, with the same values
- [ ] Every pattern is recognised when built on different rows, with identical values
- [ ] Every try-next idea has been reviewed by an instructor for safety, in both languages
- [ ] Rules and recognizer together run in under 10 ms on a 20-component board
- [ ] Nothing in `board/` imports a model client. This is the React/Three.js rule, extended

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
It starts only when Part B's comparator is real and tested, because the grade and the Coach on
assigned tasks are functions of the comparator's output, and the Free Build Coach is a function of
Tier 1, the solver and Phase 26. Building any of them on top of a diagnostic engine you do not yet
trust produces a grade you cannot defend and feedback you cannot stand behind.

**Order in 1.2:** 22 → 23 → 24 → 27 → 25. Phase 27 follows Phase 24 directly, while the Coach is
fresh in everyone's head.

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

## Phase 24 — AI Coach Core, and Run in Free Build
**Duration:** 6 days

Free Build is `/sandbox`: no exercise, no grade, no deadline. A student builds whatever they like.
This phase builds the Coach itself, running on a self-hosted Qwen model, and wires it to the
**Run** button for a full summary. Phase 27 then makes it active.

### What the Coach is, and what it is not

The Coach **does not diagnose**. It never decides whether a circuit is right, never locates a
fault, never assigns a mark, and never sees the golden netlist. The deterministic engine does all
of that first and hands the Coach a finished result. In Free Build it does not even choose what
to talk about: the digest names the focus. The Coach's only job is to say that result in language
a first-year student wants to read.

This split is not squeamishness about language models. It is what keeps the project's central
claim intact: the accuracy numbers in the results chapter come from a deterministic function that
returns the same answer every time it is run. Put a model in that path and the numbers stop being
reproducible, and the first panelist to ask "would it say the same thing tomorrow?" has taken the
contribution apart. The split is also what makes a small free model good enough. The hard part
has already been done by code the model cannot overrule.

```
board state
    │
    ▼
Tier 1 rules ───────────┐
DC solver ──────────────┤
Phase 26 suggestions ───┼──▶  DIAGNOSTIC DIGEST  ──▶  Qwen  ──▶  grounding  ──▶  student
Tier 2 comparator ──────┘       (facts, JSON)        (words)      check          reads it
  (assignments only)                  │                             │
                                      │                     fail ───┴──▶ deterministic text
                                      └──▶  grade()  ──▶  score   (assignments only)
```

The digest feeds the grade and the Coach alike. The grade never passes through the model.

**Tasks**
1. **The model server.** Stand up Ollama (simplest) or vLLM (better under concurrent load) on the
   machine the team chose, and pull two or three Qwen instruct candidates in the 4–9B range at
   4-bit quantization. Use a non-thinking instruct variant, or switch thinking off: the job is
   wording, and thinking tokens are latency the student sits through. Expose the server to the
   API only, behind a shared secret, through an authenticated tunnel. Its URL, model tag and secret
   live in `COACH_BASE_URL`, `COACH_MODEL` and `COACH_API_KEY` on the server only. Add all three to
   `.env.example`. Most Qwen open-weight checkpoints are Apache 2.0, but confirm the licence of the
   exact one you ship
2. **`api/ai/provider.ts` — the adapter.** One function: messages in, parsed JSON out, with a hard
   timeout and an `AbortSignal`. It speaks OpenAI-compatible `/v1/chat/completions`. Ask for
   schema-constrained JSON where the server supports it (Ollama's `format`, vLLM's guided JSON),
   and **validate with Zod regardless**. A small model will sometimes return malformed JSON, and
   malformed output means a fallback, never a crash
3. **`api/ai/digest.ts` — the digest**, now in two shapes. On assignments it is unchanged from
   1.1. In Free Build it is built from Tier 1, the DC solver and Phase 26, with a `focus` chosen
   by code:

```jsonc
{
  "context":     { "mode": "free_build", "trigger": "settle", "revision": 17,
                   "hintLevel": 1, "locale": "fil" },
  "verdict":     "clean" | "issues",
  "focus":       "f1",
  "faults":      [{ "id": "f1", "class": "floating_lead", "rows": ["14"], "severity": "advisory",
                    "cause": "...", "guidingQuestion": "...", "hint": "...", "correction": "..." }],
  "suggestions": [{ "id": "s1", "rule": "led_dim", "rows": ["22"],
                    "detail": "LED current 0.3 mA", "advice": "..." }],
  "recognized":  [{ "id": "p1", "pattern": "voltage_divider", "rows": ["10", "20"],
                    "values": { "vout": "2.5 V" },
                    "tryNext": [{ "id": "p1.t1", "text": "..." }] }],
  "correct":     [{ "id": "c1", "what": "LED orientation", "detail": "anode toward the supply" }],
  "process":     { "durationMs": 742000, "hintsUsed": 1, "faultsSelfResolved": 2 }
}
```

   **The server builds the digest from the board state itself**, using the same `board/` functions
   the browser runs. It never accepts findings computed by the client. **The digest carries no
   name, email, student number or id.** The model is never told who it is talking to.
   **Focus order:** blocking faults, then advisory faults, then suggestions, then recognised
   patterns. Ties go to the finding nearest the supply, so the most upstream problem comes first,
   which is the same rule Phase 14 follows
4. **The system prompt is a contract**, versioned in `api/ai/prompts/coach.v1.ts` and recorded in
   `ai_feedback.prompt_version`. It states: you are given a completed analysis; you may only
   describe faults in `faults[]`, suggestions in `suggestions[]`, patterns in `recognized[]` and
   strengths in `correct[]`; you may not add, merge, rank or invent any; talk about the focus item
   and mention others only as a count; at `hintLevel` 1 ask the guiding question, at 2 give the
   hint, and never state the correction below 3; name at least one genuine strength in a Run
   summary; 60 words for a nudge, 150 for a summary; second person; no blame; write in the digest's
   locale. Keep the prompt byte-identical across requests and put it first. vLLM's prefix caching
   and llama.cpp's prompt cache then reuse it instead of re-reading it every call
5. **The grounding check**, the safety mechanism that makes this defensible. It runs on the
   **complete** message, **before any of it is sent to the client**:
   - every fault, suggestion, pattern and try-next id it cites exists in the digest
   - every row label it mentions exists in the digest
   - **every electrical quantity** (a number with Ω, V, A, mA, W or F) appears in the digest. This
     is the check that stops "try a 10 Ω resistor"
   - **no spoilers:** below `hintLevel` 3, the message contains no row or value that appears only
     in the correction
   - its `focusId` equals the digest's `focus`

   Any failure sets `grounding_ok` to false and serves the deterministic template text instead.
   The student sees good feedback either way. The only difference is whether the model wrote it or
   it was assembled from Phase 15's strings
6. **Fallback path.** No model server, an outage, a timeout, malformed JSON or a failed grounding
   check all resolve to the same thing: the Phase 15 deterministic text, rendered in the same card.
   `fell_back` records it. **Latency is a fallback condition too.** If the model has not answered
   inside the budget (4 s for a nudge, 8 s for a Run summary), abort the call and serve the
   deterministic text. The trainer must be fully usable with the model switched off, because a lab
   with no internet still teaches
7. **The model bake-off.** Run each candidate over the 50-fixture grounding set in both languages,
   on the hardware the pilot will use. Record for each: grounding pass rate, malformed-output rate,
   median and 95th-percentile latency, and a blind readability rating from two teammates who do
   not know which model wrote what. Keep the **smallest** model that passes grounding on ≥90% of
   fixtures and stays inside the latency budget at p95. Write it up in `docs/coach-model.md`. That
   file is the answer when a panelist asks "why this model?"
8. Rate limit per student, and a concurrency cap on the model server. Requests past the cap wait
   briefly and then fall back. A full lab must degrade to deterministic text, not freeze the panel
9. Free Build UI: a **Run** button giving the full summary, with strengths first, then issues, then
   one next step. It is released only once complete, like every other model message. Bilingual
   output follows the profile locale
10. Log provider, model tag, token counts from the response's `usage`, and latency to `ai_feedback`
    on every call

**Cost.** Nothing per request. The cost moves to hardware: an 8B model at 4-bit needs roughly
5–6 GB of GPU memory, which one mid-range consumer graphics card provides. A CPU-only machine can
run it, but not at the latency active coaching needs. If the school has no such machine, a free
hosted tier covers development while the team finds one. The bake-off numbers also say exactly
what any other endpoint would have to beat.

**DoD**
- [ ] Pressing Run on a broken free build shows a summary within 8 seconds, or deterministic text if the model is slower
- [ ] The summary names a real strength every time, including on a badly broken board
- [ ] Every fault, suggestion, row and electrical value mentioned exists in the digest — asserted by an automated grounding test over 50 fixtures
- [ ] Model text that failed grounding never reaches the client — asserted on the raw response body
- [ ] Stopping the model server degrades to deterministic text with no visible error
- [ ] A digest with `verdict: clean` produces praise and no invented criticism
- [ ] `COACH_BASE_URL`, `COACH_MODEL` and `COACH_API_KEY` do not appear in the built client bundle — grep to confirm
- [ ] No request to the model carries a student's name, email, student number or id — asserted on the outgoing payload
- [ ] Filipino output is idiomatic, checked by a native speaker, not machine round-tripped. If the chosen model cannot manage it, Filipino is served from the deterministic strings and `docs/coach-model.md` says so
- [ ] `docs/coach-model.md` records the bake-off and the model chosen
- [ ] Provider, model, tokens and latency are recorded for every call

---

## Phase 27 — Active Coaching in Free Build
**Duration:** 6 days
Added in 1.2. Numbered 27 so that no existing reference moves. It **runs straight after
Phase 24**, before Phase 25.

Phase 24 built the Coach. This phase makes it watch. Generating a message is the easy part. The
hard part is knowing when to stay quiet. A coach that comments on every dropped lead is a nag,
and students switch nags off. The interaction design is the deliverable here, more than the code.

```
edit ─▶ board settles ─▶ changed in a way that matters? ── no ──▶ nothing
                                    │ yes
                                    ▼
             browser: Tier 1 + solver + Phase 26          (instant, no network)
                  │                           │
        deterministic card             POST /api/sandbox/:sessionId/coach
          shows at once                       │
                                   server rebuilds the digest from the board
                                   Qwen (≤ 4 s) ─▶ grounding check
                                              │
                            pass: the card's text is replaced by the Coach's
                            fail or late: the card stays as it is
```

**Tasks**
1. **Coach level.** The student picks Off, On request or Active in the feedback panel. The default
   is Active. The class's `sandbox_coach` sets the ceiling, and across a student's classes the most
   restrictive one wins. The server reads both on every request, never trusting the client's copy
2. **Settle detection.** A board revision is settled once 2.5 s pass with no edit, and only while
   Phase 13's construction-progress heuristic says no lead is in hand. Nothing is sent for a
   revision that has not settled
3. **Change gate.** Hash the canonical netlist (Phase 11) together with the set of finding ids. If
   the hash matches the last coached revision, send nothing. Moving a part to an equivalent row
   changes neither, so it costs no call. This is Phase 11's headline property earning its keep a
   second time
4. **Pacing.** At most one unsolicited message every 20 s. At most one message asks for attention
   at a time, and older ones collapse into a history. A per-student daily cap on model calls;
   past it, deterministic nudges only
5. **The endpoint.** `POST /api/sandbox/:sessionId/coach` takes the board state and its revision
   number. The server checks that the session is the caller's own, then applies the class
   ceiling. **If the caller has an open attempt on an assignment whose `live_diagnostics` is `off`,
   it returns `{ state: "paused", reason: "exam_open" }` and does nothing else.** The sandbox must
   not become a second screen for an exam. Otherwise it rebuilds the digest from the board, calls
   the model, checks grounding, and returns
6. **Stale messages are never shown.** When a newer revision settles, the client aborts the old
   request and the server aborts the model call. No message is ever displayed for a board the
   student has already changed
7. **Automatic escalation.** A finding that stays on the board climbs the Phase 15 ladder on its
   own. Rung 1, the guiding question, comes when it is first raised. Rung 2, the narrowed hint,
   comes after 60 s, or after 3 more settled revisions with the finding still present. Rung 3, the
   explicit fix, is only **offered**, as a "Show me the fix" button, and never shown unasked. Each
   rung is logged
8. **Resolution.** When a coached finding leaves the board, the panel confirms it at once in
   deterministic text ("Fixed — row 14 now reaches row 15"). That costs no model call. It sets
   `resolved_at` on the message that raised the finding. Time from shown to resolved is Free
   Build's counterpart of isolation time
9. **The panel.** The Coach's thread sits in the feedback panel, newest first. A message whose
   revision is out of date greys out and says "You've changed the board since this." Each message
   has **Show me** (camera to the rows, from Phase 15) and a thumbs up or down. The panel has
   **Quiet**, which pauses Active for this session in one click. A screen reader announces each
   message once and complete, through a `polite` live region: never token by token, never
   `assertive`. Reduced motion means no typing animation
10. **Deterministic floor.** When the model is off, the ceiling is `deterministic`, or the server
    cannot be reached, the same pipeline runs entirely in the browser and speaks Phase 15
    strings. The student sees the same panel either way
11. **Load test.** 35 simulated students building at once against the pilot hardware. The pass
    condition is not "the model keeps up". It is "every student gets a nudge within budget,
    model-written or deterministic"
12. **Usability check.** Five students, 20 minutes of Free Build each, thinking aloud. Each rates
    the Coach from annoying to helpful on a 5-point scale. Tune the settle delay, the pacing and
    the escalation timings from what you watch, not from what seems reasonable. Record everything
    in `docs/usability-coach.md`

**DoD**
- [ ] Moving a part to an equivalent position makes no model call — asserted by a test that counts calls
- [ ] No message is shown for a revision the student has already changed — e2e test against a deliberately slow mock model
- [ ] When a fault appears, its deterministic card is on screen at once, and the Coach's wording follows within 4 s at p50 on the pilot hardware, or the card stays deterministic
- [ ] Rung 1 and rung 2 messages never contain the fix — automated no-spoiler test over the fixture set
- [ ] While the student has an exam-mode attempt open, the sandbox Coach is paused — tested against the API with curl, not only in the UI
- [ ] A class ceiling of `off` suppresses every nudge, model-written and deterministic
- [ ] With the model server stopped, Active still nudges, deterministically, with no visible error
- [ ] Load test passes: 35 simulated students, every nudge within budget
- [ ] A screen reader announces each message once, complete
- [ ] ≥4 of 5 usability participants rate the Coach helpful, and no severity-1 "nagging" finding is left open

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
| B — Diagnostic Engine | 9–20, 26 | 55 |
| C — Assignments, Grading & AI Coach | 22–25, 27 | 26 |
| Evaluation | 21 | 10 |
| **Total** | | **~126 days (≈25 weeks)** |

Add 20% buffer. Phases 10 and 14 are still the most likely to overrun.

**Run order is not number order.** Phase 26 runs in Part B right after Phase 16. Part C runs
22 → 23 → 24 → 27 → 25. **Phase 21 runs last**, after Part C, despite its number, because the
pilot needs assignments, grading and the Coach in place to measure the three arms in Section 2.10.
Numbers are only ever appended, so that `docs/phase-status.md` and every existing reference stay
valid.

**If the schedule slips**, cut in this order: Phase 25's manual release mode, then Phase 24's
bilingual output, then Phase 23's CSV export, then Phase 27's automatic escalation (nudges stay,
and the hint ladder goes back to clicks), then Phase 26's pattern recognizer (the suggestion rules
stay). Do not cut the Phase 25 release gate, the Phase 24 grounding check, or the Phase 27 exam
pause. An assignment system that leaks corrections during a graded task is worse than no
assignment system, because it produces numbers that look like results and are not.

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
| **The model invents a fault, a value or a fix the engine never produced** | **Student chases a problem that is not there, or builds something harmful; trust gone** | **Grounding check on the complete message before the client sees it: ids, rows, every electrical quantity, no spoilers; falls back to deterministic text; 50-fixture automated test** |
| **Panel objects "the AI is doing the diagnosis"** | **Defense risk — the contribution looks like a wrapper** | **Architecture diagram showing the model strictly downstream of the digest; the digest, not the model, picks what to talk about; Phase 20 accuracy numbers computed with the model absent; Coach can be switched off entirely and the trainer still works** |
| **Model server down, slow or overloaded during a lab** | **Nudges stall; sessions feel broken** | **Latency budget is itself a fallback condition; concurrency cap; deterministic floor runs in the browser; 35-student load test in Phase 27; pilot assignments run on `after_due`, so no graded session ever waits on the model** |
| **A small free model writes poorly, or writes poor Filipino** | **Coach reads worse than the deterministic text it replaces** | **Phase 24 bake-off chooses on measured grounding, latency and blind readability; grounding failures fall back; Filipino can fall back to deterministic strings, documented** |
| **Active coaching feels like nagging** | **Students switch it off; the usability score falls** | **Settle detection; change gate on the canonical netlist; one message per 20 s; Quiet toggle; Phase 27 usability check with a pass threshold** |
| **Sandbox used as a second screen during an exam** | **Exam-mode integrity is gone** | **Sandbox Coach pauses on the server while the student has an exam-mode attempt open; tested with curl** |
| **A free hosted endpoint rate-limits or keeps prompts** | **Lab stalls; student data leaves the school** | **Self-host for the pilot; hosted free tiers for development only; the digest carries no identity at all** |
| **Auto-grade disputed by a student** | **Instructor loses confidence in the whole system** | **`grade()` is pure and re-runnable on the stored digest; the breakdown shows every line; override with a mandatory note keeps both numbers** |
| **Client clock manipulation to beat a timer** | **Timed assessments meaningless** | **Every deadline and expiry is a server timestamp; the client only counts down to one; server auto-submits past `expires_at`** |

---

## 5. Non-Negotiables

1. `board/` never imports React or Three.js.
2. No fault is ever communicated by color alone.
3. The golden netlist never reaches a student client, and no database credential, API key or model
   server secret ever reaches any client.
4. The diagnostic engine is deterministic and pure. Tier 1 and the DC solver run in the browser;
   Tier 2 runs on the API because it needs the golden netlist. The API never *decides* anything a
   pure function could not — it only runs those functions where the data is.
5. Every diagnostic rule is a pure, unit-tested function.
6. **No generative AI in the diagnostic path.** The model receives a completed diagnostic digest
   and writes prose. It never determines whether a circuit is correct, never locates or classifies
   a fault, never computes a grade, and never sees the golden netlist. It does not choose what to
   talk about either: the digest names the focus. Every number in the results chapter is produced
   with the model absent.
7. **Every AI output is grounded before the student sees any of it.** Any fault, row, value or
   claim not present in the digest fails the grounding check, and the deterministic text is served
   instead.
8. **The trainer is fully usable with the AI switched off.** The Coach is an improvement to how
   feedback reads, never a dependency for feedback existing.
9. **On a graded task, no feedback reaches the student before the assignment releases it** — and
   the gate is server-side, because a client-side gate is not a gate. Active coaching never runs on
   assessed work, and it pauses in Free Build while an exam-mode attempt is open.
10. **Deadlines, timers and attempt caps are enforced by the server.** The client displays them; it
    never decides them.
11. **The model is never told who the student is.** No name, email, student number or id is ever
    part of a model request.
12. A phase with unchecked DoD boxes is not finished.
