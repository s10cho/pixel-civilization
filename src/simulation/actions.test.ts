import { describe, expect, it } from 'vitest';
import { placeBuilding, upgradeBuilding } from './actions';
import { createInitialState } from './gameState';
import { tickSimulation } from './tick';

describe('player actions', () => {
  it('places a building for its cost and rejects occupied tiles', () => {
    const state = createInitialState(1);
    const gold = state.resources.gold;
    expect(placeBuilding(state, 'house', 13, 12).ok).toBe(true);
    expect(state.resources.gold).toBeLessThan(gold);
    expect(state.buildings).toHaveLength(2);
    expect(placeBuilding(state, 'shop', 13, 12)).toMatchObject({ ok: false, error: 'occupied' });
  });

  it('refuses buildings the city has not unlocked yet', () => {
    const state = createInitialState(1);
    state.resources.gold = 10_000;
    expect(placeBuilding(state, 'factory', 13, 12)).toMatchObject({ ok: false });
  });

  it('upgrades a building and grows the city over time', () => {
    const state = createInitialState(1);
    state.resources.gold = 10_000;
    placeBuilding(state, 'house', 13, 12);
    placeBuilding(state, 'shop', 12, 13);
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
