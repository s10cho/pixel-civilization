export type BuildingType = 'townHall' | 'house' | 'shop';

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
}

/** A placed building. All buildings occupy a single tile for now. */
export interface Building {
  id: number;
  type: BuildingType;
  col: number;
  row: number;
  level: number;
}
