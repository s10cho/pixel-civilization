import { BUILDINGS, ERA_SETTINGS, LEVELING } from '../config/balance';
import { eraIndex, type EraId } from '../progression/era';
import type { GameState } from '../simulation/gameState';
import type { Building, BuildingType } from './types';

/** Building types offered in the build menu, in definition order. */
export const BUILDABLE_TYPES: readonly BuildingType[] = (Object.keys(BUILDINGS) as BuildingType[]).filter(
  (type) => BUILDINGS[type].buildable,
);

/** Level-scaled output of one building, before neighbour, power and staffing effects. */
export interface BuildingOutput {
  goldPerSecond: number;
  populationCapacity: number;
  jobs: number;
  happinessBonus: number;
  powerSupply: number;
  powerDemand: number;
  pollution: number;
  research: number;
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
    powerSupply: definition.powerSupply * multiplier,
    powerDemand: definition.powerDemand * multiplier,
    pollution: definition.pollution * multiplier,
    research: definition.research * multiplier,
  };
}

export function getBuildCost(type: BuildingType, era: EraId): number {
  return Math.ceil(BUILDINGS[type].buildCost * ERA_SETTINGS[era].costMultiplier);
}

export function canUpgradeFurther(building: Building): boolean {
  return building.level < BUILDINGS[building.type].maxLevel;
}

/** Gold needed to go from the building's current level to the next. */
export function getUpgradeCost(building: Building, era: EraId): number {
  const definition = BUILDINGS[building.type];
  return Math.ceil(
    definition.upgradeBaseCost *
      LEVELING.upgradeCostGrowth ** (building.level - 1) *
      ERA_SETTINGS[era].costMultiplier,
  );
}

export type UnlockState = 'available' | 'needsLevel' | 'needsEra';

/** Whether the city may build this type yet, and if not, what is missing. */
export function getUnlockState(type: BuildingType, state: GameState): UnlockState {
  const definition = BUILDINGS[type];
  if (eraIndex(state.era) < eraIndex(definition.era)) return 'needsEra';
  if (state.cityLevel < definition.cityLevel) return 'needsLevel';
  return 'available';
}
