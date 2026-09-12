import { createInitialState, type GameState } from '../simulation/gameState';

/** Bump when the saved GameState shape changes, and add a step to `migrateState`. */
export const SAVE_VERSION = 2;

export class SaveFormatError extends Error {}

/**
 * Turns a stored state of any known version into the current GameState. Fields added since
 * the save was written are filled from a fresh game.
 */
export function migrateState(version: number, raw: unknown): GameState {
  if (!Number.isInteger(version) || version < 1) throw new SaveFormatError(`Unknown save version ${version}`);
  if (version > SAVE_VERSION) throw new SaveFormatError('This save was made by a newer version of the game');

  const stored = raw as Partial<GameState> | null;
  if (!stored || !Array.isArray(stored.buildings) || !stored.resources) {
    throw new SaveFormatError('Save data is damaged');
  }
  // v2 saves have no history: treat the load as the city's beginning, which is the best
  // guess available, so the comparison starts from here rather than lying about the past.
  if (!Array.isArray(stored.eraHistory) || stored.eraHistory.length === 0) {
    const now = Date.now();
    stored.foundedAt = typeof stored.foundedAt === 'number' ? stored.foundedAt : now;
    stored.eraHistory = [{ era: stored.era ?? 'ancient', at: stored.foundedAt }];
  }

  // v1 had a single on/off advisor flag; v2 has levels and a growth pace.
  const legacy = stored as { autoGrow?: boolean };
  if (version < 2 && stored.autoLevel === undefined) {
    stored.autoLevel = legacy.autoGrow === false ? 'off' : 'medium';
  }

  const base = createInitialState();
  return {
    ...base,
    ...stored,
    resources: { ...base.resources, ...stored.resources },
    research: { ...base.research, ...stored.research },
    buildings: stored.buildings,
    achievements: Array.isArray(stored.achievements) ? stored.achievements : [],
    citizens: Array.isArray(stored.citizens) ? stored.citizens : [],
  };
}
