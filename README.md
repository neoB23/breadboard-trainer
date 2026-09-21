# Smart Breadboard Diagnostic Trainer

A web replacement for the hardware breadboard trainer. Students build circuits in a 3D
workspace; the system extracts a netlist, compares it against the instructor's captured
golden netlist, and diagnoses what is wrong.

Built to [`docs/build-plan.md`](docs/build-plan.md). **Phases 0 and 1 are done** — see
[`docs/phase-status.md`](docs/phase-status.md) for the Definition-of-Done checklists and
what is still outstanding.

---

## Getting started

```bash
npm install
cp .env.example .env      # nothing in it is required until Phase 2
npm run dev
```

`npm run dev` starts two processes at once:

| Process   | URL                   | What it is            |
| --------- | --------------------- | --------------------- |
| `dev:web` | http://localhost:5173 | Vite, serving the SPA |
| `dev:api` | http://127.0.0.1:3001 | Hono, via `tsx watch` |

Vite proxies `/api/*` to the Hono server, so the browser only ever talks to one origin — in
development _and_ in production. CORS is not something this project has to handle.

Check it is alive:

```bash
curl http://localhost:5173/api/health
# {"status":"ok","service":"breadboard-trainer-api","env":"development"}
```

Then open **http://localhost:5173/styleguide** — every primitive, in every state.

## Scripts

| Script                | Does                                                                        |
| --------------------- | --------------------------------------------------------------------------- |
| `npm run dev`         | SPA + API together                                                          |
| `npm run build`       | `tsc -b` across `src/`, `api/`, `tests/` and configs, then Vite             |
| `npm run typecheck`   | Types only, forced rebuild                                                  |
| `npm run lint`        | oxlint                                                                      |
| `npm run format`      | Prettier, with the Tailwind class-order plugin                              |
| `npm run preview`     | Serve the production build locally                                          |
| `npm test`            | Vitest — the API suite, against a real Postgres (PGlite) per test file       |
| `npm run test:e2e`    | Playwright — the same journeys in a real browser. Migrates and seeds first   |
| `npm run verify`      | `build` + `lint` + `test`, which is what CI will run                        |
| `npm run db:generate` | drizzle-kit: emit a migration from `api/db/schema.ts`                        |
| `npm run db:migrate`  | Apply the committed migrations                                              |
| `npm run db:seed`     | One instructor, three students, one class, two exercises — idempotent        |
| `npm run db:studio`   | drizzle-kit's table browser                                                 |

`npm run test:e2e` drives real Edge. Playwright is installed with its browser download skipped
(`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`) and pointed at the system Edge via `channel: 'msedge'`,
so it costs 14 MB rather than 300. See `playwright.config.ts`.

A `pre-commit` hook runs `lint-staged` (oxlint `--fix`, then Prettier) over staged files.

## Layout

```
src/
  app/                router, preference store
  features/           one folder per product area
  board/              PURE LOGIC — no React, no Three.js, ever
  render/             R3F components (visual only)
  components/ui/      the design system primitives
  components/layout/  AppShell, PageHeader
  lib/                api client, utils
  styles/             design tokens
api/
  app.ts              the Hono app, mounted at /api
  routes/             one file per resource
  db/                 Drizzle schema + committed migrations (Phase 2)
  middleware/         error handling, then session and role guards (Phase 2)
shared/
  contracts/          Zod schemas imported by BOTH api/ and src/
```

Two rules worth more than they look:

1. **`src/board/` must never import React or Three.js.** That is what keeps the diagnostic
   logic unit-testable, and the accuracy numbers in Phase 20 depend on running thousands of
   headless cases in seconds.
2. **The browser never holds a database connection string.** Neon has no client SDK and no
   policy layer that is safe to expose, so the API is the entire security boundary. It is
   also why a student client structurally _cannot_ receive a golden netlist — no client
   queries the database at all.

## Design system

Read [`docs/design-system.md`](docs/design-system.md) before adding a screen.

The short version: Tailwind's stock palette is **deleted** from the theme, so `bg-red-500`
fails to compile. The only colours that exist are the tokens in `src/styles/tokens.css`, and
state is never encoded by colour alone — `StatusBadge` hard-wires a distinct icon per tone,
and `/styleguide` ships a colour-vision simulator so that claim can be checked rather than
asserted.

## Deployment

Vercel serves the SPA from `dist/` and rewrites `/api/*` to a single function at
`api/index.ts` (see `vercel.json`). Nothing is provisioned yet — the remaining manual steps
are listed in [`docs/phase-status.md`](docs/phase-status.md).
