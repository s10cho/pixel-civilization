import type { BuildingType } from '../building/types';
import { ACHIEVEMENTS_REWARD } from '../config/balance';
import { territoryTileCount } from '../world/territory';
import type { GameState } from '../simulation/gameState';
import { eraIndex } from './era';

export type AchievementId =
  | 'firstHome'
  | 'homes10'
  | 'homes25'
  | 'firstShop'
  | 'firstPark'
  | 'firstPower'
  | 'everyBuilding'
  | 'population50'
  | 'population150'
  | 'gold1000'
  | 'level5'
  | 'level10'
  | 'research5'
  | 'medieval'
  | 'industrial'
  | 'expand3'
  | 'wideTerritory'
  | 'happiness80'
  | 'building3'
  | 'firstRailway'
  | 'population1000'
  | 'happiness90'
  | 'parks20'
  | 'territory1000'
  | 'throughTheMountain'
  | 'roads50'
  | 'buildings150'
  | 'oldTown';

interface AchievementDefinition {
  /** How far the city has come on this achievement's measure. */
  measure(state: GameState): number;
  /** The value that completes it. */
  target(): number;
  /** A small thank-you when it completes. */
  rewardGold?: number;
}

const countType = (state: GameState, type: BuildingType): number =>
  state.buildings.reduce((total, building) => total + (building.type === type ? 1 : 0), 0);

/**
 * Gentle milestones: every one is something the city passes on its way, never a challenge to
 * fail. Each is a measure plus a target, so the list can show progress as well as completion.
 */
const DEFINITIONS: Record<AchievementId, AchievementDefinition> = {
  firstHome: { measure: (s) => countType(s, 'house'), target: () => 1, rewardGold: ACHIEVEMENTS_REWARD.small },
  homes10: { measure: (s) => countType(s, 'house'), target: () => 10, rewardGold: ACHIEVEMENTS_REWARD.medium },
  homes25: { measure: (s) => countType(s, 'house'), target: () => 25, rewardGold: ACHIEVEMENTS_REWARD.large },
  firstShop: { measure: (s) => countType(s, 'shop'), target: () => 1, rewardGold: ACHIEVEMENTS_REWARD.small },
  firstPark: { measure: (s) => countType(s, 'park'), target: () => 1, rewardGold: ACHIEVEMENTS_REWARD.small },
  firstPower: { measure: (s) => countType(s, 'powerPlant'), target: () => 1, rewardGold: ACHIEVEMENTS_REWARD.small },
  everyBuilding: {
    measure: (s) => new Set(s.buildings.map((building) => building.type)).size,
    target: () => 8,
    rewardGold: ACHIEVEMENTS_REWARD.large,
  },
  population50: { measure: (s) => Math.floor(s.resources.population), target: () => 50, rewardGold: ACHIEVEMENTS_REWARD.medium },
  population150: { measure: (s) => Math.floor(s.resources.population), target: () => 150, rewardGold: ACHIEVEMENTS_REWARD.large },
  gold1000: { measure: (s) => Math.floor(s.resources.gold), target: () => 1000 },
  level5: { measure: (s) => s.cityLevel, target: () => 5, rewardGold: ACHIEVEMENTS_REWARD.medium },
  level10: { measure: (s) => s.cityLevel, target: () => 10, rewardGold: ACHIEVEMENTS_REWARD.large },
  research5: { measure: (s) => s.research.completed.length, target: () => 5, rewardGold: ACHIEVEMENTS_REWARD.medium },
  medieval: { measure: (s) => eraIndex(s.era), target: () => 1, rewardGold: ACHIEVEMENTS_REWARD.medium },
  industrial: { measure: (s) => eraIndex(s.era), target: () => 2, rewardGold: ACHIEVEMENTS_REWARD.large },
  expand3: { measure: (s) => s.expansionLevel, target: () => 3, rewardGold: ACHIEVEMENTS_REWARD.medium },
  wideTerritory: {
    measure: territoryTileCount,
    target: () => 900,
    rewardGold: ACHIEVEMENTS_REWARD.large,
  },
  happiness80: { measure: (s) => Math.floor(s.resources.happiness), target: () => 80, rewardGold: ACHIEVEMENTS_REWARD.medium },
  firstRailway: {
    measure: (s) => countType(s, 'railway'),
    target: () => 1,
    rewardGold: ACHIEVEMENTS_REWARD.large,
  },
  // The gentle long-term milestones of Phase 2 §12: no pressure, just something to walk towards.
  population1000: {
    measure: (s) => Math.floor(s.resources.population),
    target: () => 1000,
    rewardGold: ACHIEVEMENTS_REWARD.large,
  },
  happiness90: { measure: (s) => Math.floor(s.resources.happiness), target: () => 90, rewardGold: ACHIEVEMENTS_REWARD.large },
  parks20: { measure: (s) => countType(s, 'park'), target: () => 20, rewardGold: ACHIEVEMENTS_REWARD.large },
  territory1000: { measure: territoryTileCount, target: () => 1000, rewardGold: ACHIEVEMENTS_REWARD.large },
  throughTheMountain: { measure: (s) => s.clearedTiles.length, target: () => 1, rewardGold: ACHIEVEMENTS_REWARD.large },
  roads50: { measure: (s) => countType(s, 'road'), target: () => 50, rewardGold: ACHIEVEMENTS_REWARD.medium },
  buildings150: { measure: (s) => s.buildings.length, target: () => 150, rewardGold: ACHIEVEMENTS_REWARD.large },
  oldTown: {
    measure: (s) => s.buildings.reduce((total, building) => total + (building.heritage ? 1 : 0), 0),
    target: () => 5,
    rewardGold: ACHIEVEMENTS_REWARD.medium,
  },
  building3: {
    measure: (s) => s.buildings.reduce((best, building) => Math.max(best, building.level), 0),
    target: () => 3,
    rewardGold: ACHIEVEMENTS_REWARD.medium,
  },
};

export const ACHIEVEMENT_IDS = Object.keys(DEFINITIONS) as AchievementId[];

export interface AchievementProgress {
  id: AchievementId;
  current: number;
  target: number;
  unlocked: boolean;
  rewardGold: number;
}

/** Every achievement with how far the city has come, for the list. */
export function getAchievements(state: GameState): AchievementProgress[] {
  return ACHIEVEMENT_IDS.map((id) => {
    const definition = DEFINITIONS[id];
    const target = definition.target();
    const unlocked = state.achievements.includes(id);
    return {
      id,
      current: unlocked ? target : Math.min(target, definition.measure(state)),
      target,
      unlocked,
      rewardGold: definition.rewardGold ?? 0,
    };
  });
}

export interface AchievementUnlock {
  id: AchievementId;
  rewardGold: number;
}

/** Records any achievements the city has just reached and pays their small rewards. */
export function checkAchievements(state: GameState): AchievementUnlock[] {
  const unlocked: AchievementUnlock[] = [];
  for (const id of ACHIEVEMENT_IDS) {
    if (state.achievements.includes(id)) continue;
    const definition = DEFINITIONS[id];
    if (definition.measure(state) < definition.target()) continue;
    state.achievements.push(id);
    const rewardGold = definition.rewardGold ?? 0;
    state.resources.gold += rewardGold;
    unlocked.push({ id, rewardGold });
  }
  return unlocked;
}
