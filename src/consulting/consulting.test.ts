import { describe, expect, it } from 'vitest';
import { computeCityReport } from '../economy/cityReport';
import { placeBuilding } from '../simulation/actions';
import { createInitialState, type GameState } from '../simulation/gameState';
import { getUnlockedArea } from '../world/territory';
import { getAdvice } from './advice';
import { applyProposal, getProposals } from './proposals';

function city(): GameState {
  const state = createInitialState(1);
  const hall = state.buildings[0];
  state.resources.gold = 5000;
  state.cityLevel = 6;
  state.autoLevel = 'off';
  placeBuilding(state, 'house', hall.col + 1, hall.row);
  placeBuilding(state, 'house', hall.col + 2, hall.row);
  return state;
}

describe('consulting advice', () => {
  it('notices a power shortage and points at the power building', () => {
    const state = city();
    const hall = state.buildings[0];
    // Shops draw power; with only the town hall supplying, a few of them run it dry.
    for (let i = 0; i < 5; i++) placeBuilding(state, 'shop', hall.col - 1 - i, hall.row + 2);
    const advice = getAdvice(state, computeCityReport(state));
    expect(advice.map((item) => item.id)).toContain('needPower');
  });

  it('mentions research and roads only once they are possible', () => {
    const state = city();
    state.cityLevel = 1;
    expect(getAdvice(state, computeCityReport(state)).map((a) => a.id)).not.toContain('needResearch');
    state.cityLevel = 6;
    expect(getAdvice(state, computeCityReport(state)).map((a) => a.id)).toContain('needResearch');
    // Roads are an industrial-era building.
    expect(getAdvice(state, computeCityReport(state)).map((a) => a.id)).not.toContain('noRoads');
    state.era = 'industrial';
    expect(getAdvice(state, computeCityReport(state)).map((a) => a.id)).toContain('noRoads');
  });
});

describe('consulting proposals', () => {
  it('offers plans that fit inside the territory and can be carried out', () => {
    const state = city();
    const proposals = getProposals(state, computeCityReport(state));
    expect(proposals.length).toBeGreaterThan(0);

    const area = getUnlockedArea(state);
    for (const proposal of proposals) {
      for (const step of proposal.steps) {
        expect(step.col).toBeGreaterThanOrEqual(area.minCol);
        expect(step.col).toBeLessThanOrEqual(area.maxCol);
        expect(step.row).toBeGreaterThanOrEqual(area.minRow);
        expect(step.row).toBeLessThanOrEqual(area.maxRow);
      }
    }

    const plan = proposals.find((proposal) => proposal.steps.length > 0)!;
    const before = state.buildings.length;
    const result = applyProposal(state, plan);
    expect(result.built).toBe(plan.steps.length);
    expect(state.buildings.length).toBe(before + plan.steps.length);
  });

  it('suggests more land when the territory is nearly full', () => {
    const state = city();
    const area = getUnlockedArea(state);
    state.resources.gold = 500_000;
    for (let row = area.minRow; row <= area.maxRow; row++) {
      for (let col = area.minCol; col <= area.maxCol; col++) placeBuilding(state, 'house', col, row);
    }
    const proposals = getProposals(state, computeCityReport(state));
    expect(proposals.some((proposal) => proposal.kind === 'expand')).toBe(true);
  });
});
