import { app } from './app.ts'

/**
 * Vercel entry point. Every /api/* request rewrites to this one function.
 *
 * Exported as the Hono app itself, not `handle(app)` from 'hono/vercel'. The
 * Node.js runtime serves a default export as a Web handler only when it has a
 * `fetch` method; a bare function is called as a legacy `(req, res)` handler,
 * so the adapter's `(req: Request) => Response` never answers and every
 * request runs into maxDuration.
 *
 * Two deploy settings this entry point depends on, neither visible from here:
 *
 *   - The root tsconfig.json sets `rewriteRelativeImportExtensions`. The
 *     function builder transpiles file by file with that config, and without
 *     it `./app.ts` survives into the emitted JS and fails ERR_MODULE_NOT_FOUND.
 *   - The Vercel project sets VERCEL_NODE_FILTER_ENTRYPOINTS=1. Otherwise every
 *     module under api/ is deployed as its own function, which is far past the
 *     Hobby plan's limit of 12 and fails the deploy.
 */
export default app
