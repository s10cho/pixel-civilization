import { TERRAIN } from '../config/balance';
import { WORLD } from '../config/gameConfig';
import { initialTerritory } from './territory';

/**
 * Rough ground: ridges of rocky tiles the city has to grow around (Phase 2 §1.1 — reaching
 * past the hills is part of the growth). The pattern is fixed per city, so the land a player
 * knows stays the same, and the starting area is always clear.
 */

interface HasTerrain {
  terrainSeed: number;
  /** Tiles levelled by a tunnel or ground works, as col * 1000 + row. */
  clearedTiles: number[];
}

export const tileKey = (col: number, row: number): number => col * 1000 + row;

/** Stable pseudo-random number in [0, 1) for a seed and an index. */
function hash(seed: number, index: number): number {
  const value = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function inStartingArea(col: number, row: number): boolean {
  const start = initialTerritory();
  const margin = TERRAIN.clearMargin;
  return (
    col >= start.minCol - margin &&
    col <= start.maxCol + margin &&
    row >= start.minRow - margin &&
    row <= start.maxRow + margin
  );
}

export function isMountain(state: HasTerrain, col: number, row: number): boolean {
  if (inStartingArea(col, row)) return false;
  if (state.clearedTiles.includes(tileKey(col, row))) return false;

  const x = col - WORLD.cols / 2;
  const y = row - WORLD.rows / 2;
  for (let ridge = 0; ridge < TERRAIN.ridges; ridge++) {
    const angle = hash(state.terrainSeed, ridge * 3) * Math.PI;
    const offset = (hash(state.terrainSeed, ridge * 3 + 1) - 0.5) * WORLD.cols * 0.8;
    const width = TERRAIN.ridgeWidth * (0.7 + hash(state.terrainSeed, ridge * 3 + 2) * 0.8);
    const across = x * Math.sin(angle) - y * Math.cos(angle) - offset;
    const along = x * Math.cos(angle) + y * Math.sin(angle);
    // A wobble keeps the ridges from looking drawn with a ruler.
    const wobble = Math.sin(along * 0.32 + ridge * 2.1) * TERRAIN.ridgeWobble;
    if (Math.abs(across + wobble) < width) return true;
  }
  return false;
}

/** Levels a tile so it can be built on (a tunnel or ground works). */
export function clearTile(state: HasTerrain, col: number, row: number): void {
  const key = tileKey(col, row);
  if (!state.clearedTiles.includes(key)) state.clearedTiles.push(key);
}
