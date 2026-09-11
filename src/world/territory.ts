import { TERRITORY } from '../config/balance';
import { WORLD } from '../config/gameConfig';
import type { GameState } from '../simulation/gameState';

/** Inclusive tile rectangle. */
export interface TileRect {
  minCol: number;
  minRow: number;
  maxCol: number;
  maxRow: number;
}

/** How many expansions fit before the territory covers the whole world. */
export function getMaxExpansionLevel(): number {
  const room = Math.min(WORLD.cols, WORLD.rows) - TERRITORY.initialSize;
  return Math.max(0, Math.floor(room / (2 * TERRITORY.expansionStep)));
}

/** The square of tiles, centered in the world, that the player may build on. */
export function getUnlockedArea(expansionLevel: number): TileRect {
  const level = Math.min(expansionLevel, getMaxExpansionLevel());
  const size = TERRITORY.initialSize + level * 2 * TERRITORY.expansionStep;
  const cols = Math.min(size, WORLD.cols);
  const rows = Math.min(size, WORLD.rows);
  const minCol = Math.floor((WORLD.cols - cols) / 2);
  const minRow = Math.floor((WORLD.rows - rows) / 2);
  return { minCol, minRow, maxCol: minCol + cols - 1, maxRow: minRow + rows - 1 };
}

/** Gold needed for the next expansion, or null when the territory is already at maximum. */
export function getExpansionCost(expansionLevel: number): number | null {
  if (expansionLevel >= getMaxExpansionLevel()) return null;
  return Math.ceil(TERRITORY.expansionBaseCost * TERRITORY.expansionCostGrowth ** expansionLevel);
}

export function isInsideWorld(col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < WORLD.cols && row < WORLD.rows;
}

export function isUnlocked(state: GameState, col: number, row: number): boolean {
  const area = getUnlockedArea(state.expansionLevel);
  return col >= area.minCol && col <= area.maxCol && row >= area.minRow && row <= area.maxRow;
}
