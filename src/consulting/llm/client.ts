import { consultingConfig, directApiKey, type ConsultingConfig } from './config';
import { SYSTEM_PROMPT, parseReply, userPrompt } from './prompt';
import type { CityBrief, ConsultingReply } from './types';

/** Whether a model is reachable at all. When it is not, the local advisor is the whole service. */
export function isModelAvailable(): boolean {
  return consultingConfig().mode !== 'off';
}

export function consultingMode(): ConsultingConfig['mode'] {
  return consultingConfig().mode;
}

/**
 * Asks the model to read the city. Returns null on any trouble at all — no key, no network,
 * a slow answer, a reply that does not parse — and the caller simply shows the local advice.
 * The consulting card must never depend on this succeeding.
 */
export async function askModel(brief: CityBrief): Promise<ConsultingReply | null> {
  const config = consultingConfig();
  if (config.mode === 'off') return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: headersFor(config),
      body: JSON.stringify(bodyFor(config, brief)),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const text = replyText(await response.json());
    if (!text) return null;
    return parseReply(text, new Set(brief.options.map((option) => option.id)));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function headersFor(config: ConsultingConfig): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (config.mode === 'direct') {
    headers['x-api-key'] = directApiKey();
    headers['anthropic-version'] = '2023-06-01';
    // Only ever set in `npm run dev`; a built bundle cannot reach this branch.
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  }
  return headers;
}

/**
 * The relay speaks the game's own small shape, so the key and the prompt can live on the
 * server later without the client changing. Direct mode speaks the Messages API.
 */
function bodyFor(config: ConsultingConfig, brief: CityBrief): unknown {
  if (config.mode === 'relay') return { brief };
  return {
    model: config.model,
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt(brief) }],
  };
}

/** Pulls the text out of either shape of answer. */
function replyText(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const body = payload as { content?: unknown; note?: unknown; picks?: unknown; text?: unknown };
  // A relay may simply answer with the finished object.
  if (typeof body.note === 'string' || Array.isArray(body.picks)) return JSON.stringify(body);
  if (typeof body.text === 'string') return body.text;
  if (!Array.isArray(body.content)) return null;
  const parts = body.content
    .map((part) => (typeof part === 'object' && part !== null ? (part as { text?: unknown }).text : null))
    .filter((text): text is string => typeof text === 'string');
  return parts.length > 0 ? parts.join('\n') : null;
}
