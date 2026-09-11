import { BUILDINGS, LEVELING } from '../config/balance';
import type { Building, BuildingType } from './types';

/** Building types offered in the build menu, in definition order. */
export const BUILDABLE_TYPES: readonly BuildingType[] = (Object.keys(BUILDINGS) as BuildingType[]).filter(
  (type) => BUILDINGS[type].buildable,
);

export interface BuildingOutput {
  goldPerSecond: number;
  populationCapacity: number;
  jobs: number;
  happinessBonus: number;
}

export function getLevelMultiplier(level: number): number {
  return 1 + (level - 1) * LEVELING.outputBonusPerLevel;
}

export function getBuildingOutput(building: Building): BuildingOutput {
  const definition = BUILDINGS[building.type];
  const multiplier = getLevelMultiplier(building.level);
  return {
    goldPerSecond: definition.goldPerSecond * multiplier,
    populationCapacity: Math.floor(definition.populationCapacity * multiplier),
    jobs: Math.floor(definition.jobs * multiplier),
    happinessBonus: definition.happinessBonus * multiplier,
  };
}

export function canUpgradeFurther(building: Building): boolean {
  return building.level < BUILDINGS[building.type].maxLevel;
}

/** Gold needed to go from the building's current level to the next. */
export function getUpgradeCost(building: Building): number {
  const definition = BUILDINGS[building.type];
  return Math.ceil(definition.upgradeBaseCost * LEVELING.upgradeCostGrowth ** (building.level - 1));
}
