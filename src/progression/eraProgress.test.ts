import { describe, expect, it } from 'vitest';
import { ERA_REQUIREMENTS } from '../config/balance';
import { createInitialState } from '../simulation/gameState';
import { advanceEra, getEraProgress } from './eraProgress';

describe('era progression', () => {
  it('needs population, city level and the key research', () => {
    const state = createInitialState(1);
    expect(getEraProgress(state)?.ready).toBe(false);
    expect(advanceEra(state)).toEqual({ ok: false, error: 'requirementsNotMet' });

    const { population, cityLevel } = ERA_REQUIREMENTS.medieval;
    state.resources.population = population;
    state.peakPopulation = population;
    state.cityLevel = cityLevel;
    expect(getEraProgress(state)?.ready).toBe(false);

    state.research.completed.push('masonry');
    expect(getEraProgress(state)?.ready).toBe(true);
    expect(advanceEra(state)).toEqual({ ok: true, era: 'medieval' });
    expect(state.era).toBe('medieval');
  });

  it('stops at the final era', () => {
    const state = createInitialState(1);
    state.era = 'modern';
    expect(getEraProgress(state)).toBeNull();
    expect(advanceEra(state)).toEqual({ ok: false, error: 'finalEra' });
  });
});
