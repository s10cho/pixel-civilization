import { describe, expect, it } from 'vitest';
import { placeBuilding } from '../simulation/actions';
import { createInitialState } from '../simulation/gameState';
import { checkAchievements, getAchievements } from './achievements';

describe('achievements', () => {
  it('unlocks once and pays its reward once', () => {
    const state = createInitialState(1);
    const hall = state.buildings[0];
    state.resources.gold = 1000;
    expect(placeBuilding(state, 'house', hall.col + 1, hall.row).ok).toBe(true);

    const unlocked = checkAchievements(state);
    expect(unlocked.map((achievement) => achievement.id)).toContain('firstHome');
    const gold = state.resources.gold;

    expect(checkAchievements(state)).toEqual([]);
    expect(state.resources.gold).toBe(gold);
    expect(state.achievements.filter((id) => id === 'firstHome')).toHaveLength(1);
  });

  it('shows progress towards the ones still open', () => {
    const state = createInitialState(1);
    const hall = state.buildings[0];
    state.resources.gold = 1000;
    placeBuilding(state, 'house', hall.col + 1, hall.row);
    checkAchievements(state);

    const homes = getAchievements(state).find((achievement) => achievement.id === 'homes10');
    expect(homes).toMatchObject({ current: 1, target: 10, unlocked: false });
  });
});
