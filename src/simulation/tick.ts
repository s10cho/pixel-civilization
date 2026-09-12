import { syncCitizens } from '../citizen/assignment';
import { updateCitizens } from '../citizen/behavior';
import { GROWTH_PACE, PROGRESSION } from '../config/balance';
import { computeCityReport, type CityReport } from '../economy/cityReport';
import { updateHappiness } from '../economy/happiness';
import { applyProduction } from '../economy/production';
import { gainXp } from '../progression/level';
import { advanceResearch } from '../progression/research';
import type { GameState } from './gameState';

/** Advances the whole simulation by one fixed step and returns the report it was based on. */
export function tickSimulation(state: GameState, dtSeconds: number): CityReport {
  const report = computeCityReport(state);
  applyProduction(state, report, dtSeconds);
  advanceResearch(state, report.researchPerSecond * GROWTH_PACE[state.growthPace].research, dtSeconds);

  // Every new highest population is worth a little city XP.
  const people = Math.floor(state.resources.population);
  if (people > state.peakPopulation) {
    gainXp(state, (people - state.peakPopulation) * PROGRESSION.xp.citizen);
    state.peakPopulation = people;
  }

  syncCitizens(state);
  updateCitizens(state, dtSeconds);
  updateHappiness(state, report, dtSeconds);
  return report;
}
