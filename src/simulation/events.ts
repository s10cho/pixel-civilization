import { EVENTS } from '../config/balance';
import { RESEARCH } from '../config/research';
import type { CityReport } from '../economy/cityReport';
import type { GameState } from './gameState';
import { nextRandom, randomRange } from './random';

export type CityEventId = 'merchant' | 'harvest' | 'festival' | 'scholar';

/** Something nice that just happened, with what it gave. */
export interface CityEvent {
  id: CityEventId;
  gold?: number;
  citizens?: number;
  research?: number;
}

/**
 * Counts down to the next happy event and applies it. Events are always gifts: a merchant's
 * purse, new neighbours, a festival, a passing scholar. Call once per simulation tick.
 */
export function maybeTriggerEvent(state: GameState, report: CityReport, dtSeconds: number): CityEvent | null {
  state.nextEventSeconds -= dtSeconds;
  if (state.nextEventSeconds > 0) return null;
  state.nextEventSeconds = randomRange(state, EVENTS.intervalSeconds);
  // A settlement of two huts has nothing to celebrate yet.
  if (state.buildings.length < EVENTS.minBuildings) return null;

  const choices = eligible(state, report);
  if (choices.length === 0) return null;
  return apply(state, report, choices[Math.floor(nextRandom(state) * choices.length)]);
}

function eligible(state: GameState, report: CityReport): CityEventId[] {
  const choices: CityEventId[] = ['merchant'];
  if (state.resources.population + 1 <= report.populationCapacity) choices.push('harvest');
  if (state.citizens.length > 0) choices.push('festival');
  if (state.research.active) choices.push('scholar');
  return choices;
}

function apply(state: GameState, report: CityReport, id: CityEventId): CityEvent {
  switch (id) {
    case 'merchant': {
      const gold = Math.max(EVENTS.merchantMinGold, Math.round(report.goldPerSecond * EVENTS.merchantIncomeSeconds));
      state.resources.gold += gold;
      return { id, gold };
    }
    case 'harvest': {
      const room = report.populationCapacity - state.resources.population;
      const citizens = Math.max(1, Math.floor(Math.min(EVENTS.harvestCitizens, room)));
      state.resources.population += citizens;
      return { id, citizens };
    }
    case 'festival': {
      for (const citizen of state.citizens) citizen.leisureBoost += EVENTS.festivalHappiness;
      return { id };
    }
    case 'scholar': {
      const active = state.research.active!;
      const points = Math.min(EVENTS.scholarPoints, RESEARCH[active.id].points - active.progress);
      active.progress += points;
      return { id, research: Math.round(points) };
    }
  }
}
