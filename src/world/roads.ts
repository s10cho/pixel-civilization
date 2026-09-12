import { ROADS } from '../config/balance';
import type { GameState } from '../simulation/gameState';
import { getBuildingAt } from './placement';

/** Bits used by the road model: which sides have a road to connect to. */
export const ROAD_NORTH = 1;
export const ROAD_EAST = 2;
export const ROAD_SOUTH = 4;
export const ROAD_WEST = 8;

/** Which way the traffic on a tile runs. */
export type RoadAxis = 'x' | 'z' | 'junction';

export interface RoadLane {
  /** Neighbouring roads, as ROAD_* bits. */
  mask: number;
  axis: RoadAxis;
  /** Tiles in the road's width, counted across the direction of travel (1, 2, 3+). */
  width: number;
  /** This tile's place across that width, from the north or west edge. */
  index: number;
  /** Whether people may cross the road here. */
  crossing: boolean;
}

/** Answers whether a tile holds a road; callers with an index of the city can pass their own. */
export type IsRoadAt = (col: number, row: number) => boolean;

const isRoadIn = (state: GameState): IsRoadAt => (col, row) => getBuildingAt(state, col, row)?.type === 'road';

/** Which neighbours a road tile connects to, as a bitmask (see the ROAD_* bits). */
export function roadConnections(state: GameState, col: number, row: number): number {
  return connectionsWith(isRoadIn(state), col, row);
}

function connectionsWith(isRoad: IsRoadAt, col: number, row: number): number {
  let mask = 0;
  if (isRoad(col, row - 1)) mask |= ROAD_NORTH;
  if (isRoad(col + 1, row)) mask |= ROAD_EAST;
  if (isRoad(col, row + 1)) mask |= ROAD_SOUTH;
  if (isRoad(col - 1, row)) mask |= ROAD_WEST;
  return mask;
}

/**
 * Reads a road tile: which way the traffic runs, how wide the road is here, this tile's place
 * across that width, and whether it carries a crossing. The direction comes from how far the
 * road reaches each way, so a two-tile-wide avenue is an avenue rather than a junction.
 */
export function roadLane(state: GameState, col: number, row: number): RoadLane {
  return roadLaneWith(isRoadIn(state), col, row);
}

/** The same reading, for callers that already know where the roads are. */
export function roadLaneWith(isRoad: IsRoadAt, col: number, row: number): RoadLane {
  const mask = connectionsWith(isRoad, col, row);
  const west = run(isRoad, col, row, -1, 0);
  const east = run(isRoad, col, row, 1, 0);
  const north = run(isRoad, col, row, 0, -1);
  const south = run(isRoad, col, row, 0, 1);
  const alongX = west + east + 1;
  const alongZ = north + south + 1;
  const arms = [ROAD_NORTH, ROAD_EAST, ROAD_SOUTH, ROAD_WEST].filter((bit) => mask & bit).length;

  // Where a narrow road meets another, the markings give way to a junction box.
  if (arms >= 3 && Math.min(alongX, alongZ) <= 1) {
    return { mask, axis: 'junction', width: 1, index: 0, crossing: true };
  }

  const axis: RoadAxis = alongX >= alongZ ? 'x' : 'z';
  const width = Math.min(axis === 'x' ? alongZ : alongX, ROADS.maxWidth);
  const index = Math.min(axis === 'x' ? north : west, ROADS.maxWidth - 1);
  // Crossings are placed along the road, so every lane of it is crossable at the same point.
  const crossing = (axis === 'x' ? col : row) % ROADS.crossingSpacing === 0;
  return { mask, axis, width, index, crossing };
}

/** How many road tiles run from here in one direction, up to the widest road we distinguish. */
function run(isRoad: IsRoadAt, col: number, row: number, dCol: number, dRow: number): number {
  let steps = 0;
  while (steps < ROADS.maxRun && isRoad(col + dCol * (steps + 1), row + dRow * (steps + 1))) steps++;
  return steps;
}

/** Whether people may cross the road on this tile. */
export function isCrossing(state: GameState, col: number, row: number): boolean {
  return crossingWith(isRoadIn(state), col, row);
}

export function crossingWith(isRoad: IsRoadAt, col: number, row: number): boolean {
  if (!isRoad(col, row)) return false;
  return roadLaneWith(isRoad, col, row).crossing;
}

/** Packs a lane description into the single number the model cache is keyed by. */
export function packRoadVariant(lane: RoadLane): number {
  const axis = lane.axis === 'junction' ? 2 : lane.axis === 'z' ? 1 : 0;
  return lane.mask | (axis << 4) | (lane.width << 6) | (lane.index << 8) | ((lane.crossing ? 1 : 0) << 10);
}

export function unpackRoadVariant(variant: number): RoadLane {
  const axisBits = (variant >> 4) & 0b11;
  return {
    mask: variant & 0b1111,
    axis: axisBits === 2 ? 'junction' : axisBits === 1 ? 'z' : 'x',
    width: (variant >> 6) & 0b11,
    index: (variant >> 8) & 0b11,
    crossing: ((variant >> 10) & 1) === 1,
  };
}
