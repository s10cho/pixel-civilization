import { AUDIO, QUALITY, type QualityLevel } from '../config/gameConfig';

/**
 * Player preferences. These live in localStorage (design brief: localStorage is for
 * preferences only; game saves go to IndexedDB).
 */
export interface Preferences {
  /** 0..1 */
  musicVolume: number;
  /** 0..1 */
  sfxVolume: number;
  /** A fixed preset, or 'auto' to adapt to the device's frame rate. */
  quality: QualityLevel | 'auto';
  tutorialDone: boolean;
}

const STORAGE_KEY = 'pixel-civilization:preferences';

const DEFAULTS: Preferences = {
  musicVolume: AUDIO.defaultMusicVolume,
  sfxVolume: AUDIO.defaultSfxVolume,
  quality: 'auto',
  tutorialDone: false,
};

let cached: Preferences | null = null;

export function loadPreferences(): Preferences {
  if (cached) return cached;
  let stored: Partial<Preferences> = {};
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Preferences>;
  } catch {
    // Storage blocked or corrupt: fall back to defaults.
  }
  cached = {
    musicVolume: volume(stored.musicVolume, DEFAULTS.musicVolume),
    sfxVolume: volume(stored.sfxVolume, DEFAULTS.sfxVolume),
    quality:
      stored.quality === 'auto' || (typeof stored.quality === 'string' && stored.quality in QUALITY)
        ? stored.quality
        : DEFAULTS.quality,
    tutorialDone: stored.tutorialDone === true,
  };
  return cached;
}

export function savePreferences(changes: Partial<Preferences>): Preferences {
  cached = { ...loadPreferences(), ...changes };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // Not persisted (private mode, quota); the session keeps the values.
  }
  return cached;
}

function volume(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}
