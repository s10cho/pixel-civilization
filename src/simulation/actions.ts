import { canUpgradeFurther, getBuildCost, getUnlockState, getUpgradeCost } from '../building/rules';
import type { BuildingType } from '../building/types';
import { BUILDINGS, PROGRESSION } from '../config/balance';
import { gainXp } from '../progression/level';
import { checkPlacement, type PlacementError } from '../world/placement';
import { getExpansionCost } from '../world/territory';
import type { GameState } from './gameState';

/** Player-intent operations on the game state. Each validates first and mutates only on success. */

export type ActionError =
  | PlacementError
  | 'notBuildable'
  | 'notUnlocked'
  | 'notMovable'
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
  if (!BUILDINGS[type].buildable) return 'notBuildable';
  if (getUnlockState(type, state) !== 'available') return 'notUnlocked';
  const placementError = checkPlacement(state, col, row);
  if (placementError) return placementError;
  if (state.resources.gold < getBuildCost(type, state.era)) return 'insufficientGold';
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

  state.resources.gold -= getBuildCost(type, state.era);
  state.buildings.push({ id: state.nextBuildingId++, type, col, row, level: 1 });
  gainXp(state, PROGRESSION.xp.build);
  return { ok: true };
}

export function upgradeBuilding(state: GameState, buildingId: number): ActionResult {
  const building = state.buildings.find((b) => b.id === buildingId);
  if (!building) return { ok: false, error: 'notFound' };
  if (!canUpgradeFurther(building)) return { ok: false, error: 'maxLevel' };

  const cost = getUpgradeCost(building, state.era);
  if (state.resources.gold < cost) return { ok: false, error: 'insufficientGold' };

  state.resources.gold -= cost;
  building.level++;
  gainXp(state, PROGRESSION.xp.upgradePerLevel * building.level);
  return { ok: true };
}

/** Why the building cannot move to this tile right now, or null if it can. Moving is free. */
export function validateMove(
  state: GameState,
  buildingId: number,
  col: number,
  row: number,
): ActionError | null {
  const building = state.buildings.find((b) => b.id === buildingId);
  if (!building) return 'notFound';
  if (!BUILDINGS[building.type].movable) return 'notMovable';
  if (building.col === col && building.row === row) return null;
  return checkPlacement(state, col, row);
}

export function moveBuilding(state: GameState, buildingId: number, col: number, row: number): ActionResult {
  const error = validateMove(state, buildingId, col, row);
  if (error) return { ok: false, error };

  const building = state.buildings.find((b) => b.id === buildingId)!;
  building.col = col;
  building.row = row;

  // Citizens inside the building move with it.
  for (const citizen of state.citizens) {
    const atLeisure = citizen.activity === 'leisure' && citizen.leisureId === buildingId;
    const inside =
      (citizen.activity === 'atHome' && citizen.homeId === buildingId) ||
      (citizen.activity === 'working' && citizen.workplaceId === buildingId) ||
      atLeisure;
    if (!inside) continue;
    citizen.x = col + 0.5 + (atLeisure ? citizen.leisureOffsetX : 0);
    citizen.y = row + 0.5 + (atLeisure ? citizen.leisureOffsetY : 0);
  }
  return { ok: true };
}

export function expandTerritory(state: GameState): ActionResult {
  const cost = getExpansionCost(state.expansionLevel);
  if (cost === null) return { ok: false, error: 'maxExpansion' };
  if (state.resources.gold < cost) return { ok: false, error: 'insufficientGold' };

  state.resources.gold -= cost;
  state.expansionLevel++;
  gainXp(state, PROGRESSION.xp.expand);
  return { ok: true };
}
