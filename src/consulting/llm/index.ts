import type { CityReport } from '../../economy/cityReport';
import type { GameState } from '../../simulation/gameState';
import type { Advice } from '../advice';
import type { Proposal } from '../proposals';
import { briefKey, buildBrief } from './brief';
import { askModel, consultingMode, isModelAvailable } from './client';
import type { ConsultingReply } from './types';

export { isModelAvailable, consultingMode };
export type { ConsultingReply };

/** What the card knows about the model's answer right now. */
export type ModelState = 'off' | 'pending' | 'ready' | 'failed';

export interface ModelOpinion {
  state: ModelState;
  note?: string;
  /** A line about one plan, by proposal id. */
  why?: ReadonlyMap<string, string>;
  /** The plans the model would look at first, best first. */
  order?: readonly string[];
}

export const NO_OPINION: ModelOpinion = { state: 'off' };

/** The last answer, kept so re-opening the card does not ask again for the same city. */
let cached: { key: string; opinion: ModelOpinion } | null = null;
let inFlight: string | null = null;

/**
 * Asks the model what it makes of the city, if one is configured. Calls `onChange` as the
 * answer arrives; if nothing is configured, or the answer never comes, the card simply keeps
 * showing what the local advisor worked out.
 */
export function consultModel(
  state: GameState,
  report: CityReport,
  advice: readonly Advice[],
  proposals: readonly Proposal[],
  onChange: (opinion: ModelOpinion) => void,
): ModelOpinion {
  if (!isModelAvailable() || proposals.length === 0) return NO_OPINION;

  const brief = buildBrief(state, report, advice, proposals);
  const key = briefKey(brief);
  if (cached?.key === key) return cached.opinion;
  if (inFlight === key) return { state: 'pending' };

  inFlight = key;
  void askModel(brief).then((reply) => {
    if (inFlight !== key) return;
    inFlight = null;
    const opinion = reply ? toOpinion(reply) : { state: 'failed' as const };
    cached = { key, opinion };
    onChange(opinion);
  });
  return { state: 'pending' };
}

function toOpinion(reply: ConsultingReply): ModelOpinion {
  const why = new Map<string, string>();
  for (const pick of reply.picks) {
    if (pick.why) why.set(pick.id, pick.why);
  }
  return {
    state: 'ready',
    note: reply.note || undefined,
    why,
    order: reply.picks.map((pick) => pick.id),
  };
}

/** Forgets the last answer, so the next card asks afresh. */
export function forgetModelOpinion(): void {
  cached = null;
  inFlight = null;
}
