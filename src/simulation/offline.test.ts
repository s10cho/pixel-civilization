import { describe, expect, it } from 'vitest';
import { OFFLINE } from '../config/balance';
import { placeBuilding } from './actions';
import { createInitialState, type GameState } from './gameState';
import { applyOfflineProgress } from './offline';

function smallTown(): GameState {
  const state = createInitialState(1);
  state.resources.gold = 1000;
  const hall = state.buildings[0];
  expect(placeBuilding(state, 'house', hall.col + 1, hall.row).ok).toBe(true);
  expect(placeBuilding(state, 'shop', hall.col, hall.row + 1).ok).toBe(true);
  return state;
}

describe('applyOfflineProgress', () => {
  it('credits resources only', () => {
    const state = smallTown();
    const { cityXp, cityLevel } = state;
    const report = applyOfflineProgress(state, 3600);
    expect(report.gold).toBeGreaterThan(0);
    expect(state.cityXp).toBe(cityXp);
    expect(state.cityLevel).toBe(cityLevel);
    expect(state.research.active).toBeNull();
    // New population highs reached while away are not worth XP later.
    expect(state.peakPopulation).toBe(Math.floor(state.resources.population));
  });

  it('caps the time away', () => {
    const atCap = smallTown();
    const beyond = smallTown();
    applyOfflineProgress(atCap, OFFLINE.maxSeconds);
    const report = applyOfflineProgress(beyond, OFFLINE.maxSeconds * 5);
    expect(report.capped).toBe(true);
    expect(report.creditedSeconds).toBe(OFFLINE.maxSeconds);
    expect(beyond.resources.gold).toBeCloseTo(atCap.resources.gold);
  });

  it('treats a clock that went backwards as no time', () => {
    const state = smallTown();
    const gold = state.resources.gold;
    const report = applyOfflineProgress(state, -500);
    expect(report.creditedSeconds).toBe(0);
    expect(state.resources.gold).toBe(gold);
  });
});
