import type { z } from 'zod'

/**
 * The model adapter — one function that sends chat messages to an
 * OpenAI-compatible `/chat/completions` endpoint and returns parsed JSON.
 *
 * The AI Coach runs on a free, open-weight Qwen model, self-hosted with Ollama
 * or vLLM (build plan v1.2). Both serve the OpenAI chat-completions protocol,
 * as do llama.cpp's server and most hosted Qwen providers, so this adapter is
 * the only model-specific code in the project and the base URL and model tag
 * are configuration:
 *
 *   COACH_BASE_URL   e.g. http://localhost:11434/v1 (Ollama) or http://gpu-box:8000/v1 (vLLM)
 *   COACH_MODEL      e.g. qwen3:8b
 *   COACH_API_KEY    optional — sent as a Bearer token when set
 *   COACH_TIMEOUT_MS default 8000
 *
 * With `COACH_BASE_URL` unset the coach is simply off, and every caller serves
 * the deterministic text instead. That is not an error state: the trainer is
 * fully usable with the model switched off (non-negotiable 8).
 *
 * It never throws. Every failure — timeout, HTTP error, unreachable server,
 * output that is not the JSON asked for — comes back as `{ ok: false }` with a
 * reason, because the only thing a caller ever does with a failure is fall
 * back, and a thrown error is one more way to forget to.
 */

export interface CoachConfig {
  baseUrl: string
  model: string
  apiKey: string | null
  timeoutMs: number
}

export const DEFAULT_COACH_MODEL = 'qwen3:8b'
const DEFAULT_TIMEOUT_MS = 8_000

export function coachConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): CoachConfig | null {
  const baseUrl = env['COACH_BASE_URL']?.trim()
  if (!baseUrl) return null
  const timeout = Number(env['COACH_TIMEOUT_MS'])
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    model: env['COACH_MODEL']?.trim() || DEFAULT_COACH_MODEL,
    apiKey: env['COACH_API_KEY']?.trim() || null,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS,
  }
}

/* -------------------------------------------------------------------------- */
/* Transport seam                                                             */
/* -------------------------------------------------------------------------- */

type Transport = (input: string, init: RequestInit) => Promise<Response>

const realTransport: Transport = (input, init) => fetch(input, init)
let transport: Transport = realTransport

/**
 * Tests install a fake here — the same seam pattern as `setSessionProvider`.
 * Passing null restores the real `fetch`.
 */
export function setCoachTransport(next: Transport | null): void {
  transport = next ?? realTransport
}

/* -------------------------------------------------------------------------- */
/* The call                                                                   */
/* -------------------------------------------------------------------------- */

export interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

export type ChatFailure = 'timeout' | 'aborted' | 'http' | 'network' | 'malformed'

export type ChatResult<T> =
  | {
      ok: true
      data: T
      usage: { inputTokens: number | null; outputTokens: number | null }
      latencyMs: number
    }
  | { ok: false; reason: ChatFailure; latencyMs: number; status?: number }

export async function chatJson<S extends z.ZodTypeAny>(
  config: CoachConfig,
  messages: readonly ChatMessage[],
  schema: S,
  options: { signal?: AbortSignal; now?: () => number } = {},
): Promise<ChatResult<z.output<S>>> {
  const now = options.now ?? (() => performance.now())
  const started = now()
  const elapsed = () => Math.max(0, Math.round(now() - started))

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, config.timeoutMs)
  const onCallerAbort = () => controller.abort()
  options.signal?.addEventListener('abort', onCallerAbort, { once: true })

  try {
    let response: Response
    try {
      response = await transport(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(config.apiKey !== null && { authorization: `Bearer ${config.apiKey}` }),
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: 0.2,
          max_tokens: 700,
          stream: false,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      })
    } catch {
      if (timedOut) return { ok: false, reason: 'timeout', latencyMs: elapsed() }
      if (options.signal?.aborted) return { ok: false, reason: 'aborted', latencyMs: elapsed() }
      return { ok: false, reason: 'network', latencyMs: elapsed() }
    }

    if (!response.ok) return { ok: false, reason: 'http', status: response.status, latencyMs: elapsed() }

    let body: unknown
    try {
      body = await response.json()
    } catch {
      if (timedOut) return { ok: false, reason: 'timeout', latencyMs: elapsed() }
      return { ok: false, reason: 'malformed', latencyMs: elapsed() }
    }

    const content = readContent(body)
    const json = content === null ? null : extractJson(content)
    if (json === null) return { ok: false, reason: 'malformed', latencyMs: elapsed() }

    const parsed = schema.safeParse(json)
    if (!parsed.success) return { ok: false, reason: 'malformed', latencyMs: elapsed() }

    return { ok: true, data: parsed.data as z.output<S>, usage: readUsage(body), latencyMs: elapsed() }
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onCallerAbort)
  }
}

/* -------------------------------------------------------------------------- */
/* Reading what came back                                                     */
/* -------------------------------------------------------------------------- */

function readContent(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null
  const choices = (body as { choices?: unknown }).choices
  if (!Array.isArray(choices)) return null
  const message = (choices[0] as { message?: { content?: unknown } } | undefined)?.message
  return typeof message?.content === 'string' ? message.content : null
}

/**
 * Qwen's thinking variants wrap their reasoning in `<think>…</think>` before
 * the answer, and small models sometimes add a sentence around the JSON even
 * when asked not to. Strip the first, then take the outermost object.
 */
export function extractJson(content: string): unknown {
  const answer = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  const start = answer.indexOf('{')
  const end = answer.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(answer.slice(start, end + 1))
  } catch {
    return null
  }
}

function readUsage(body: unknown): { inputTokens: number | null; outputTokens: number | null } {
  const usage = (body as { usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } }).usage
  return {
    inputTokens: typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : null,
    outputTokens: typeof usage?.completion_tokens === 'number' ? usage.completion_tokens : null,
  }
}
