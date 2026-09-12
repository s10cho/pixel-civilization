import { describe, expect, it } from 'vitest';
import { PROJECTS } from '../config/balance';
import { createInitialState, type GameState } from './gameState';
import { advanceProjects, isProjectUnlocked, planProject, startProject } from './projects';

function industrialCity(): GameState {
  const state = createInitialState(1);
  state.era = 'industrial';
  state.cityLevel = 8;
  state.resources.gold = 5000;
  return state;
}

describe('projects', () => {
  it('waits for the right era and city level', () => {
    const young = createInitialState(1);
    expect(isProjectUnlocked(young, 'railway')).toBe(false);
    expect(isProjectUnlocked(industrialCity(), 'railway')).toBe(true);
  });

  it('lays a railway across the city once the work is done', () => {
    const state = industrialCity();
    const plan = planProject(state, 'railway')!;
    expect(plan.tiles.length).toBeGreaterThanOrEqual(4);
    expect(startProject(state, plan)).toBe(true);
    expect(state.resources.gold).toBe(5000 - PROJECTS.railway.cost);

    // Half way through, nothing is built yet.
    expect(advanceProjects(state, PROJECTS.railway.workSeconds / 2)).toEqual([]);
    expect(state.buildings.some((building) => building.type === 'railway')).toBe(false);

    const finished = advanceProjects(state, PROJECTS.railway.workSeconds);
    expect(finished).toHaveLength(1);
    expect(state.projects).toHaveLength(0);
    expect(state.buildings.filter((building) => building.type === 'railway').length).toBe(plan.tiles.length);
  });

  it('turns a central park into nine parks', () => {
    const state = industrialCity();
    const plan = planProject(state, 'centralPark')!;
    expect(plan.tiles).toHaveLength(9);
    startProject(state, plan);
    advanceProjects(state, PROJECTS.centralPark.workSeconds);
    expect(state.buildings.filter((building) => building.type === 'park').length).toBe(9);
  });

  it('refuses to start without the gold', () => {
    const state = industrialCity();
    state.resources.gold = 10;
    const plan = planProject(state, 'railway')!;
    expect(startProject(state, plan)).toBe(false);
    expect(state.projects).toHaveLength(0);
  });
});
