import { Hono } from 'hono'

export const health = new Hono()

/**
 * Liveness probe. Deliberately touches nothing — it must stay green even when
 * the database is down, so a red /api/health means the function itself failed.
 */
health.get('/', (c) =>
  c.json({
    status: 'ok',
    service: 'breadboard-trainer-api',
    env: process.env['VERCEL_ENV'] ?? 'development',
  }),
)
