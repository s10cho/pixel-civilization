import { ECONOMY, GROWTH_PACE } from '../config/balance';
import type { GameState } from '../simulation/gameState';
import type { CityReport } from './cityReport';
import { getGrowthMultiplier } from './happiness';

/** Advances resource production (gold, population) by `dtSeconds` using the tick's report. */
export function applyProduction(state: GameState, report: CityReport, dtSeconds: number): void {
  const resources = state.resources;
  const pace = GROWTH_PACE[state.growthPace];
  resources.gold += report.goldPerSecond * pace.output * dtSeconds;

  const growth =
    ECONOMY.populationGrowthPerSecond *
    pace.population *
    getGrowthMultiplier(resources.happiness) *
    report.growthMultiplier;
  resources.population = Math.min(report.populationCapacity, resources.population + growth * dtSeconds);
  resources.power = report.powerSupply - report.powerDemand;
}
