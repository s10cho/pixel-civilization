import type { CityBrief, ConsultingReply } from './types';

export const MAX_NOTE_LENGTH = 320;
export const MAX_WHY_LENGTH = 120;
export const MAX_PICKS = 3;

/**
 * What the consultant is for. The game's design brief is explicit that the advisor helps but
 * never plays: it may read the city and speak about the plans already on the table, and that
 * is all. Anything it invents is dropped when the reply is checked.
 */
export const SYSTEM_PROMPT = [
  'You advise the mayor of a small, calm city-building game. The game is a healing game:',
  'there is no failure state, no scoring, and no urgency. Never warn, scold, or press.',
  '',
  'You are given a summary of the city and a list of plans the game has already worked out.',
  'Write a short reading of the city, then say which of those plans you would look at first',
  'and why, in one line each. You may only refer to plans by the ids you were given.',
  'Never invent a plan, a building, a place, or a number that is not in the summary.',
  '',
  'Write in the language named by "locale" ("ko" = Korean, "en" = English).',
  'The city has no religious buildings and never will; do not suggest any.',
  '',
  'Answer with JSON only, no prose around it, in this shape:',
  '{"note": "<2-3 sentences>", "picks": [{"id": "<an id from options>", "why": "<one line>"}]}',
  `Keep note under ${MAX_NOTE_LENGTH} characters, each why under ${MAX_WHY_LENGTH}, and at most ${MAX_PICKS} picks.`,
].join('\n');

export function userPrompt(brief: CityBrief): string {
  return `City summary:\n${JSON.stringify(brief, null, 1)}`;
}

/**
 * Reads the model's answer, keeping only what the game can actually act on. A reply that is
 * not JSON, or that talks about plans that were never offered, loses whatever does not fit
 * rather than reaching the player.
 */
export function parseReply(text: string, allowedIds: ReadonlySet<string>): ConsultingReply | null {
  const json = extractJson(text);
  if (!json) return null;

  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const body = value as { note?: unknown; picks?: unknown };

  const note = typeof body.note === 'string' ? clip(body.note, MAX_NOTE_LENGTH) : '';
  const picks: ConsultingReply['picks'] = [];
  if (Array.isArray(body.picks)) {
    const seen = new Set<string>();
    for (const entry of body.picks) {
      if (picks.length >= MAX_PICKS) break;
      if (typeof entry !== 'object' || entry === null) continue;
      const { id, why } = entry as { id?: unknown; why?: unknown };
      if (typeof id !== 'string' || !allowedIds.has(id) || seen.has(id)) continue;
      seen.add(id);
      picks.push({ id, why: typeof why === 'string' ? clip(why, MAX_WHY_LENGTH) : '' });
    }
  }

  return note || picks.length > 0 ? { note, picks } : null;
}

/** The first JSON object in the text, so a stray sentence around it does not spoil the reply. */
function extractJson(text: string): string | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start >= 0 && end > start ? text.slice(start, end + 1) : null;
}

function clip(text: string, limit: number): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  return trimmed.length <= limit ? trimmed : `${trimmed.slice(0, limit - 1)}…`;
}
