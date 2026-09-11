import type { Building } from '../building/types';
import type { Citizen } from '../citizen/types';
import { ECONOMY, HAPPINESS } from '../config/balance';
import { WORLD } from '../config/gameConfig';

export interface Resources {
  gold: number;
  /** Fractional while growing; display and tax use whole citizens. */
  population: number;
  power: number;
  happiness: number;
}

/** The complete, serializable state of one civilization. */
export interface GameState {
  resources: Resources;
  buildings: Building[];
  citizens: Citizen[];
  /** Number of territory expansions purchased. */
  expansionLevel: number;
  nextBuildingId: number;
  nextCitizenId: number;
  /** PRNG state for simulation randomness (see simulation/random.ts). */
  rngState: number;
}

export function createInitialState(seed: number = Date.now()): GameState {
  const state: GameState = {
    resources: {
      gold: ECONOMY.startingGold,
      population: 0,
      power: ECONOMY.startingPower,
      happiness: HAPPINESS.base,
    },
    buildings: [],
    citizens: [],
    expansionLevel: 0,
    nextBuildingId: 1,
    nextCitizenId: 1,
    rngState: seed | 0,
  };

  state.buildings.push({
    id: state.nextBuildingId++,
    type: 'townHall',
    col: Math.floor(WORLD.cols / 2),
    row: Math.floor(WORLD.rows / 2),
    level: 1,
  });

  return state;
}
