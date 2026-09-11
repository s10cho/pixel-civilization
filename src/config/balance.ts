import type { BuildingDefinition, BuildingType } from '../building/types';
import type { EraId } from '../progression/era';

/**
 * Gameplay balance numbers. Values are first-pass placeholders; tune after playtesting.
 */

export const ECONOMY = {
  startingGold: 50,
  /** Gold per second the Town Hall collects for each whole citizen. */
  taxPerCitizenPerSecond: 0.1,
  /** Citizens gained per second while population is below housing capacity (at neutral mood). */
  populationGrowthPerSecond: 0.5,
} as const;

/** Per-era difficulty and reward scaling (design brief §35). */
export const ERA_SETTINGS: Record<
  EraId,
  { name: string; costMultiplier: number; outputMultiplier: number; powerDemandMultiplier: number }
> = {
  ancient: { name: 'Ancient', costMultiplier: 1, outputMultiplier: 1, powerDemandMultiplier: 1 },
  medieval: { name: 'Medieval', costMultiplier: 1.6, outputMultiplier: 1.8, powerDemandMultiplier: 1.5 },
  industrial: { name: 'Industrial', costMultiplier: 2.5, outputMultiplier: 3, powerDemandMultiplier: 2.5 },
};

/**
 * What a city needs to enter each later era (design brief §10): population and city level
 * here, plus the research whose `opensEra` names the era.
 */
export const ERA_REQUIREMENTS: Record<Exclude<EraId, 'ancient'>, { population: number; cityLevel: number }> = {
  medieval: { population: 50, cityLevel: 5 },
  industrial: { population: 150, cityLevel: 8 },
};

export const POWER = {
  /** Output share a power-hungry building keeps with no power at all. */
  minEfficiency: 0.4,
} as const;

export const STAFFING = {
  /** Output share a workplace keeps with nobody to staff it. */
  minEfficiency: 0.3,
} as const;

/** Neighbour effects between buildings (8 surrounding tiles). */
export const ADJACENCY = {
  radius: 1,
  shopPerHouseBonus: 0.15,
  shopMaxHouses: 3,
  factoryNearPowerBonus: 0.15,
  /** Growth bonus scales with the share of houses that have a park next door. */
  parkHomeGrowthBonus: 0.2,
  parkHomeHappiness: 5,
} as const;

export const POLLUTION = {
  /** Homes within this many tiles of a factory are affected. */
  radius: 2,
  happinessPerUnit: 12,
  maxPenalty: 25,
} as const;

export const PROBLEMS = {
  /** Below this city happiness, population stops growing. */
  lowHappinessBelow: 35,
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
  /** Population growth multiplier = happiness / base, clamped (growth stops below PROBLEMS). */
  growthMultiplier: [0.7, 1.5],
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

/** City XP and levels. */
export const PROGRESSION = {
  /** XP for level 1 -> 2; each later level needs xpGrowth times more. */
  baseXp: 40,
  xpGrowth: 1.55,
  maxLevel: 12,
  xp: {
    build: 10,
    /** Times the level reached. */
    upgradePerLevel: 8,
    expand: 40,
    research: 30,
    era: 100,
    /** For each new highest whole population. */
    citizen: 1,
  },
} as const;

export const LEVELING = {
  /** Each upgrade costs this many times the previous one. */
  upgradeCostGrowth: 1.8,
  /** Output bonus per level above 1 (0.5 means Lv2 = 150%, Lv3 = 200%). */
  outputBonusPerLevel: 0.5,
} as const;

const NO_OUTPUT = {
  goldPerSecond: 0,
  populationCapacity: 0,
  jobs: 0,
  happinessBonus: 0,
  leisureSpot: false,
  powerSupply: 0,
  powerDemand: 0,
  pollution: 0,
  research: 0,
} as const;

export const BUILDINGS: Record<BuildingType, BuildingDefinition> = {
  townHall: {
    ...NO_OUTPUT,
    names: { ancient: "Chief's Hall", medieval: 'Town Hall', industrial: 'City Hall' },
    buildable: false,
    movable: false,
    era: 'ancient',
    cityLevel: 1,
    buildCost: 0,
    upgradeBaseCost: 0,
    maxLevel: 1,
    // Enough for the first few shops before a power plant is needed.
    powerSupply: 3,
  },
  house: {
    ...NO_OUTPUT,
    names: { ancient: 'Hut', medieval: 'Cottage', industrial: 'Row House' },
    buildable: true,
    movable: true,
    era: 'ancient',
    cityLevel: 1,
    buildCost: 10,
    upgradeBaseCost: 20,
    maxLevel: 5,
    populationCapacity: 5,
  },
  shop: {
    ...NO_OUTPUT,
    names: { ancient: 'Market Stall', medieval: 'Market', industrial: 'Store' },
    buildable: true,
    movable: true,
    era: 'ancient',
    cityLevel: 1,
    buildCost: 25,
    upgradeBaseCost: 40,
    maxLevel: 5,
    goldPerSecond: 1,
    jobs: 4,
    powerDemand: 1,
  },
  park: {
    ...NO_OUTPUT,
    names: { ancient: 'Grove', medieval: 'Garden', industrial: 'City Park' },
    buildable: true,
    movable: true,
    era: 'ancient',
    cityLevel: 2,
    buildCost: 30,
    upgradeBaseCost: 50,
    maxLevel: 3,
    happinessBonus: 6,
    leisureSpot: true,
  },
  powerPlant: {
    ...NO_OUTPUT,
    names: { ancient: 'Windmill', medieval: 'Watermill', industrial: 'Power Station' },
    buildable: true,
    movable: true,
    era: 'ancient',
    cityLevel: 3,
    buildCost: 60,
    upgradeBaseCost: 80,
    maxLevel: 5,
    jobs: 2,
    powerSupply: 8,
  },
  researchCenter: {
    ...NO_OUTPUT,
    names: { ancient: 'Shrine', medieval: 'Library', industrial: 'Laboratory' },
    buildable: true,
    movable: true,
    era: 'ancient',
    cityLevel: 4,
    buildCost: 120,
    upgradeBaseCost: 150,
    maxLevel: 5,
    jobs: 3,
    powerDemand: 2,
    research: 1,
  },
  factory: {
    ...NO_OUTPUT,
    names: { ancient: 'Factory', medieval: 'Factory', industrial: 'Factory' },
    buildable: true,
    movable: true,
    era: 'industrial',
    cityLevel: 1,
    buildCost: 150,
    upgradeBaseCost: 220,
    maxLevel: 5,
    goldPerSecond: 5,
    jobs: 8,
    powerDemand: 4,
    pollution: 1,
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

/**
 * Progress while the game is closed or the tab is hidden (design brief: capped, resources
 * only — no research, XP or events).
 */
export const OFFLINE = {
  maxSeconds: 8 * 60 * 60,
  /** Shorter gaps are simply simulated as normal ticks, without a report. */
  minReportSeconds: 60,
  /** Offline production is integrated in steps of this length. */
  stepSeconds: 60,
  /** Share of normal production earned while away. */
  efficiency: 1,
} as const;
