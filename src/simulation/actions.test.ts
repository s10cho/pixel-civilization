import { describe, expect, it } from 'vitest';
import { placeBuilding, upgradeBuilding } from './actions';
import { createInitialState } from './gameState';
import { tickSimulation } from './tick';

describe('player actions', () => {
  it('places a building for its cost and rejects occupied tiles', () => {
    const state = createInitialState(1);
    const hall = state.buildings[0];
    const gold = state.resources.gold;
    expect(placeBuilding(state, 'house', hall.col + 1, hall.row).ok).toBe(true);
    expect(state.resources.gold).toBeLessThan(gold);
    expect(state.buildings).toHaveLength(2);
    expect(placeBuilding(state, 'shop', hall.col + 1, hall.row)).toMatchObject({ ok: false, error: 'occupied' });
  });

  it('refuses buildings the city has not unlocked yet', () => {
    const state = createInitialState(1);
    const hall = state.buildings[0];
    state.resources.gold = 10_000;
    expect(placeBuilding(state, 'factory', hall.col + 1, hall.row)).toMatchObject({ ok: false });
  });

  it('upgrades a building and grows the city over time', () => {
    const state = createInitialState(1);
    const hall = state.buildings[0];
    state.resources.gold = 10_000;
    placeBuilding(state, 'house', hall.col + 1, hall.row);
    placeBuilding(state, 'shop', hall.col, hall.row + 1);
    const house = state.buildings.find((b) => b.type === 'house')!;
    expect(upgradeBuilding(state, house.id).ok).toBe(true);
    expect(house.level).toBe(2);

    const before = state.resources.gold;
    for (let i = 0; i < 400; i++) tickSimulation(state, 0.25);
    expect(state.resources.population).toBeGreaterThan(0);
    expect(state.citizens.length).toBeGreaterThan(0);
    expect(state.resources.gold).toBeGreaterThan(before);
  });
});
