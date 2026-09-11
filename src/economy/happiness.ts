import type { Citizen } from '../citizen/types';
import { ADJACENCY, HAPPINESS, POLLUTION, PROBLEMS } from '../config/balance';
import type { GameState } from '../simulation/gameState';
import type { CityReport } from './cityReport';

export type Mood = 'unhappy' | 'neutral' | 'happy';

/** The mood a citizen drifts towards given the current city. */
export function getHappinessTarget(citizen: Citizen, report: CityReport): number {
  const unemployed = citizen.workplaceId === null ? HAPPINESS.unemployedPenalty : 0;
  const parkNextDoor = report.parkHomes.has(citizen.homeId) ? ADJACENCY.parkHomeHappiness : 0;
  const pollution = Math.min(
    POLLUTION.maxPenalty,
    (report.pollution.get(citizen.homeId) ?? 0) * POLLUTION.happinessPerUnit,
  );
  return clampHappiness(
    HAPPINESS.base + report.happinessBonus - unemployed + citizen.leisureBoost + parkNextDoor - pollution,
  );
}

/**
 * Moves each citizen's mood towards its target and sets city happiness to the citizens' average.
 * Without citizens, city happiness shows what an employed newcomer would feel.
 */
export function updateHappiness(state: GameState, report: CityReport, dtSeconds: number): void {
  const maxStep = HAPPINESS.adjustPerSecond * dtSeconds;
  let total = 0;

  for (const citizen of state.citizens) {
    citizen.leisureBoost = Math.max(0, citizen.leisureBoost - HAPPINESS.leisureBoostDecayPerSecond * dtSeconds);
    const target = getHappinessTarget(citizen, report);
    const delta = target - citizen.happiness;
    citizen.happiness += Math.sign(delta) * Math.min(Math.abs(delta), maxStep);
    total += citizen.happiness;
  }

  state.resources.happiness =
    state.citizens.length > 0 ? total / state.citizens.length : clampHappiness(HAPPINESS.base + report.happinessBonus);
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

/** Growth scales with mood, and stops entirely while citizens are unhappy (a city problem). */
export function getGrowthMultiplier(happiness: number): number {
  if (happiness < PROBLEMS.lowHappinessBelow) return 0;
  const [min, max] = HAPPINESS.growthMultiplier;
  return Math.min(max, Math.max(min, happiness / HAPPINESS.base));
}

function clampHappiness(value: number): number {
  return Math.min(100, Math.max(0, value));
}
