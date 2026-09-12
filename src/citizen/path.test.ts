import { describe, expect, it } from 'vitest';
import { ROADS } from '../config/balance';
import { placeBuilding } from '../simulation/actions';
import { createInitialState } from '../simulation/gameState';
import { isCrossing } from '../world/roads';
import { findWalkPath, isWalkable } from './path';

describe('walking routes', () => {
  it('keeps off the carriageway and crosses at a crossing', () => {
    const state = createInitialState(1);
    const hall = state.buildings[0];
    state.resources.gold = 5000;
    state.era = 'industrial';
    state.cityLevel = 9;

    // A road right across the city, between the south and the north.
    const roadRow = hall.row + 2;
    for (let col = hall.col - 4; col <= hall.col + 4; col++) {
      expect(placeBuilding(state, 'road', col, roadRow).ok).toBe(true);
    }

    const from = { col: hall.col, row: roadRow + 2 };
    const to = { col: hall.col, row: roadRow - 2 };
    const path = findWalkPath(state, from, to);
    expect(path).not.toBeNull();

    const roadTiles = path!.filter((tile) => tile.row === roadRow);
    expect(roadTiles.length).toBeGreaterThan(0);
    for (const tile of roadTiles) {
      expect(isCrossing(state, tile.col, tile.row)).toBe(true);
    }
    for (const tile of path!) {
      expect(isWalkable(state, tile.col, tile.row) || (tile.col === to.col && tile.row === to.row)).toBe(true);
    }
  });

  it('lets people step onto the road right at their own door', () => {
    const state = createInitialState(1);
    const hall = state.buildings[0];
    state.resources.gold = 5000;
    state.era = 'industrial';
    state.cityLevel = 9;

    // A house boxed in by roads on every side: there has to be a way out.
    const col = hall.col + 3;
    const row = hall.row + 3;
    placeBuilding(state, 'house', col, row);
    for (const [dCol, dRow] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const) {
      placeBuilding(state, 'road', col + dCol, row + dRow);
    }

    const path = findWalkPath(state, { col, row }, { col: hall.col, row: hall.row });
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(0);
  });

  it('has a crossing at least every few tiles', () => {
    const state = createInitialState(1);
    state.resources.gold = 5000;
    state.era = 'industrial';
    state.cityLevel = 9;
    const hall = state.buildings[0];
    const row = hall.row + 3;
    let crossings = 0;
    for (let col = hall.col - 4; col <= hall.col + 4; col++) {
      placeBuilding(state, 'road', col, row);
    }
    for (let col = hall.col - 4; col <= hall.col + 4; col++) {
      if (isCrossing(state, col, row)) crossings++;
    }
    expect(crossings).toBeGreaterThanOrEqual(Math.floor(9 / ROADS.crossingSpacing));
  });
});
