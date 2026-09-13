/// <reference types="vite/client" />

/** Build-time settings for the consulting service (see src/consulting/llm/config.ts). */
interface ImportMetaEnv {
  /** A relay endpoint that holds the API key server-side. Set this for a published build. */
  readonly VITE_CONSULTING_URL?: string;
  readonly VITE_CONSULTING_MODEL?: string;
  readonly VITE_CONSULTING_TIMEOUT_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * The development API key, replaced at build time (see vite.config.ts). `vite dev` fills it
 * from VITE_ANTHROPIC_API_KEY in .env.local; every build replaces it with an empty string, so
 * a key cannot be published even by accident.
 */
declare const __DEV_ANTHROPIC_KEY__: string;
