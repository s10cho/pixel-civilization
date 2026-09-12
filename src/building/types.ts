import type { EraId } from '../progression/era';

export type BuildingType =
  | 'townHall'
  | 'house'
  | 'farm'
  | 'shop'
  | 'workshop'
  | 'park'
  | 'well'
  | 'inn'
  | 'powerPlant'
  | 'researchCenter'
  | 'monument'
  | 'road'
  | 'factory';

/** Build-menu grouping; each becomes a tab in the build bar. */
export type BuildingCategory =
  | 'housing'
  | 'food'
  | 'commerce'
  | 'industry'
  | 'energy'
  | 'utility'
  | 'transport'
  | 'leisure'
  | 'culture'
  | 'science'
  | 'civic';

/** Category tabs in build-menu order. */
export const BUILDING_CATEGORIES: readonly BuildingCategory[] = [
  'housing',
  'food',
  'commerce',
  'industry',
  'energy',
  'utility',
  'transport',
  'leisure',
  'culture',
  'science',
  'civic',
];

/** Static, balance-driven description of a building type. Numbers are level-1 values. */
export interface BuildingDefinition {
  /** Which build-menu tab it appears under. */
  category: BuildingCategory;
  /** Whether the player can place this type from the build menu. */
  buildable: boolean;
  /** Whether the player can relocate it (free of charge). */
  movable: boolean;
  /** Earliest era in which it can be built. */
  era: EraId;
  /** City level required to build it. */
  cityLevel: number;
  /** Base cost; scaled by the era's cost multiplier. */
  buildCost: number;
  /** Cost of the Lv1 -> Lv2 upgrade; later upgrades grow by LEVELING.upgradeCostGrowth. */
  upgradeBaseCost: number;
  /** 1 means the building cannot be upgraded. */
  maxLevel: number;
  goldPerSecond: number;
  /** Citizens this building can house. */
  populationCapacity: number;
  /** Workplace positions. */
  jobs: number;
  /** City-wide happiness change; negative values are penalties. */
  happinessBonus: number;
  /** Citizens may spend free time here. */
  leisureSpot: boolean;
  powerSupply: number;
  /** Power consumed; scaled by the era's power demand multiplier. */
  powerDemand: number;
  /** Pollution emitted into nearby homes. */
  pollution: number;
  /** Research points per second. */
  research: number;
}

/** A placed building. All buildings occupy a single tile. */
export interface Building {
  id: number;
  type: BuildingType;
  col: number;
  row: number;
  level: number;
}
