import { getBuildingOutput } from '../building/rules';
import type { Citizen } from '../citizen/types';
import { HAPPINESS } from '../config/balance';
import type { GameState } from '../simulation/gameState';

export type Mood = 'unhappy' | 'neutral' | 'happy';

/** Summed city-wide happiness from buildings (parks, later industry penalties), capped. */
export function getBuildingHappinessBonus(state: GameState): number {
  let bonus = 0;
  for (const building of state.buildings) bonus += getBuildingOutput(building).happinessBonus;
  return Math.min(bonus, HAPPINESS.maxBuildingBonus);
}

/** The mood a citizen drifts towards given the current city. */
export function getHappinessTarget(citizen: Citizen, buildingBonus: number): number {
  const unemployed = citizen.workplaceId === null ? HAPPINESS.unemployedPenalty : 0;
  return clampHappiness(HAPPINESS.base + buildingBonus - unemployed + citizen.leisureBoost);
}

/**
 * Moves each citizen's mood towards its target and sets city happiness to the citizens' average.
 * Without citizens, city happiness shows what an employed newcomer would feel.
 */
export function updateHappiness(state: GameState, dtSeconds: number): void {
  const bonus = getBuildingHappinessBonus(state);
  const maxStep = HAPPINESS.adjustPerSecond * dtSeconds;
  let total = 0;

  for (const citizen of state.citizens) {
    citizen.leisureBoost = Math.max(0, citizen.leisureBoost - HAPPINESS.leisureBoostDecayPerSecond * dtSeconds);
    const target = getHappinessTarget(citizen, bonus);
    const delta = target - citizen.happiness;
    citizen.happiness += Math.sign(delta) * Math.min(Math.abs(delta), maxStep);
    total += citizen.happiness;
  }

  state.resources.happiness =
    state.citizens.length > 0 ? total / state.citizens.length : clampHappiness(HAPPINESS.base + bonus);
}

export function getMood(happiness: number): Mood {
  if (happiness < HAPPINESS.unhappyBelow) return 'unhappy';
  if (happiness >= HAPPINESS.happyFrom) return 'happy';
  return 'neutral';
}

export function getSpeedMultiplier(happiness: number): number {
  const [slow, fast] = HAPPINESS.speedMultiplier;
  return slow + (fast - slow) * (clampHappiness(happiness) / 100);
}

export function getGrowthMultiplier(happiness: number): number {
  const [min, max] = HAPPINESS.growthMultiplier;
  return Math.min(max, Math.max(min, happiness / HAPPINESS.base));
}

function clampHappiness(value: number): number {
  return Math.min(100, Math.max(0, value));
}
