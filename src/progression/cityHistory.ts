import type { EraId } from './era';
import type { GameState } from '../simulation/gameState';
import { initialTerritory, territoryTileCount } from '../world/territory';
import { ACHIEVEMENT_IDS } from './achievements';

/**
 * How far the city has come since it was founded (Phase 2 §9). Growth only feels like growth
 * when it can be compared with the beginning, so this is a "then and now" summary.
 */
export interface CityHistory {
  /** Days since the city was founded, at least 1. */
  days: number;
  population: { first: number; now: number };
  buildings: { first: number; now: number };
  /** Tiles of land the city owns. */
  territory: { first: number; now: number };
  roads: { first: number; now: number };
  /** Each era the city has lived through, with the day it started. */
  eras: { era: EraId; day: number }[];
  achievements: { done: number; total: number };
  cityLevel: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Every city starts with its town hall and nothing else. */
const FIRST_BUILDINGS = 1;

export function getCityHistory(state: GameState, now: number = Date.now()): CityHistory {
  const roads = state.buildings.reduce((total, building) => total + (building.type === 'road' ? 1 : 0), 0);

  return {
    days: Math.max(1, Math.floor((now - state.foundedAt) / DAY_MS) + 1),
    population: { first: 0, now: Math.floor(state.resources.population) },
    buildings: { first: FIRST_BUILDINGS, now: state.buildings.length },
    territory: { first: territoryTileCount({ territory: [initialTerritory()] }), now: territoryTileCount(state) },
    roads: { first: 0, now: roads },
    eras: state.eraHistory.map((entry) => ({
      era: entry.era,
      day: Math.max(1, Math.floor((entry.at - state.foundedAt) / DAY_MS) + 1),
    })),
    achievements: { done: state.achievements.length, total: ACHIEVEMENT_IDS.length },
    cityLevel: state.cityLevel,
  };
}
