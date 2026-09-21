import { serve } from '@hono/node-server'

import { app } from './app.ts'

const port = Number(process.env['API_PORT'] ?? 3001)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[api] listening on http://127.0.0.1:${info.port}`)
})
