import { describe, expect, it } from 'vitest';
import { DAY_NIGHT } from '../config/gameConfig';
import { placeBuilding } from '../simulation/actions';
import { createInitialState } from '../simulation/gameState';
import { peopleMayCross, signalAt } from '../world/signals';
import { updateCitizens } from './behavior';
import { isJunction } from './path';
import type { Citizen } from './types';

/** A crossroads next to the town hall, with a home just off it. */
function cityWithCrossroads() {
  const state = createInitialState(1);
  const hall = state.buildings[0];
  state.resources.gold = 5000;
  state.era = 'industrial';
  state.cityLevel = 9;

  const col = hall.col + 3;
  const row = hall.row + 3;
  for (let c = col - 3; c <= col + 3; c++) placeBuilding(state, 'road', c, row);
  for (let r = row - 3; r <= row + 3; r++) placeBuilding(state, 'road', col, r);
  expect(isJunction(state, col, row)).toBe(true);

  expect(placeBuilding(state, 'house', col + 1, row + 1).ok).toBe(true);
  const home = state.buildings[state.buildings.length - 1];
  return { state, home, col, row };
}

/** The first moment of the day at which this junction shows the wanted phase. */
function timeOfDayFor(want: boolean, col: number, row: number): number {
  for (let second = 0; second < DAY_NIGHT.daySeconds; second += 0.25) {
    const timeOfDay = second / DAY_NIGHT.daySeconds;
    if (peopleMayCross(signalAt(timeOfDay, col, row)) === want) return timeOfDay;
  }
  throw new Error('no such phase');
}

function citizenAtJunction(home: { id: number; col: number; row: number }, col: number, row: number): Citizen {
  return {
    id: 1,
    homeId: home.id,
    workplaceId: null,
    leisureId: null,
    leisureOffsetX: 0,
    leisureOffsetY: 0,
    happiness: 70,
    leisureBoost: 0,
    activity: 'toHome',
    // On the kerb, one tile short of the junction.
    x: col + 0.5,
    y: row - 0.5,
    timer: 0,
    path: [
      { col, row },
      { col, row: row + 1 },
      { col: home.col, row: home.row },
    ],
    pathTo: { col: home.col, row: home.row },
  };
}

describe('citizens at a junction', () => {
  it('waits on the kerb while the cars have the lights', () => {
    const { state, home, col, row } = cityWithCrossroads();
    state.timeOfDay = timeOfDayFor(false, col, row);
    const citizen = citizenAtJunction(home, col, row);
    state.citizens = [citizen];

    const startY = citizen.y;
    for (let i = 0; i < 8; i++) updateCitizens(state, 0.25);
    expect(citizen.y).toBe(startY);
    expect(citizen.path).toHaveLength(3);
  });

  it('steps into the junction once the walk signal shows', () => {
    const { state, home, col, row } = cityWithCrossroads();
    state.timeOfDay = timeOfDayFor(true, col, row);
    const citizen = citizenAtJunction(home, col, row);
    state.citizens = [citizen];

    const startY = citizen.y;
    for (let i = 0; i < 8; i++) updateCitizens(state, 0.25);
    expect(citizen.y).toBeGreaterThan(startY);
  });
});
