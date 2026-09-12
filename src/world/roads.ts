import type { GameState } from '../simulation/gameState';
import { getBuildingAt } from './placement';

/** Bits used by the road model: which sides have a road to connect to. */
export const ROAD_NORTH = 1;
export const ROAD_EAST = 2;
export const ROAD_SOUTH = 4;
export const ROAD_WEST = 8;

const isRoad = (state: GameState, col: number, row: number): boolean =>
  getBuildingAt(state, col, row)?.type === 'road';

/** Which neighbours a road tile connects to, as a bitmask (see the ROAD_* bits). */
export function roadConnections(state: GameState, col: number, row: number): number {
  let mask = 0;
  if (isRoad(state, col, row - 1)) mask |= ROAD_NORTH;
  if (isRoad(state, col + 1, row)) mask |= ROAD_EAST;
  if (isRoad(state, col, row + 1)) mask |= ROAD_SOUTH;
  if (isRoad(state, col - 1, row)) mask |= ROAD_WEST;
  return mask;
}
