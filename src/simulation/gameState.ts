import type { Building } from '../building/types';
import type { Citizen } from '../citizen/types';
import { ECONOMY, EVENTS, HAPPINESS, type AutoLevel, type GrowthPace } from '../config/balance';
import { WORLD } from '../config/gameConfig';
import type { AchievementId } from '../progression/achievements';
import type { EraId } from '../progression/era';
import type { ResearchState } from '../progression/research';
import { initialTerritory, type TileRect } from '../world/territory';
import type { Project } from './projects';

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
  /** Number of territory expansions purchased, which sets the price of the next one. */
  expansionLevel: number;
  /** The bands of land the city owns; it grows towards a side the player picks. */
  territory: TileRect[];
  /** How much the advisor does on its own (see simulation/autoGrow). */
  autoLevel: AutoLevel;
  /** How fast the city grows; a comfort setting, never a difficulty. */
  growthPace: GrowthPace;
  nextBuildingId: number;
  nextCitizenId: number;
  /** When the city was founded, in epoch milliseconds. */
  foundedAt: number;
  /** When each era began, oldest first (Phase 2 §9-10: the city keeps its history). */
  eraHistory: { era: EraId; at: number }[];
  /** What the city looked like when the player last left it, for the welcome-back summary. */
  lastSeen: { at: number; population: number; buildings: number; gold: number } | null;
  /** Achievements the city has reached (see progression/achievements.ts). */
  achievements: AchievementId[];
  /** Seconds until the next happy event (see simulation/events.ts). */
  nextEventSeconds: number;
  /** Large works under construction (see simulation/projects.ts). */
  projects: Project[];
  nextProjectId: number;
  /** Fixes the rocky ridges of this city's map (see world/terrain.ts). */
  terrainSeed: number;
  /** Tiles levelled by tunnels or ground works. */
  clearedTiles: number[];
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
    territory: [initialTerritory()],
    // New cities start with the advisor on, so a first-time player always sees progress.
    autoLevel: 'medium',
    growthPace: 'standard',
    foundedAt: Date.now(),
    eraHistory: [{ era: 'ancient', at: Date.now() }],
    lastSeen: null,
    achievements: [],
    nextEventSeconds: EVENTS.intervalSeconds[0],
    nextBuildingId: 1,
    nextCitizenId: 1,
    projects: [],
    nextProjectId: 1,
    terrainSeed: (seed % 100000) + 1,
    clearedTiles: [],
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
