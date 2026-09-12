import { createInitialState, type GameState } from '../simulation/gameState';

/** Bump when the saved GameState shape changes, and add a step to `migrateState`. */
export const SAVE_VERSION = 1;

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
  // Future versions: `if (version < 2) { ...transform stored... }`

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
