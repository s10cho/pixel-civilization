import { describe, expect, it } from 'vitest';
import { computeCityReport } from '../economy/cityReport';
import { getUnlockedArea } from '../world/territory';
import { planAutoAction } from './autoGrow';
import { createInitialState } from './gameState';

describe('planAutoAction', () => {
  it('starts by making room for citizens, inside the territory', () => {
    const state = createInitialState(1);
    state.resources.gold = 500;
    const action = planAutoAction(state, computeCityReport(state));
    expect(action).toMatchObject({ kind: 'build', type: 'house' });

    const area = getUnlockedArea(state.expansionLevel);
    if (action?.kind !== 'build') throw new Error('expected a build');
    expect(action.col).toBeGreaterThanOrEqual(area.minCol);
    expect(action.col).toBeLessThanOrEqual(area.maxCol);
    expect(action.row).toBeGreaterThanOrEqual(area.minRow);
    expect(action.row).toBeLessThanOrEqual(area.maxRow);
  });

  it('leaves the player a reserve instead of spending everything', () => {
    const state = createInitialState(1);
    state.resources.gold = 12;
    expect(planAutoAction(state, computeCityReport(state))).toBeNull();
  });

  it('never builds factories (their smoke is the player’s choice)', () => {
    const state = createInitialState(1);
    state.era = 'industrial';
    state.cityLevel = 12;
    state.resources.gold = 100_000;
    for (let i = 0; i < 40; i++) {
      const action = planAutoAction(state, computeCityReport(state));
      if (!action) break;
      expect(action.kind === 'build' ? action.type : 'other').not.toBe('factory');
      if (action.kind === 'build') {
        state.buildings.push({
          id: state.nextBuildingId++,
          type: action.type,
          col: action.col,
          row: action.row,
          level: 1,
        });
      } else if (action.kind === 'expand') {
        state.expansionLevel++;
      } else {
        break;
      }
    }
  });
});
