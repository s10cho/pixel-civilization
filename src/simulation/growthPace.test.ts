import { describe, expect, it } from 'vitest';
import { computeCityReport } from '../economy/cityReport';
import { placeBuilding } from './actions';
import { planAutoAction } from './autoGrow';
import { createInitialState, type GameState } from './gameState';
import { tickSimulation } from './tick';

function town(): GameState {
  const state = createInitialState(1);
  const hall = state.buildings[0];
  state.resources.gold = 2000;
  // Three homes, so population growth has room to differ before hitting the housing cap.
  placeBuilding(state, 'house', hall.col + 1, hall.row);
  placeBuilding(state, 'house', hall.col + 2, hall.row);
  placeBuilding(state, 'house', hall.col + 1, hall.row + 1);
  placeBuilding(state, 'shop', hall.col, hall.row + 1);
  state.autoLevel = 'off';
  return state;
}

function earnings(pace: GameState['growthPace']): { gold: number; population: number } {
  const state = town();
  state.growthPace = pace;
  const gold = state.resources.gold;
  for (let i = 0; i < 100; i++) tickSimulation(state, 0.25);
  return { gold: state.resources.gold - gold, population: state.resources.population };
}

describe('growth pace', () => {
  it('changes speed only, in the expected order', () => {
    const relaxed = earnings('relaxed');
    const standard = earnings('standard');
    const fast = earnings('fast');
    expect(relaxed.gold).toBeLessThan(standard.gold);
    expect(standard.gold).toBeLessThan(fast.gold);
    expect(relaxed.population).toBeLessThan(fast.population);
    // Nothing can go negative or be lost at any pace.
    for (const result of [relaxed, standard, fast]) expect(result.gold).toBeGreaterThan(0);
  });
});

describe('automation level', () => {
  it('does nothing when off or when it may only advise', () => {
    for (const level of ['off', 'low'] as const) {
      const state = town();
      state.autoLevel = level;
      expect(planAutoAction(state, computeCityReport(state))).toBeNull();
    }
  });

  it('builds at medium but leaves expanding to the player', () => {
    const state = town();
    state.autoLevel = 'medium';
    expect(planAutoAction(state, computeCityReport(state))).toMatchObject({ kind: 'build' });

    // Fill the territory so building is impossible: medium still refuses to expand.
    const area = { minCol: 13, minRow: 13, maxCol: 22, maxRow: 22 };
    for (let row = area.minRow; row <= area.maxRow; row++) {
      for (let col = area.minCol; col <= area.maxCol; col++) placeBuilding(state, 'house', col, row);
    }
    state.resources.gold = 100_000;
    expect(planAutoAction(state, computeCityReport(state))?.kind).not.toBe('expand');

    state.autoLevel = 'high';
    expect(planAutoAction(state, computeCityReport(state))).toMatchObject({ kind: 'expand' });
  });
});
