import type { GameState } from '../simulation/gameState';
import { getBuildingAt } from './placement';
import { ROAD_EAST, ROAD_NORTH, ROAD_SOUTH, ROAD_WEST, type RoadCorner } from './roads';

/**
 * How a railway tile lies: the track runs along one axis, bends round a corner, or crosses
 * another line. The rails and sleepers are drawn from this, so the track always points the
 * way it actually goes.
 */
export type RailAxis = 'x' | 'z' | 'crossing';

export interface RailLane {
  /** Neighbouring rails, as ROAD_* bits. */
  mask: number;
  axis: RailAxis;
  /** Set when the line turns on this tile, naming the two sides it joins. */
  corner?: RoadCorner;
  /** A line that stops here: the buffer end of the track. */
  buffer: boolean;
}

/** Answers whether a tile holds a railway. */
export type IsRailAt = (col: number, row: number) => boolean;

const isRailIn = (state: GameState): IsRailAt => (col, row) => getBuildingAt(state, col, row)?.type === 'railway';

function connectionsWith(isRail: IsRailAt, col: number, row: number): number {
  let mask = 0;
  if (isRail(col, row - 1)) mask |= ROAD_NORTH;
  if (isRail(col + 1, row)) mask |= ROAD_EAST;
  if (isRail(col, row + 1)) mask |= ROAD_SOUTH;
  if (isRail(col - 1, row)) mask |= ROAD_WEST;
  return mask;
}

function cornerOf(mask: number): RoadCorner | undefined {
  if (mask === (ROAD_NORTH | ROAD_EAST)) return 'northEast';
  if (mask === (ROAD_EAST | ROAD_SOUTH)) return 'eastSouth';
  if (mask === (ROAD_SOUTH | ROAD_WEST)) return 'southWest';
  if (mask === (ROAD_WEST | ROAD_NORTH)) return 'westNorth';
  return undefined;
}

export function railLane(state: GameState, col: number, row: number): RailLane {
  return railLaneWith(isRailIn(state), col, row);
}

/** The same reading, for callers that already know where the rails are. */
export function railLaneWith(isRail: IsRailAt, col: number, row: number): RailLane {
  const mask = connectionsWith(isRail, col, row);
  const northSouth = (mask & ROAD_NORTH) !== 0 || (mask & ROAD_SOUTH) !== 0;
  const eastWest = (mask & ROAD_EAST) !== 0 || (mask & ROAD_WEST) !== 0;
  const arms = [ROAD_NORTH, ROAD_EAST, ROAD_SOUTH, ROAD_WEST].filter((bit) => mask & bit).length;

  const corner = arms === 2 && northSouth && eastWest ? cornerOf(mask) : undefined;
  if (corner) return { mask, axis: 'x', corner, buffer: false };
  if (northSouth && eastWest) return { mask, axis: 'crossing', buffer: false };
  // A lone tile still has to point somewhere: north-south reads best on an isometric map.
  const axis: RailAxis = eastWest ? 'x' : 'z';
  return { mask, axis, buffer: arms <= 1 };
}

const AXES: RailAxis[] = ['x', 'z', 'crossing'];
const CORNERS: RoadCorner[] = ['northEast', 'eastSouth', 'southWest', 'westNorth'];

/** Packs a reading into one number, so the renderer can cache geometry per shape. */
export function packRailVariant(lane: RailLane): number {
  const corner = lane.corner ? CORNERS.indexOf(lane.corner) + 1 : 0;
  return AXES.indexOf(lane.axis) | (lane.buffer ? 1 << 2 : 0) | (corner << 3) | (lane.mask << 6);
}

export function unpackRailVariant(variant: number): RailLane {
  const corner = (variant >> 3) & 7;
  return {
    axis: AXES[variant & 3],
    buffer: ((variant >> 2) & 1) === 1,
    corner: corner === 0 ? undefined : CORNERS[corner - 1],
    mask: variant >> 6,
  };
}
