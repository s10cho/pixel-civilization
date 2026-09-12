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

/** Sides the territory can grow towards (Phase 2 §1.3: the player picks the direction). */
export type Direction = 'north' | 'east' | 'south' | 'west';

export const DIRECTIONS: readonly Direction[] = ['north', 'east', 'south', 'west'];

/** Anything carrying a territory; keeps these helpers usable from tests with a bare object. */
interface HasTerritory {
  territory: TileRect[];
}

/** The square every city starts with, centred in the world. */
export function initialTerritory(): TileRect {
  const size = Math.min(TERRITORY.initialSize, WORLD.cols, WORLD.rows);
  const minCol = Math.floor((WORLD.cols - size) / 2);
  const minRow = Math.floor((WORLD.rows - size) / 2);
  return { minCol, minRow, maxCol: minCol + size - 1, maxRow: minRow + size - 1 };
}

/** The box around everything the city owns: what the camera frames and the map tints. */
export function getUnlockedArea(state: HasTerritory): TileRect {
  const [first, ...rest] = state.territory;
  const area = { ...first };
  for (const rect of rest) {
    area.minCol = Math.min(area.minCol, rect.minCol);
    area.minRow = Math.min(area.minRow, rect.minRow);
    area.maxCol = Math.max(area.maxCol, rect.maxCol);
    area.maxRow = Math.max(area.maxRow, rect.maxRow);
  }
  return area;
}

export function isInsideWorld(col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < WORLD.cols && row < WORLD.rows;
}

export function isUnlocked(state: HasTerritory, col: number, row: number): boolean {
  return state.territory.some(
    (rect) => col >= rect.minCol && col <= rect.maxCol && row >= rect.minRow && row <= rect.maxRow,
  );
}

/** Tiles the city owns. The bands never overlap, so their areas simply add up. */
export function territoryTileCount(state: HasTerritory): number {
  return state.territory.reduce(
    (total, rect) => total + (rect.maxCol - rect.minCol + 1) * (rect.maxRow - rect.minRow + 1),
    0,
  );
}

/** Gold for the next expansion, whichever direction it goes. */
export function getExpansionCost(expansionLevel: number): number {
  return Math.ceil(TERRITORY.expansionBaseCost * TERRITORY.expansionCostGrowth ** expansionLevel);
}

/**
 * The strip of land a expansion would add on one side, or null when that side has reached the
 * edge of the world.
 */
export function expansionBand(state: HasTerritory, direction: Direction): TileRect | null {
  const area = getUnlockedArea(state);
  const depth = TERRITORY.expansionStep * 2;
  switch (direction) {
    case 'north': {
      const maxRow = area.minRow - 1;
      if (maxRow < 0) return null;
      return { minCol: area.minCol, maxCol: area.maxCol, minRow: Math.max(0, maxRow - depth + 1), maxRow };
    }
    case 'south': {
      const minRow = area.maxRow + 1;
      if (minRow >= WORLD.rows) return null;
      return { minCol: area.minCol, maxCol: area.maxCol, minRow, maxRow: Math.min(WORLD.rows - 1, minRow + depth - 1) };
    }
    case 'west': {
      const maxCol = area.minCol - 1;
      if (maxCol < 0) return null;
      return { minRow: area.minRow, maxRow: area.maxRow, minCol: Math.max(0, maxCol - depth + 1), maxCol };
    }
    case 'east': {
      const minCol = area.maxCol + 1;
      if (minCol >= WORLD.cols) return null;
      return { minRow: area.minRow, maxRow: area.maxRow, minCol, maxCol: Math.min(WORLD.cols - 1, minCol + depth - 1) };
    }
  }
}

/** Directions that still have room, with the land each would add. */
export function expansionOptions(state: HasTerritory): { direction: Direction; band: TileRect; tiles: number }[] {
  return DIRECTIONS.flatMap((direction) => {
    const band = expansionBand(state, direction);
    if (!band) return [];
    return [{ direction, band, tiles: (band.maxCol - band.minCol + 1) * (band.maxRow - band.minRow + 1) }];
  });
}

export function canExpand(state: HasTerritory): boolean {
  return expansionOptions(state).length > 0;
}

/** Free (unbuilt) tiles inside the territory. */
export function freeTiles(state: GameState): number {
  return territoryTileCount(state) - state.buildings.length;
}
