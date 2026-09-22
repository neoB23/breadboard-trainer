import { z } from 'zod'

import type { FeedbackView } from '../../shared/contracts/index.ts'
import type { CoachDigest } from './digest.ts'
import { checkGrounding } from './grounding.ts'
import { buildMessages, PROMPT_VERSION } from './prompts/coach.v1.ts'
import { chatJson, type CoachConfig } from './provider.ts'

/**
 * The after-submit AI Coach: digest in, grounded feedback out.
 *
 * The model is strictly downstream of the grade. It never sees the reference
 * circuit, never decides whether anything is right, and never changes a
 * score — it rewords findings the deterministic engine already chose. When it
 * is off, slow, wrong, or unsure of itself, the result is the same card with
 * the catalogue's words in it (`source: 'rules'`), and nothing about the
 * student's experience says anything failed.
 */

const coachOutputSchema = z.object({
  suggestions: z
    .array(
      z.object({
        findingId: z.string().min(1),
        question: z.string().trim().min(1).max(400),
        fix: z.string().trim().min(1).max(400),
      }),
    )
    .max(10),
  praise: z.string().trim().min(1).max(400).nullable().default(null),
})

export interface CoachMeta {
  promptVersion: string
  model: string | null
  latencyMs: number | null
  inputTokens: number | null
  outputTokens: number | null
  /** Null when no model ran. */
  groundingOk: boolean | null
  fellBack: boolean
  /** Why the rules text was served: disabled, timeout, http, network, malformed, or the grounding reason. */
  reason: string | null
}

export interface CoachResult {
  view: FeedbackView
  meta: CoachMeta
}

const RULES_VIEW: FeedbackView = { source: 'rules', suggestions: [], praise: null }

export async function coachAfterSubmit(
  digest: CoachDigest,
  config: CoachConfig | null,
  signal?: AbortSignal,
): Promise<CoachResult> {
  const fallback = (meta: Partial<CoachMeta>): CoachResult => ({
    view: RULES_VIEW,
    meta: {
      promptVersion: PROMPT_VERSION,
      model: config?.model ?? null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      groundingOk: null,
      fellBack: true,
      reason: null,
      ...meta,
    },
  })

  if (config === null) return fallback({ reason: 'disabled' })

  const reply = await chatJson(config, buildMessages(digest), coachOutputSchema, signal ? { signal } : {})
  if (!reply.ok) return fallback({ reason: reply.reason, latencyMs: reply.latencyMs })

  const output = { suggestions: reply.data.suggestions, praise: reply.data.praise ?? null }
  const grounding = checkGrounding(output, digest)
  const usage = { inputTokens: reply.usage.inputTokens, outputTokens: reply.usage.outputTokens }

  if (!grounding.ok) {
    return fallback({ reason: grounding.reason, groundingOk: false, latencyMs: reply.latencyMs, ...usage })
  }

  return {
    view: {
      source: 'model',
      suggestions: output.suggestions,
      praise: digest.verdict === 'clean' ? output.praise : null,
    },
    meta: {
      promptVersion: PROMPT_VERSION,
      model: config.model,
      latencyMs: reply.latencyMs,
      ...usage,
      groundingOk: true,
      fellBack: false,
      reason: null,
    },
  }
}
