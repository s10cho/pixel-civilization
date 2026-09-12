import type { BuildingDefinition, BuildingType } from '../building/types';
import type { EraId } from '../progression/era';

/**
 * Gameplay balance numbers, tuned for a calm game: the city never fails, shortages slow it
 * down gently instead of stopping it, and costs grow slowly enough that progress keeps
 * feeling steady.
 */

export const ECONOMY = {
  startingGold: 80,
  /** Gold per second the Town Hall collects for each whole citizen. */
  taxPerCitizenPerSecond: 0.12,
  /** Citizens gained per second while population is below housing capacity (at neutral mood). */
  populationGrowthPerSecond: 0.5,
} as const;

/** Per-era difficulty and reward scaling (design brief §35). */
export const ERA_SETTINGS: Record<
  EraId,
  { costMultiplier: number; outputMultiplier: number; powerDemandMultiplier: number }
> = {
  ancient: { costMultiplier: 1, outputMultiplier: 1, powerDemandMultiplier: 1 },
  medieval: { costMultiplier: 1.4, outputMultiplier: 1.8, powerDemandMultiplier: 1.35 },
  industrial: { costMultiplier: 1.9, outputMultiplier: 3, powerDemandMultiplier: 1.9 },
};

/**
 * What a city needs to enter each later era (design brief §10): population and city level
 * here, plus the research whose `opensEra` names the era.
 */
export const ERA_REQUIREMENTS: Record<Exclude<EraId, 'ancient'>, { population: number; cityLevel: number }> = {
  medieval: { population: 40, cityLevel: 4 },
  industrial: { population: 120, cityLevel: 7 },
};

export const POWER = {
  /** Output share a power-hungry building keeps with no power at all. */
  minEfficiency: 0.7,
} as const;

export const STAFFING = {
  /** Output share a workplace keeps with nobody to staff it. */
  minEfficiency: 0.6,
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
  happinessPerUnit: 7,
  maxPenalty: 14,
} as const;

export const PROBLEMS = {
  /** Below this city happiness, the city keeps growing but slowly (see HAPPINESS). */
  lowHappinessBelow: 40,
} as const;

export const HAPPINESS = {
  /** Mood of a housed, employed citizen in a city with no happiness buildings. */
  base: 50,
  unemployedPenalty: 12,
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
  /** Population growth multiplier = happiness / base, clamped. */
  growthMultiplier: [0.85, 1.4],
  /** Growth never stops: unhappy cities keep this share of their growth. */
  unhappyGrowthMultiplier: 0.4,
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
  baseXp: 35,
  xpGrowth: 1.4,
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
  upgradeCostGrowth: 1.55,
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
  initialSize: 10,
  /** Tiles added on every side per expansion. */
  expansionStep: 2,
  expansionBaseCost: 120,
  /** Each expansion costs this many times the previous one. */
  expansionCostGrowth: 1.9,
} as const;

/**
 * Small happy things that drop in now and then. Every event is a gift: nothing here can set
 * the city back.
 */
export const EVENTS = {
  /** Seconds between events, picked at random in this range. */
  intervalSeconds: [110, 220] as const,
  /** The city stays quiet until it has at least this many buildings. */
  minBuildings: 3,
  /** A merchant pays about this many seconds of the city's income... */
  merchantIncomeSeconds: 60,
  /** ...but never less than this. */
  merchantMinGold: 30,
  /** Citizens who move in after a good harvest (never above housing). */
  harvestCitizens: 4,
  /** Mood lift for every citizen at a festival. */
  festivalHappiness: 12,
  /** Research points a wandering scholar contributes. */
  scholarPoints: 30,
} as const;

/**
 * The optional "auto-grow" advisor: it tends the city on its own, slower than a player and
 * always leaving gold to spend, so watching it is relaxing rather than a replacement.
 */
export const AUTO_GROW = {
  /** Seconds between advisor actions. */
  intervalSeconds: 14,
  /** Share of gold the advisor never touches. */
  goldReserve: 0.35,
  /** An upgrade may use at most this share of the advisor's budget. */
  upgradeBudgetShare: 0.5,
  /** Build homes once the population reaches this share of housing. */
  housingFullShare: 0.75,
  /** Parks the advisor aims for per home. */
  parksPerHouse: 0.25,
  /** Expand only when the territory is nearly full. */
  expandWhenFreeTilesAtMost: 4,
  /** How strongly neighbour bonuses pull a new building towards a tile. */
  adjacencyWeight: 1.5,
  /** Actions credited for time away, at most. */
  maxOfflineActions: 8,
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
