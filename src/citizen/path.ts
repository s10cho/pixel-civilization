import { PATHS } from '../config/balance';
import { WORLD } from '../config/gameConfig';
import type { GameState } from '../simulation/gameState';
import { getBuildingAt } from '../world/placement';
import { crossingWith, isCrossing, roadLane } from '../world/roads';
import { isMountain } from '../world/terrain';
import type { TileControl } from '../world/signals';
import { isUnlocked } from '../world/territory';

export interface Tile {
  col: number;
  row: number;
}

const key = (col: number, row: number): number => col * 1000 + row;

/**
 * Where people may walk: anywhere but the carriageway and the rails. A road tile is only
 * walkable at a crossing, which is what stops citizens from wandering across the traffic.
 */
export function isWalkable(state: GameState, col: number, row: number): boolean {
  if (col < 0 || row < 0 || col >= WORLD.cols || row >= WORLD.rows) return false;
  // People stay in the city rather than wandering off into the wild land around it.
  if (!isUnlocked(state, col, row)) return false;
  if (isMountain(state, col, row)) return false;
  const building = getBuildingAt(state, col, row);
  if (!building) return true;
  if (building.type === 'road') return isCrossing(state, col, row);
  return building.type !== 'railway';
}

/** Whether stepping onto this tile waits for lights, and which kind. */
export function tileControl(state: GameState, col: number, row: number): TileControl | null {
  const building = getBuildingAt(state, col, row);
  if (building?.type !== 'road') return null;
  const lane = roadLane(state, col, row);
  if (lane.axis === 'junction') return { kind: 'junction' };
  return lane.crossing ? { kind: 'crossing', axis: lane.axis } : null;
}

/** Whether this tile is a junction, where crossing waits for the lights. */
export function isJunction(state: GameState, col: number, row: number): boolean {
  return tileControl(state, col, row)?.kind === 'junction';
}

/**
 * A walking route from one tile to another, avoiding the roads except at crossings. Returns
 * null when there is no way round, so the caller can fall back to walking straight there.
 */
export function findWalkPath(state: GameState, from: Tile, to: Tile): Tile[] | null {
  if (from.col === to.col && from.row === to.row) return [to];

  // One index of the city for the whole search: tile lookups happen thousands of times.
  const roads = new Set<number>();
  const rails = new Set<number>();
  for (const building of state.buildings) {
    if (building.type === 'road') roads.add(key(building.col, building.row));
    else if (building.type === 'railway') rails.add(key(building.col, building.row));
  }
  const isRoadAt = (col: number, row: number): boolean => roads.has(key(col, row));
  /** Stepping off your own doorstep onto the road in front of it is fine. */
  const doorstep = (col: number, row: number): boolean =>
    Math.abs(col - from.col) + Math.abs(row - from.row) === 1 ||
    Math.abs(col - to.col) + Math.abs(row - to.row) === 1;
  const walkable = (col: number, row: number): boolean => {
    if (col < 0 || row < 0 || col >= WORLD.cols || row >= WORLD.rows) return false;
    if (!isUnlocked(state, col, row)) return false;
    if (isMountain(state, col, row)) return false;
    const id = key(col, row);
    if (rails.has(id)) return false;
    if (roads.has(id)) return crossingWith(isRoadAt, col, row) || doorstep(col, row);
    return true;
  };

  const cameFrom = new Map<number, number>();
  const queue: Tile[] = [from];
  const seen = new Set<number>([key(from.col, from.row)]);
  let visited = 0;

  while (queue.length > 0 && visited < PATHS.maxTilesSearched) {
    const tile = queue.shift()!;
    visited++;
    for (const [dCol, dRow] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const) {
      const col = tile.col + dCol;
      const row = tile.row + dRow;
      const id = key(col, row);
      if (seen.has(id)) continue;
      // The destination counts as reachable even if it is a building's own tile.
      const reachable = (col === to.col && row === to.row) || walkable(col, row);
      if (!reachable) continue;
      seen.add(id);
      cameFrom.set(id, key(tile.col, tile.row));
      if (col === to.col && row === to.row) return trace(cameFrom, from, to);
      queue.push({ col, row });
    }
  }
  return null;
}

function trace(cameFrom: Map<number, number>, from: Tile, to: Tile): Tile[] {
  const path: Tile[] = [];
  let current = key(to.col, to.row);
  const start = key(from.col, from.row);
  while (current !== start) {
    path.push({ col: Math.floor(current / 1000), row: current % 1000 });
    const previous = cameFrom.get(current);
    if (previous === undefined) break;
    current = previous;
  }
  return path.reverse();
}
