import { consultingConfig, devCredential, type ConsultingConfig } from './config';
import { SYSTEM_PROMPT, parseReply, userPrompt } from './prompt';
import { replyText } from './replies';
import type { CityBrief, ConsultingReply } from './types';

/** Whether a model is reachable at all. When it is not, the local advisor is the whole service. */
export function isModelAvailable(): boolean {
  return consultingConfig().mode !== 'off';
}

export function consultingMode(): ConsultingConfig['mode'] {
  return consultingConfig().mode;
}

/**
 * Asks the model to read the city. Returns null on any trouble at all — nothing configured, no
 * network, a slow answer, a reply that does not parse — and the caller simply shows the local
 * advice. The consulting card must never depend on this succeeding.
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

/**
 * A relay needs nothing but the content type: it holds the credential itself. Direct mode
 * carries the development credential, which only `vite dev` ever fills in.
 */
function headersFor(config: ConsultingConfig): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (config.mode !== 'direct') return headers;

  if (config.provider === 'gemini') {
    headers['x-goog-api-key'] = devCredential('gemini');
    return headers;
  }
  headers['x-api-key'] = devCredential('anthropic');
  headers['anthropic-version'] = '2023-06-01';
  headers['anthropic-dangerous-direct-browser-access'] = 'true';
  return headers;
}

/**
 * The relay speaks the game's own small shape, so the credential and the prompt can live on the
 * server later without the client changing. Direct mode speaks whichever provider's own shape.
 */
function bodyFor(config: ConsultingConfig, brief: CityBrief): unknown {
  if (config.mode === 'relay') return { brief };

  if (config.provider === 'gemini') {
    return {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt(brief) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 800,
        // A few sentences about a small city needs no deliberation, and thinking tokens come
        // out of the same budget as the answer.
        thinkingConfig: { thinkingBudget: 0 },
      },
    };
  }

  return {
    model: config.model,
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt(brief) }],
  };
}
