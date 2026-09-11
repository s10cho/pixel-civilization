import { getBuildingOutput } from '../building/rules';
import { ECONOMY } from '../config/balance';
import type { GameState } from '../simulation/gameState';

export interface ProductionRates {
  goldPerSecond: number;
  populationCapacity: number;
}

export function computeProduction(state: GameState): ProductionRates {
  let goldPerSecond = Math.floor(state.resources.population) * ECONOMY.taxPerCitizenPerSecond;
  let populationCapacity = 0;

  for (const building of state.buildings) {
    const output = getBuildingOutput(building);
    goldPerSecond += output.goldPerSecond;
    populationCapacity += output.populationCapacity;
  }

  return { goldPerSecond, populationCapacity };
}

/** Advances resource production by `dtSeconds`. */
export function applyProduction(state: GameState, dtSeconds: number): void {
  const rates = computeProduction(state);
  const resources = state.resources;

  resources.gold += rates.goldPerSecond * dtSeconds;
  resources.population = Math.min(
    rates.populationCapacity,
    resources.population + ECONOMY.populationGrowthPerSecond * dtSeconds,
  );
}
