import { ERA_REQUIREMENTS, PROGRESSION } from '../config/balance';
import { RESEARCH, RESEARCH_IDS, type ResearchId } from '../config/research';
import type { GameState } from '../simulation/gameState';
import { nextEra, type EraId } from './era';
import { gainXp } from './level';

export interface EraRequirement {
  kind: 'population' | 'cityLevel' | 'research';
  current: number;
  target: number;
  met: boolean;
  /** For `research`: which research. */
  researchId?: ResearchId;
}

export interface EraProgress {
  next: EraId;
  requirements: EraRequirement[];
  /** Every requirement is met; the player may advance. */
  ready: boolean;
}

export type EraError = 'finalEra' | 'requirementsNotMet';

/** Requirements for the next era and how far the city is, or null in the final era. */
export function getEraProgress(state: GameState): EraProgress | null {
  const next = nextEra(state.era);
  if (!next || next === 'ancient') return null;

  const { population, cityLevel } = ERA_REQUIREMENTS[next];
  const people = Math.floor(state.resources.population);
  const requirements: EraRequirement[] = [
    { kind: 'population', current: people, target: population, met: people >= population },
    { kind: 'cityLevel', current: state.cityLevel, target: cityLevel, met: state.cityLevel >= cityLevel },
  ];
  for (const id of RESEARCH_IDS) {
    if (RESEARCH[id].opensEra !== next) continue;
    const done = state.research.completed.includes(id);
    requirements.push({ kind: 'research', current: done ? 1 : 0, target: 1, met: done, researchId: id });
  }
  return { next, requirements, ready: requirements.every((requirement) => requirement.met) };
}

/**
 * The player's decision to enter the next era. The simulation switches at once; the view plays
 * the transition on its own time.
 */
export function advanceEra(state: GameState): { ok: true; era: EraId } | { ok: false; error: EraError } {
  const progress = getEraProgress(state);
  if (!progress) return { ok: false, error: 'finalEra' };
  if (!progress.ready) return { ok: false, error: 'requirementsNotMet' };

  state.era = progress.next;
  state.eraHistory.push({ era: progress.next, at: Date.now() });
  gainXp(state, PROGRESSION.xp.era);
  return { ok: true, era: progress.next };
}
