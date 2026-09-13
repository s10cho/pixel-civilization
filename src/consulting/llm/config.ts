/**
 * Where the consulting service gets its reasoning from.
 *
 * - `off`    — nothing configured: the local rule-based advisor is all there is. This is what
 *              the published build does, so the game stays playable offline and costs nothing.
 * - `relay`  — a small server of our own holds the credential and forwards the request. This is
 *              the shape the released game will use, and the only one that cares nothing for
 *              which model sits behind it.
 * - `direct` — talks to a model API straight from the browser using `.env.local`. Only
 *              `vite dev` ever sees that value: the build replaces `__DEV_ANTHROPIC_KEY__`
 *              and `__DEV_GEMINI_KEY__` with empty strings (see vite.config.ts), so nothing
 *              secret can reach a published bundle.
 */
export type ConsultingMode = 'off' | 'relay' | 'direct';

/** Which model API `direct` mode speaks. A relay hides this from the game entirely. */
export type Provider = 'anthropic' | 'gemini';

export interface ConsultingConfig {
  mode: ConsultingMode;
  provider: Provider;
  /** The endpoint to POST to. */
  url: string;
  /** Which model to ask for. */
  model: string;
  /** Give up after this long; the local advisor answers instead. */
  timeoutMs: number;
}

const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic: 'claude-sonnet-5',
  gemini: 'gemini-2.5-flash',
};

const DEFAULT_TIMEOUT_MS = 12_000;

/**
 * Reads the build's environment once. Each variable is named one at a time on purpose: reading
 * `import.meta.env` as a whole makes the bundler inline every VITE_* value it can find, which
 * would put a development credential into the built file even though nothing reads it.
 */
export function consultingConfig(): ConsultingConfig {
  const timeoutMs = Number(text(import.meta.env.VITE_CONSULTING_TIMEOUT_MS)) || DEFAULT_TIMEOUT_MS;
  const provider = chosenProvider();
  const model = text(import.meta.env.VITE_CONSULTING_MODEL) || DEFAULT_MODEL[provider];

  // A relay speaks the game's own shape, so which model answers is the server's business.
  const url = text(import.meta.env.VITE_CONSULTING_URL);
  if (url) return { mode: 'relay', provider, url, model, timeoutMs };

  // Reaching a model API from the browser is a development convenience, never something to publish.
  if (devCredential(provider)) return { mode: 'direct', provider, url: directUrl(provider, model), model, timeoutMs };
  return { mode: 'off', provider, url: '', model, timeoutMs };
}

/** The development credential for a provider. Always '' in anything but `vite dev`. */
export function devCredential(provider: Provider): string {
  return provider === 'gemini' ? text(__DEV_GEMINI_KEY__) : text(__DEV_ANTHROPIC_KEY__);
}

/** Named outright by VITE_CONSULTING_PROVIDER, or whichever development setting is present. */
function chosenProvider(): Provider {
  const named = text(import.meta.env.VITE_CONSULTING_PROVIDER).toLowerCase();
  if (named === 'gemini' || named === 'anthropic') return named;
  return text(__DEV_GEMINI_KEY__) && !text(__DEV_ANTHROPIC_KEY__) ? 'gemini' : 'anthropic';
}

function directUrl(provider: Provider, model: string): string {
  return provider === 'gemini'
    ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
    : 'https://api.anthropic.com/v1/messages';
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
