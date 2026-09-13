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
  /** Set when the road turns on this tile, naming the two sides it joins. */
  corner?: RoadCorner;
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

/** Which way a corner turns, named by the two sides it joins. */
export type RoadCorner = 'northEast' | 'eastSouth' | 'southWest' | 'westNorth';

/**
 * Reads a road tile: whether it is a corner or a junction, which way the traffic runs, how
 * wide the road is here, this tile's place across that width, and whether it carries a
 * crossing. A corner is a single tile joining two sides, so it curves; a tile whose
 * neighbours carry the road onwards is part of a wider road.
 */
export function roadLane(state: GameState, col: number, row: number): RoadLane {
  return roadLaneWith(isRoadIn(state), col, row);
}

/** The same reading, for callers that already know where the roads are. */
export function roadLaneWith(isRoad: IsRoadAt, col: number, row: number): RoadLane {
  const mask = connectionsWith(isRoad, col, row);
  const northSouth = (mask & ROAD_NORTH) !== 0 || (mask & ROAD_SOUTH) !== 0;
  const eastWest = (mask & ROAD_EAST) !== 0 || (mask & ROAD_WEST) !== 0;
  const arms = [ROAD_NORTH, ROAD_EAST, ROAD_SOUTH, ROAD_WEST].filter((bit) => mask & bit).length;

  // Exactly two arms on different axes: the road turns here.
  if (arms === 2 && northSouth && eastWest) {
    return { mask, axis: 'x', width: 1, index: 0, crossing: false, corner: cornerOf(mask) };
  }

  const alongX = run(isRoad, col, row, -1, 0) + run(isRoad, col, row, 1, 0) + 1;
  const alongZ = run(isRoad, col, row, 0, -1) + run(isRoad, col, row, 0, 1) + 1;
  const axis: RoadAxis = alongX === alongZ ? (eastWest && !northSouth ? 'x' : 'z') : alongX > alongZ ? 'x' : 'z';

  // A road is wide where the tiles beside it carry it in the same direction.
  const before = parallelRun(isRoad, col, row, axis, -1);
  const after = parallelRun(isRoad, col, row, axis, 1);
  const width = Math.min(before + after + 1, ROADS.maxWidth);

  // Arms on both axes without extra width means roads meet here.
  if (northSouth && eastWest && width === 1) {
    return { mask, axis: 'junction', width: 1, index: 0, crossing: true };
  }

  const crossing = (axis === 'x' ? col : row) % ROADS.crossingSpacing === 0;
  return { mask, axis, width, index: Math.min(before, ROADS.maxWidth - 1), crossing };
}

function cornerOf(mask: number): RoadCorner {
  if (mask & ROAD_NORTH) return mask & ROAD_EAST ? 'northEast' : 'westNorth';
  return mask & ROAD_EAST ? 'eastSouth' : 'southWest';
}

/** How many tiles beside this one carry the road the same way, in one direction. */
function parallelRun(isRoad: IsRoadAt, col: number, row: number, axis: RoadAxis, step: number): number {
  let steps = 0;
  while (steps < ROADS.maxWidth) {
    const c = axis === 'x' ? col : col + step * (steps + 1);
    const r = axis === 'x' ? row + step * (steps + 1) : row;
    if (!isRoad(c, r)) break;
    // It only counts as the same road if it runs the same way.
    const along = axis === 'x' ? isRoad(c - 1, r) || isRoad(c + 1, r) : isRoad(c, r - 1) || isRoad(c, r + 1);
    if (!along) break;
    steps++;
  }
  return steps;
}

/** How many road tiles run from here in one direction, up to the longest road we look along. */
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
const CORNERS: readonly RoadCorner[] = ['northEast', 'eastSouth', 'southWest', 'westNorth'];

export function packRoadVariant(lane: RoadLane): number {
  const axis = lane.axis === 'junction' ? 2 : lane.axis === 'z' ? 1 : 0;
  const corner = lane.corner ? CORNERS.indexOf(lane.corner) + 1 : 0;
  return (
    lane.mask |
    (axis << 4) |
    (lane.width << 6) |
    (lane.index << 8) |
    ((lane.crossing ? 1 : 0) << 10) |
    (corner << 11)
  );
}

export function unpackRoadVariant(variant: number): RoadLane {
  const axisBits = (variant >> 4) & 0b11;
  const corner = (variant >> 11) & 0b111;
  return {
    corner: corner > 0 ? CORNERS[corner - 1] : undefined,
    mask: variant & 0b1111,
    axis: axisBits === 2 ? 'junction' : axisBits === 1 ? 'z' : 'x',
    width: (variant >> 6) & 0b11,
    index: (variant >> 8) & 0b11,
    crossing: ((variant >> 10) & 1) === 1,
  };
}
