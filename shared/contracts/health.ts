import { z } from 'zod'

/**
 * `GET /api/health` — the one endpoint that already exists.
 *
 * It touches nothing, so a red health check means the function itself failed
 * rather than the database. `env` is `VERCEL_ENV` on a deployment and
 * `development` locally, which is what makes it useful for confirming a preview
 * URL is serving the build you think it is.
 */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('breadboard-trainer-api'),
  env: z.string(),
})
export type HealthResponse = z.infer<typeof healthResponseSchema>
