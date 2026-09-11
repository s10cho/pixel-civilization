import type { BuildingType } from '../building/types';
import { RESEARCH, type ResearchId } from '../config/research';
import type { GameState } from '../simulation/gameState';
import { eraIndex } from './era';
import { gainXp } from './level';
import { PROGRESSION } from '../config/balance';

export interface ResearchState {
  completed: ResearchId[];
  /** The research in progress, with points accumulated so far. */
  active: { id: ResearchId; progress: number } | null;
}

export type ResearchStatus = 'done' | 'active' | 'available' | 'locked' | 'excluded' | 'laterEra';

export type ResearchError = 'noResearchCenter' | 'researchUnavailable' | 'researchBusy' | 'insufficientGold';

export function getResearchStatus(state: GameState, id: ResearchId): ResearchStatus {
  const research = state.research;
  if (research.completed.includes(id)) return 'done';
  if (research.active?.id === id) return 'active';
  const definition = RESEARCH[id];
  if (eraIndex(definition.era) > eraIndex(state.era)) return 'laterEra';
  const chosen = [...research.completed, ...(research.active ? [research.active.id] : [])];
  if (chosen.some((other) => RESEARCH[other].excludes?.includes(id))) return 'excluded';
  if (!definition.requires.every((required) => research.completed.includes(required))) return 'locked';
  return 'available';
}

export function hasResearchBuilding(state: GameState): boolean {
  return state.buildings.some((b) => b.type === 'researchCenter');
}

/** Pays the gold cost and starts researching `id`. Only one research runs at a time. */
export function startResearch(
  state: GameState,
  id: ResearchId,
): { ok: true } | { ok: false; error: ResearchError } {
  if (!hasResearchBuilding(state)) return { ok: false, error: 'noResearchCenter' };
  if (state.research.active) return { ok: false, error: 'researchBusy' };
  if (getResearchStatus(state, id) !== 'available') return { ok: false, error: 'researchUnavailable' };
  const cost = RESEARCH[id].cost;
  if (state.resources.gold < cost) return { ok: false, error: 'insufficientGold' };

  state.resources.gold -= cost;
  state.research.active = { id, progress: 0 };
  return { ok: true };
}

/** Adds `rate * dt` research points; returns the id of research that just completed, if any. */
export function advanceResearch(state: GameState, rate: number, dtSeconds: number): ResearchId | null {
  const active = state.research.active;
  if (!active) return null;
  active.progress += rate * dtSeconds;
  if (active.progress < RESEARCH[active.id].points) return null;

  state.research.completed.push(active.id);
  state.research.active = null;
  gainXp(state, PROGRESSION.xp.research);
  return active.id;
}

/** Summed permanent bonuses from completed research. */
export interface ResearchModifiers {
  gold: Partial<Record<BuildingType, number>>;
  power: number;
  research: number;
  capacity: number;
  pollution: number;
  happiness: number;
}

export function getResearchModifiers(state: GameState): ResearchModifiers {
  const modifiers: ResearchModifiers = { gold: {}, power: 0, research: 0, capacity: 0, pollution: 0, happiness: 0 };
  for (const id of state.research.completed) {
    for (const effect of RESEARCH[id].effects) {
      if (effect.kind === 'gold') {
        modifiers.gold[effect.building] = (modifiers.gold[effect.building] ?? 0) + effect.amount;
      } else {
        modifiers[effect.kind] += effect.amount;
      }
    }
  }
  return modifiers;
}
