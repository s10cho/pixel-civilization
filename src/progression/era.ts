/** Civilization eras, oldest first. */
export type EraId = 'ancient' | 'medieval' | 'industrial' | 'modern';

export const ERAS: readonly EraId[] = ['ancient', 'medieval', 'industrial', 'modern'];

export function eraIndex(era: EraId): number {
  return ERAS.indexOf(era);
}

/** The era after `era`, or null for the last one. */
export function nextEra(era: EraId): EraId | null {
  return ERAS[eraIndex(era) + 1] ?? null;
}
