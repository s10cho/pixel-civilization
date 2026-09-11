import { BUILDABLE_TYPES } from '../building/rules';
import type { BuildingType } from '../building/types';
import { BUILDINGS, PROGRESSION } from '../config/balance';
import type { GameState } from '../simulation/gameState';

/** XP needed to go from `level` to the next. */
export function xpToNextLevel(level: number): number {
  return Math.round(PROGRESSION.baseXp * PROGRESSION.xpGrowth ** (level - 1));
}

export function isMaxLevel(level: number): boolean {
  return level >= PROGRESSION.maxLevel;
}

/** Adds city XP, levelling up as many times as it pays for. */
export function gainXp(state: GameState, amount: number): void {
  if (isMaxLevel(state.cityLevel)) return;
  state.cityXp += amount;
  while (!isMaxLevel(state.cityLevel) && state.cityXp >= xpToNextLevel(state.cityLevel)) {
    state.cityXp -= xpToNextLevel(state.cityLevel);
    state.cityLevel++;
  }
  if (isMaxLevel(state.cityLevel)) state.cityXp = 0;
}

/** Building types that reaching `level` unlocks. */
export function unlocksAtLevel(level: number): BuildingType[] {
  return BUILDABLE_TYPES.filter((type) => BUILDINGS[type].cityLevel === level);
}
