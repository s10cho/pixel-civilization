import { describe, expect, it } from 'vitest';
import { createInitialState } from '../simulation/gameState';
import { migrateState, SAVE_VERSION, SaveFormatError } from './migrations';

describe('migrateState', () => {
  it('loads a current save unchanged', () => {
    const state = createInitialState(7);
    state.resources.gold = 1234;
    expect(migrateState(SAVE_VERSION, structuredClone(state))).toEqual(state);
  });

  it('fills fields missing from older saves', () => {
    const raw = structuredClone(createInitialState(7)) as Partial<ReturnType<typeof createInitialState>>;
    delete raw.research;
    delete raw.citizens;
    const state = migrateState(SAVE_VERSION, raw);
    expect(state.research).toEqual({ completed: [], active: null });
    expect(state.citizens).toEqual([]);
  });

  it('rejects saves from a newer version and damaged data', () => {
    expect(() => migrateState(SAVE_VERSION + 1, createInitialState())).toThrow(SaveFormatError);
    expect(() => migrateState(SAVE_VERSION, { hello: 'world' })).toThrow(SaveFormatError);
    expect(() => migrateState(0, createInitialState())).toThrow(SaveFormatError);
  });
});
