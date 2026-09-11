import type { EraId } from '../progression/era';

export type BuildingType =
  | 'townHall'
  | 'house'
  | 'shop'
  | 'park'
  | 'powerPlant'
  | 'researchCenter'
  | 'factory';

/** Static, balance-driven description of a building type. Numbers are level-1 values. */
export interface BuildingDefinition {
  /** Display name per era: buildings evolve as the civilization advances. */
  names: Record<EraId, string>;
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
