import type { Building } from '../building/types';
import type { Citizen } from '../citizen/types';
import { ECONOMY, HAPPINESS } from '../config/balance';
import { WORLD } from '../config/gameConfig';
import type { EraId } from '../progression/era';
import type { ResearchState } from '../progression/research';

export interface Resources {
  gold: number;
  /** Fractional while growing; display and tax use whole citizens. */
  population: number;
  /** Net power: supply minus demand (negative means a shortage). */
  power: number;
  happiness: number;
}

/** The complete, serializable state of one civilization. */
export interface GameState {
  resources: Resources;
  buildings: Building[];
  citizens: Citizen[];
  era: EraId;
  cityLevel: number;
  /** Experience towards the next city level. */
  cityXp: number;
  /** Highest whole population reached; new highs award XP. */
  peakPopulation: number;
  research: ResearchState;
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
      power: 0,
      happiness: HAPPINESS.base,
    },
    buildings: [],
    citizens: [],
    era: 'ancient',
    cityLevel: 1,
    cityXp: 0,
    peakPopulation: 0,
    research: { completed: [], active: null },
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
