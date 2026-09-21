import { Hono } from 'hono'

import type { AppEnv } from './middleware/context.ts'
import { errorHandler, notFoundHandler } from './middleware/error.ts'
import { goldenNetlistTripwire } from './middleware/golden-netlist.ts'
import { requireRole } from './middleware/roles.ts'
import { requireSession, resolveSession } from './middleware/session.ts'
import { attemptsRoute } from './routes/attempts.ts'
import { authRoute } from './routes/auth.ts'
import { classesRoute } from './routes/classes.ts'
import { eventsRoute } from './routes/events.ts'
import { exercisesRoute } from './routes/exercises.ts'
import { health } from './routes/health.ts'
import { profileRoute } from './routes/profile.ts'
import { teachClassesRoute } from './routes/teach-classes.ts'
import { teachExercisesRoute } from './routes/teach-exercises.ts'

/**
 * The whole API is one Hono app mounted at /api, deployed as a single Vercel
 * Function and proxied to by Vite in development. Because the browser and the
 * API share an origin in both environments, CORS never enters this project.
 *
 * ===========================================================================
 * THE MIDDLEWARE CHAIN
 *
 *   error handler -> session resolver -> role guard -> handler
 *                                                   -> ownership check
 *
 * Section 2 of the build plan calls these the three places authorisation is
 * enforced, and with Neon there is no fourth: no RLS-as-a-service, no client
 * SDK, no policy layer a browser could be trusted with. **The API layer is the
 * entire security boundary.** A check that is not in this chain does not exist.
 *
 *   1. Session — who. `resolveSession` never refuses; `requireSession` does.
 *      Default-deny: every path not on PUBLIC_PREFIXES is 401 without one.
 *   2. Role — what kind. Applied once to the whole /api/teach/* subtree, which
 *      is what keeps golden netlists away from students.
 *   3. Ownership — which rows. Cannot live here, because it needs the row.
 *      Every handler taking an :id calls into `middleware/ownership.ts`.
 * ===========================================================================
 */
export const app = new Hono<AppEnv>().basePath('/api')

app.onError(errorHandler)
app.notFound(notFoundHandler)

/**
 * Registered first so it wraps everything downstream. Middleware runs
 * outside-in on the way down and inside-out on the way back, and this one does
 * its work after `next()` — it scans the finished response.
 */
app.use('*', goldenNetlistTripwire)

/** Anonymous is a legitimate outcome here. Refusing is the next block's job. */
app.use('*', resolveSession)

/**
 * The public surface, in full.
 *
 * `/api/health` must answer while the database is down, and Phase 3 mounts
 * Better Auth under `/api/auth` — signing in cannot require being signed in.
 *
 * Note the consequence for `/api/auth/me`, which the contracts say must 401:
 * it is inside a public prefix, so the handler Phase 3 writes for it applies
 * `requireSession` itself. One deliberate exception is better than a prefix
 * list with holes in it.
 *
 * Everything else is protected without being listed, and that is the point. A
 * route file added in Phase 5 is behind a session on the day it is written
 * rather than the day someone remembers to come back here.
 */
const PUBLIC_PREFIXES = ['/api/health', '/api/auth'] as const

app.use('*', async (c, next) => {
  if (isPublic(c.req.path)) return next()
  return requireSession(c, next)
})

function isPublic(path: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

/**
 * The role guard, on the subtree rather than per route — Phase 3's DoD requires
 * `/api/teach/*` to answer 403 to a student session even when called directly
 * with curl, and a guard listed once cannot be forgotten on the route added
 * next month.
 *
 * Both patterns are needed: in Hono, `/teach/*` does not match a bare `/teach`,
 * and Phase 6 puts the instructor home there.
 */
app.use('/teach', requireRole('instructor'))
app.use('/teach/*', requireRole('instructor'))

/* -------------------------------------------------------------------------- */
/* Routes                                                                     */
/* -------------------------------------------------------------------------- */

app.route('/health', health)

/**
 * Phase 3. Importing this module also installs the Better Auth session provider
 * over the null default in `middleware/session.ts` — which is why every
 * protected route above stops answering 401 the moment this line exists.
 *
 * It is a public prefix, so nothing upstream refuses an anonymous caller. The
 * two endpoints inside it that need a session apply `requireSession` themselves.
 */
app.route('/auth', authRoute)

/**
 * Phase 4. Not a public prefix, so the default-deny block above already refuses
 * an anonymous caller — every handler in it is scoped to the session's own row
 * and none of them takes an `:id`.
 */
app.route('/profile', profileRoute)

app.route('/classes', classesRoute)
app.route('/exercises', exercisesRoute)
app.route('/attempts', attemptsRoute)
app.route('/events', eventsRoute)

app.route('/teach/classes', teachClassesRoute)
app.route('/teach/exercises', teachExercisesRoute)
