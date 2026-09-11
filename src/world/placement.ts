import type { Building } from '../building/types';
import type { GameState } from '../simulation/gameState';
import { isInsideWorld, isUnlocked } from './territory';

export type PlacementError = 'outOfBounds' | 'locked' | 'occupied';

export function getBuildingAt(state: GameState, col: number, row: number): Building | undefined {
  return state.buildings.find((b) => b.col === col && b.row === row);
}

/** Returns why a building cannot go on this tile, or null if the tile is free and buildable. */
export function checkPlacement(state: GameState, col: number, row: number): PlacementError | null {
  if (!isInsideWorld(col, row)) return 'outOfBounds';
  if (!isUnlocked(state, col, row)) return 'locked';
  if (getBuildingAt(state, col, row)) return 'occupied';
  return null;
}
