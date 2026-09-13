/**
 * Where the consulting service gets its reasoning from.
 *
 * - `off`    — nothing configured: the local rule-based advisor is all there is. This is what
 *              the published build does, so the game stays playable offline and costs nothing.
 * - `relay`  — a small server of our own holds the API key and forwards the request. This is
 *              the shape the released game will use.
 * - `direct` — talks to the Anthropic API from the browser with a key from `.env.local`. Only
 *              `vite dev` ever sees that key: the build replaces `__DEV_ANTHROPIC_KEY__` with
 *              an empty string (see vite.config.ts), so it cannot reach a published bundle.
 */
export type ConsultingMode = 'off' | 'relay' | 'direct';

export interface ConsultingConfig {
  mode: ConsultingMode;
  /** The relay endpoint, for `relay`. */
  url: string;
  /** Which model to ask for. */
  model: string;
  /** Give up after this long; the local advisor answers instead. */
  timeoutMs: number;
}

const DEFAULT_MODEL = 'claude-sonnet-5';
const DEFAULT_TIMEOUT_MS = 12_000;

/**
 * Reads the build's environment once. Each variable is named one at a time on purpose: reading
 * `import.meta.env` as a whole makes the bundler inline every VITE_* value it can find, which
 * would put a development key into the built file even though nothing reads it.
 */
export function consultingConfig(): ConsultingConfig {
  const model = text(import.meta.env.VITE_CONSULTING_MODEL) || DEFAULT_MODEL;
  const timeoutMs = Number(text(import.meta.env.VITE_CONSULTING_TIMEOUT_MS)) || DEFAULT_TIMEOUT_MS;
  const url = text(import.meta.env.VITE_CONSULTING_URL);
  if (url) return { mode: 'relay', url, model, timeoutMs };

  // A key in the browser is a development convenience, never something to publish.
  if (directApiKey()) return { mode: 'direct', url: 'https://api.anthropic.com/v1/messages', model, timeoutMs };
  return { mode: 'off', url: '', model, timeoutMs };
}

/** The development key, if there is one. Always '' in anything but `vite dev`. */
export function directApiKey(): string {
  return text(__DEV_ANTHROPIC_KEY__);
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
