import { and, asc, eq, gt } from 'drizzle-orm'
import { Hono } from 'hono'

import { jsonValueSchema, uuidSchema } from '../../shared/contracts/index.ts'
import { z } from 'zod'

import { db } from '../db/client.ts'
import { EVENT_TYPES, events, type NewEvent } from '../db/schema.ts'
import { sessionOf, type AppEnv } from '../middleware/context.ts'
import { loadOwnAttempt, loadReadableAttempt } from '../middleware/ownership.ts'
import { parseJsonBody, parseQuery } from '../middleware/validate.ts'
import { iso, toJson } from './serializers.ts'

/**
 * Telemetry ingestion. Phase 17 builds the client-side logger, the IndexedDB
 * offline queue and the analytics that read this table; Phase 2 owes it a place
 * to write, ownership-checked, so the workspace shell in Phase 7 can start
 * emitting before any of that exists.
 *
 * The contracts for these shapes live here rather than in
 * `shared/contracts/`, deliberately. The event *payload* interiors are decided
 * by Phase 13's fault classes and Phase 15's hint ladder; publishing a shared
 * contract now would mean publishing a guess, and a guessed contract has to be
 * broken to be corrected. The envelope is stable, so the envelope is what this
 * file defines — move it across when the payloads are real.
 */
export const eventsRoute = new Hono<AppEnv>()

const eventInputSchema = z.object({
  type: z.enum(EVENT_TYPES),
  /**
   * Client-supplied so an event queued offline keeps the time it actually
   * happened rather than the time the queue drained. Absent means now.
   */
  ts: z.iso.datetime({ offset: true }).optional(),
  payload: jsonValueSchema.optional(),
})

/**
 * Batched. Placement telemetry fires on every drag, and one request per event
 * would put a serverless round trip in the middle of the interaction the Phase
 * 10 DoD requires to feel instant.
 *
 * The cap is a size limit, not a policy: 200 events is a long offline session
 * flushing at once, and anything larger is a bug or an attack rather than a
 * lab.
 */
const eventBatchSchema = z.object({
  attemptId: uuidSchema,
  events: z.array(eventInputSchema).min(1).max(200),
})

const eventListQuerySchema = z.object({
  attemptId: uuidSchema,
  /** Cursor. `events.id` is a bigserial, so it is already the insertion order. */
  after: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
})

/* -------------------------------------------------------------------------- */
/* POST /api/events                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Writes are scoped to an attempt the caller owns — `loadOwnAttempt`, not
 * `loadReadableAttempt`. An instructor may read a student's telemetry; nobody
 * may write into someone else's, or the fault-isolation numbers stop meaning
 * anything.
 *
 * Note what is missing: idempotency. Phase 19 requires an offline queue to sync
 * "with no loss or duplication", which needs a client-generated key and a
 * unique index on it — a column `events` does not have. That migration belongs
 * to Phase 17 alongside the logger that would populate it; until then a
 * double-flushed batch double-writes.
 */
eventsRoute.post('/', async (c) => {
  const session = sessionOf(c)
  const body = await parseJsonBody(c, eventBatchSchema)

  await loadOwnAttempt(session, body.attemptId)

  const rows: NewEvent[] = body.events.map((event) => ({
    attemptId: body.attemptId,
    type: event.type,
    ...(event.ts !== undefined && { ts: new Date(event.ts) }),
    payload: event.payload ?? null,
  }))

  const written = await db.insert(events).values(rows).returning({ id: events.id })

  return c.json({ accepted: written.length }, 201)
})

/* -------------------------------------------------------------------------- */
/* GET /api/events                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The raw stream for one attempt. `/results/:attemptId` gets a derived timeline
 * from the attempts route instead; this is the audit view the Phase 17 DoD
 * calls for ("results page matches raw event data on manual audit") and the
 * source of Phase 18's CSV export.
 */
eventsRoute.get('/', async (c) => {
  const session = sessionOf(c)
  const query = parseQuery(c, eventListQuerySchema)

  await loadReadableAttempt(session, query.attemptId)

  const rows = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.attemptId, query.attemptId),
        ...(query.after === undefined ? [] : [gt(events.id, query.after)]),
      ),
    )
    .orderBy(asc(events.id))
    .limit(query.limit)

  return c.json({
    items: rows.map((row) => ({
      id: row.id,
      attemptId: row.attemptId,
      ts: iso(row.ts),
      type: row.type,
      payload: toJson(row.payload),
    })),
    /** Feed back as `?after=` to continue. Null when the stream is drained. */
    nextCursor: rows.length === query.limit ? (rows[rows.length - 1]?.id ?? null) : null,
  })
})
