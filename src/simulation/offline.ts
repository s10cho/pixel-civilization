import { OFFLINE } from '../config/balance';
import { computeCityReport } from '../economy/cityReport';
import { applyProduction } from '../economy/production';
import type { GameState } from './gameState';

export interface OfflineReport {
  /** Real time away, in seconds. */
  awaySeconds: number;
  /** Time actually credited (capped at OFFLINE.maxSeconds). */
  creditedSeconds: number;
  capped: boolean;
  gold: number;
  population: number;
}

/**
 * Credits production for time away: gold and population only. Research, XP and citizen
 * activity stay frozen while the player is gone.
 */
export function applyOfflineProgress(state: GameState, awaySeconds: number): OfflineReport {
  const away = Math.max(0, awaySeconds);
  const credited = Math.min(away, OFFLINE.maxSeconds);
  const goldBefore = state.resources.gold;
  const peopleBefore = Math.floor(state.resources.population);

  for (let remaining = credited; remaining > 0; remaining -= OFFLINE.stepSeconds) {
    const dt = Math.min(OFFLINE.stepSeconds, remaining);
    applyProduction(state, computeCityReport(state), dt * OFFLINE.efficiency);
  }

  // Population reached while away does not count as a new record worth XP.
  const people = Math.floor(state.resources.population);
  state.peakPopulation = Math.max(state.peakPopulation, people);

  return {
    awaySeconds: away,
    creditedSeconds: credited,
    capped: away > OFFLINE.maxSeconds,
    gold: state.resources.gold - goldBefore,
    population: people - peopleBefore,
  };
}
