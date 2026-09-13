/// <reference types="vite/client" />

/** Build-time settings for the consulting service (see src/consulting/llm/config.ts). */
interface ImportMetaEnv {
  /** A relay endpoint that holds the credential server-side. Set this for a published build. */
  readonly VITE_CONSULTING_URL?: string;
  /** 'anthropic' or 'gemini'; otherwise whichever development setting is present. */
  readonly VITE_CONSULTING_PROVIDER?: string;
  readonly VITE_CONSULTING_MODEL?: string;
  readonly VITE_CONSULTING_TIMEOUT_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Development credentials, replaced at build time (see vite.config.ts). `vite dev` fills these
 * from .env.local; every build replaces them with empty strings, so nothing secret can be
 * published even by accident.
 */
declare const __DEV_ANTHROPIC_KEY__: string;
declare const __DEV_GEMINI_KEY__: string;
