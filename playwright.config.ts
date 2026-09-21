import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests, closing the last Phase 3 DoD box.
 *
 * ---------------------------------------------------------------------------
 * NO BROWSER DOWNLOAD
 *
 * Playwright normally pulls ~300 MB of browser binaries on install. This project
 * installs with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` and points at the Edge that
 * is already on the machine, via `channel: 'msedge'`. Total cost: 14 MB of
 * `playwright-core`.
 *
 * The trade is honest and worth writing down: one engine, not three. These tests
 * prove the flows work in a real Chromium-family browser; they do not prove
 * anything about Firefox or WebKit. If a cross-browser matrix is ever needed,
 * `npx playwright install` and add projects — nothing else here changes.
 * ---------------------------------------------------------------------------
 *
 * The suite drives the real stack: real Postgres (PGlite), real Better Auth
 * cookies, real tokens with real expiry. The only substitution is the email
 * transport, which writes to `.e2e-outbox/` so a test can open the link the
 * server actually sent rather than a token handed to it through a back door.
 */

/**
 * Not 5173/3001. The suite runs beside `npm run dev`, not inside it: on the
 * dev ports, `reuseExistingServer` silently adopted a developer's running pair
 * — an API without the e2e env, a PGlite cluster with two writers, a database
 * being clicked around in mid-run. Dedicated ports mean the only server ever
 * reused is a previous e2e run's own. The database is split for the same
 * reason: `tests/e2e/run.mjs` points everything at `.pglite-e2e`.
 */
const WEB_PORT = 5273
const API_PORT = 3101

/** Everything the API needs to behave like a configured deployment, minus TLS. */
const apiEnv = {
  API_PORT: String(API_PORT),
  PGLITE_DATA_DIR: '.pglite-e2e',
  BETTER_AUTH_URL: `http://localhost:${WEB_PORT}`,
  BETTER_AUTH_SECRET: 'end-to-end-suite-secret-not-used-anywhere-else',
  INSTRUCTOR_INVITE_CODE: 'e2e-invite-code',
  EMAIL_OUTBOX_DIR: '.e2e-outbox',
  /**
   * The suite signs in more than ten times across its cases, which is the real
   * limiter's per-account ceiling — it would start refusing halfway through and
   * the failure would look like an auth bug. `tests/api/auth-boundary.test.ts`
   * is where the limiter itself is proved, against its configured values.
   */
  RATE_LIMIT_LOGIN: '500',
  RATE_LIMIT_LOGIN_IP: '500',
  RATE_LIMIT_EMAIL: '500',
  RATE_LIMIT_EMAIL_IP: '500',
  RATE_LIMIT_REGISTER: '500',
  RATE_LIMIT_TOKEN: '500',
}

export default defineConfig({
  testDir: './tests/e2e',
  // `.spec.ts`, not `.test.ts` — vitest's include is `tests/**/*.test.ts`, and
  // the two runners must never pick up each other's files.
  testMatch: '**/*.spec.ts',

  globalSetup: './tests/e2e/global-setup.ts',

  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    channel: 'msedge',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'edge', use: { ...devices['Desktop Chrome'], channel: 'msedge' } }],

  /**
   * Two servers, because this project runs the SPA and the API separately in
   * development and Vite proxies `/api` to the second one. On these dedicated
   * ports, `reuseExistingServer` can only ever adopt a leftover pair from a
   * previous e2e run — which has this exact env — never a developer's dev pair.
   */
  webServer: [
    {
      command: 'npx tsx api/dev-server.ts',
      port: API_PORT,
      env: apiEnv,
      reuseExistingServer: !process.env['CI'],
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120_000,
    },
    {
      command: `npx vite --port ${WEB_PORT}`,
      port: WEB_PORT,
      // The suite's vite must proxy /api to the suite's API, not dev's.
      env: { API_PORT: String(API_PORT) },
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
    },
  ],
})
