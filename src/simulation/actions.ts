import { canUpgradeFurther, getUpgradeCost } from '../building/rules';
import type { BuildingType } from '../building/types';
import { BUILDINGS } from '../config/balance';
import { checkPlacement, type PlacementError } from '../world/placement';
import { getExpansionCost } from '../world/territory';
import type { GameState } from './gameState';

/** Player-intent operations on the game state. Each validates first and mutates only on success. */

export type ActionError =
  | PlacementError
  | 'notBuildable'
  | 'insufficientGold'
  | 'notFound'
  | 'maxLevel'
  | 'maxExpansion';

export type ActionResult = { ok: true } | { ok: false; error: ActionError };

/** Why `type` cannot be built on this tile right now, or null if it can. */
export function validatePlacement(
  state: GameState,
  type: BuildingType,
  col: number,
  row: number,
): ActionError | null {
  const definition = BUILDINGS[type];
  if (!definition.buildable) return 'notBuildable';
  const placementError = checkPlacement(state, col, row);
  if (placementError) return placementError;
  if (state.resources.gold < definition.buildCost) return 'insufficientGold';
  return null;
}

export function placeBuilding(
  state: GameState,
  type: BuildingType,
  col: number,
  row: number,
): ActionResult {
  const error = validatePlacement(state, type, col, row);
  if (error) return { ok: false, error };

  state.resources.gold -= BUILDINGS[type].buildCost;
  state.buildings.push({ id: state.nextBuildingId++, type, col, row, level: 1 });
  return { ok: true };
}

export function upgradeBuilding(state: GameState, buildingId: number): ActionResult {
  const building = state.buildings.find((b) => b.id === buildingId);
  if (!building) return { ok: false, error: 'notFound' };
  if (!canUpgradeFurther(building)) return { ok: false, error: 'maxLevel' };

  const cost = getUpgradeCost(building);
  if (state.resources.gold < cost) return { ok: false, error: 'insufficientGold' };

  state.resources.gold -= cost;
  building.level++;
  return { ok: true };
}

export function expandTerritory(state: GameState): ActionResult {
  const cost = getExpansionCost(state.expansionLevel);
  if (cost === null) return { ok: false, error: 'maxExpansion' };
  if (state.resources.gold < cost) return { ok: false, error: 'insufficientGold' };

  state.resources.gold -= cost;
  state.expansionLevel++;
  return { ok: true };
}
