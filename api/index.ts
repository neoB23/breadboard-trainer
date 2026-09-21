import { handle } from 'hono/vercel'

import { app } from './app.ts'

/** Vercel entry point. Every /api/* request rewrites to this one function. */
export default handle(app)
