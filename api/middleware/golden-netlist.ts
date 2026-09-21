import type { MiddlewareHandler } from 'hono'

import { findGoldenNetlist } from '../../shared/contracts/index.ts'
import type { AppEnv } from './context.ts'

/**
 * Defence in depth for the one rule this project cannot survive breaking.
 *
 * The actual control is `exerciseStudentColumns` in `api/db/schema.ts`: a
 * student-facing handler never reads `golden_netlist` out of Postgres, so there
 * is nothing to leak. This middleware exists for the case that control fails —
 * someone writes `db.select().from(exercises)` in a handler that a student can
 * reach, and every test still passes because the leak is three levels down
 * inside an embedded exercise on an attempt result.
 *
 * So: after the handler runs, if the caller was a student, walk the JSON
 * response for a `goldenNetlist` / `golden_netlist` key. If one is there, the
 * response is destroyed and replaced with a 500. A student seeing an error is
 * recoverable; a student seeing the answer key is not.
 *
 * On by default everywhere, including production. The cost is one JSON re-parse
 * per student response, which is far below the database round trip that
 * produced it, and the failure it prevents is fatal to the premise of the
 * system. `API_GOLDEN_NETLIST_TRIPWIRE=0` turns it off if it ever shows up in a
 * profile — but the projections must hold on their own regardless.
 */
export const goldenNetlistTripwire: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next()

  if (process.env['API_GOLDEN_NETLIST_TRIPWIRE'] === '0') return

  // Instructors and admins are entitled to the netlist; /api/teach/* is the
  // whole point of the instructor projection. Anonymous is treated as a student
  // because it is the stricter reading.
  const session = c.get('session')
  if (session && session.role !== 'student') return

  if (c.res.headers.get('content-type')?.includes('application/json') !== true) return

  let body: unknown
  try {
    body = await c.res.clone().json()
  } catch {
    // A body that will not re-parse cannot be scanned. It also cannot have come
    // from c.json(), which is the only way a handler builds a response here.
    return
  }

  const at = findGoldenNetlist(body)
  if (at === null) return

  console.error(
    `[security] golden netlist leak blocked on ${c.req.method} ${c.req.path} at ${at}. ` +
      'A student-facing handler selected a whole exercise row instead of exerciseStudentColumns.',
  )

  // Thrown rather than returned so the error middleware builds the response and
  // the incident lands in the same log stream as every other failure.
  throw new Error(`Golden netlist leak on ${c.req.method} ${c.req.path} at ${at}`)
}
