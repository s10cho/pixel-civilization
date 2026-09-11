import type { BuildingDefinition, BuildingType } from '../building/types';

/**
 * Gameplay balance numbers. Values are first-pass placeholders; tune after playtesting.
 */

export const ECONOMY = {
  startingGold: 50,
  /** Power has no mechanics until Milestone 3; shown in the HUD only. */
  startingPower: 0,
  /** Happiness has no mechanics until Milestone 2/3; shown in the HUD only. */
  startingHappiness: 50,
  /** Gold per second the Town Hall collects for each whole citizen. */
  taxPerCitizenPerSecond: 0.1,
  /** Citizens gained per second while population is below housing capacity. */
  populationGrowthPerSecond: 0.5,
} as const;

export const LEVELING = {
  /** Each upgrade costs this many times the previous one. */
  upgradeCostGrowth: 1.8,
  /** Output bonus per level above 1 (0.5 means Lv2 = 150%, Lv3 = 200%). */
  outputBonusPerLevel: 0.5,
} as const;

export const BUILDINGS: Record<BuildingType, BuildingDefinition> = {
  townHall: {
    name: 'Town Hall',
    buildable: false,
    buildCost: 0,
    upgradeBaseCost: 0,
    maxLevel: 1,
    goldPerSecond: 0,
    populationCapacity: 0,
  },
  house: {
    name: 'House',
    buildable: true,
    buildCost: 10,
    upgradeBaseCost: 20,
    maxLevel: 5,
    goldPerSecond: 0,
    populationCapacity: 5,
  },
  shop: {
    name: 'Shop',
    buildable: true,
    buildCost: 25,
    upgradeBaseCost: 40,
    maxLevel: 5,
    goldPerSecond: 1,
    populationCapacity: 0,
  },
};

export const TERRITORY = {
  /** Side length (tiles) of the square territory unlocked at the start. */
  initialSize: 8,
  /** Tiles added on every side per expansion. */
  expansionStep: 2,
  expansionBaseCost: 100,
  /** Each expansion costs this many times the previous one. */
  expansionCostGrowth: 2.5,
} as const;
