export type BuildingType = 'townHall' | 'house' | 'shop' | 'park';

/** Static, balance-driven description of a building type. */
export interface BuildingDefinition {
  name: string;
  /** Whether the player can place this type from the build menu. */
  buildable: boolean;
  buildCost: number;
  /** Cost of the Lv1 -> Lv2 upgrade; later upgrades grow by LEVELING.upgradeCostGrowth. */
  upgradeBaseCost: number;
  /** 1 means the building cannot be upgraded. */
  maxLevel: number;
  /** Gold produced per second at level 1. */
  goldPerSecond: number;
  /** Citizens this building can house at level 1. */
  populationCapacity: number;
  /** Workplace positions at level 1. */
  jobs: number;
  /** City-wide happiness change at level 1; negative values are penalties (e.g. industry). */
  happinessBonus: number;
  /** Citizens may spend free time here. */
  leisureSpot: boolean;
}

/** A placed building. All buildings occupy a single tile for now. */
export interface Building {
  id: number;
  type: BuildingType;
  col: number;
  row: number;
  level: number;
}
