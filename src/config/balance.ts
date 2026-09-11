import type { BuildingDefinition, BuildingType } from '../building/types';

/**
 * Gameplay balance numbers. Values are first-pass placeholders; tune after playtesting.
 */

export const ECONOMY = {
  startingGold: 50,
  /** Power has no mechanics until Milestone 3; shown in the HUD only. */
  startingPower: 0,
  /** Gold per second the Town Hall collects for each whole citizen. */
  taxPerCitizenPerSecond: 0.1,
  /** Citizens gained per second while population is below housing capacity (at neutral mood). */
  populationGrowthPerSecond: 0.5,
} as const;

export const HAPPINESS = {
  /** Mood of a housed, employed citizen in a city with no happiness buildings. */
  base: 50,
  unemployedPenalty: 20,
  /** Temporary bonus after a leisure visit, fading at leisureBoostDecayPerSecond. */
  leisureBoost: 10,
  leisureBoostDecayPerSecond: 0.2,
  /** Cap on the summed city-wide bonus from buildings such as parks. */
  maxBuildingBonus: 30,
  /** How fast a citizen's mood moves towards its target, in points per second. */
  adjustPerSecond: 5,
  unhappyBelow: 35,
  happyFrom: 70,
  /** Walk speed multiplier at 0 and at 100 happiness. */
  speedMultiplier: [0.6, 1.4],
  /** Population growth multiplier = happiness / base, clamped to this range. */
  growthMultiplier: [0.5, 1.5],
} as const;

export const CITIZENS = {
  /** Simulated citizen entities; population beyond this is represented proportionally. */
  maxSimulated: 50,
  walkSpeedTilesPerSecond: 1.5,
  homeRestSeconds: [4, 10],
  workSeconds: [8, 16],
  leisureSeconds: [5, 10],
  /** Chance that free time (after work, or while unemployed) is spent at a leisure spot. */
  leisureChance: 0.6,
  /** Max distance from a leisure tile's centre where visitors stand, in tiles. */
  leisureSpreadTiles: 0.3,
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
    jobs: 0,
    happinessBonus: 0,
    leisureSpot: false,
  },
  house: {
    name: 'House',
    buildable: true,
    buildCost: 10,
    upgradeBaseCost: 20,
    maxLevel: 5,
    goldPerSecond: 0,
    populationCapacity: 5,
    jobs: 0,
    happinessBonus: 0,
    leisureSpot: false,
  },
  shop: {
    name: 'Shop',
    buildable: true,
    buildCost: 25,
    upgradeBaseCost: 40,
    maxLevel: 5,
    goldPerSecond: 1,
    populationCapacity: 0,
    jobs: 4,
    happinessBonus: 0,
    leisureSpot: false,
  },
  park: {
    name: 'Park',
    buildable: true,
    buildCost: 30,
    upgradeBaseCost: 50,
    maxLevel: 3,
    goldPerSecond: 0,
    populationCapacity: 0,
    jobs: 0,
    happinessBonus: 6,
    leisureSpot: true,
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
