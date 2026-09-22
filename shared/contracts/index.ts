/**
 * The contract surface. Import from `@shared/contracts` on both sides:
 *
 *   import { loginRequestSchema, type LoginRequest } from '@shared/contracts'
 *
 * These modules are the only thing the API and the frontend share. Nothing here
 * may import from `src/` or `api/` — the dependency runs one way, or the shared
 * layer stops being shared.
 *
 * Names are domain-prefixed rather than short (`exerciseListQuerySchema`, not
 * `listQuery`) precisely because everything lands in one flat namespace here.
 */

export * from './common.ts'
export * from './errors.ts'
export * from './health.ts'
export * from './auth.ts'
export * from './profile.ts'
export * from './classes.ts'
export * from './exercises.ts'
export * from './attempts.ts'
export * from './grading.ts'
