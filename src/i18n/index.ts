import { en } from './en';
import { ko } from './ko';

export type Locale = 'en' | 'ko';
/** Every message key; the English catalog defines them. */
export type MessageKey = keyof typeof en;
/** Values a player can choose in Settings ('auto' follows the browser). */
export type LocalePreference = Locale | 'auto';

export const LOCALES: readonly Locale[] = ['en', 'ko'];

/** Each language named in itself, for the settings dropdown. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  ko: '한국어',
};

const CATALOGS: Record<Locale, Record<MessageKey, string>> = { en, ko };

function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** The first browser language the game speaks, else English. */
export function detectLocale(): Locale {
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of tags) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return 'en';
}

export function resolveLocale(preference: LocalePreference): Locale {
  return preference === 'auto' ? detectLocale() : preference;
}

let current: Locale = 'en';
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return current;
}

/** Switches language and notifies the UI to rebuild its text. */
export function setLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  document.documentElement.lang = locale;
  for (const listener of [...listeners]) listener();
}

export function onLocaleChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Looks up a message and fills its `{placeholders}`. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template = CATALOGS[current][key] ?? en[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/** For keys built at runtime (e.g. `building.house.ancient`). */
export function tKey(key: string, params?: Record<string, string | number>): string {
  return t(key as MessageKey, params);
}
