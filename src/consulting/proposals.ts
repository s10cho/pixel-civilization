import { getBuildCost, getUnlockState } from '../building/rules';
import type { BuildingType } from '../building/types';
import { CONSULTING } from '../config/balance';
import type { CityReport } from '../economy/cityReport';
import { placeBuilding, expandTerritory } from '../simulation/actions';
import type { GameState } from '../simulation/gameState';
import {
  expansionOptions,
  freeTiles,
  getExpansionCost,
  getUnlockedArea,
  type Direction,
} from '../world/territory';
import { isFree } from './advice';

/** One building the plan would put down. */
export interface PlanStep {
  type: BuildingType;
  col: number;
  row: number;
}

export type ProposalKind = 'housing' | 'industry' | 'green' | 'commerce' | 'expand';

/**
 * A plan the player can accept with one tap. Proposals are always optional and always
 * affordable-checked before being offered (Phase 2 §6: analysis, options, the player decides).
 */
export interface Proposal {
  id: string;
  kind: ProposalKind;
  /** Roughly where it would happen, for the map preview and the label. */
  anchor?: { col: number; row: number };
  /** Which part of the city it sits in ('north', 'east', ...), for the label. */
  where?: Where;
  /** 1-based index when several candidates are offered for the same thing. */
  candidate?: number;
  /** For an expansion, the side the land would be added to. */
  direction?: Direction;
  /** New tiles an expansion would add. */
  tiles?: number;
  cost: number;
  steps: PlanStep[];
}

export type Where = 'north' | 'east' | 'south' | 'west' | 'centre';

/** A block of buildings the plan repeats on the chosen spot. */
const TEMPLATES: Record<Exclude<ProposalKind, 'expand'>, { type: BuildingType; dc: number; dr: number }[]> = {
  housing: [
    { type: 'house', dc: 0, dr: 0 },
    { type: 'house', dc: 1, dr: 0 },
    { type: 'house', dc: 0, dr: 1 },
    { type: 'park', dc: 1, dr: 1 },
  ],
  industry: [
    { type: 'workshop', dc: 0, dr: 0 },
    { type: 'workshop', dc: 1, dr: 0 },
    { type: 'powerPlant', dc: 0, dr: 1 },
  ],
  green: [
    { type: 'park', dc: 0, dr: 0 },
    { type: 'well', dc: 1, dr: 0 },
    { type: 'park', dc: 1, dr: 1 },
  ],
  commerce: [
    { type: 'shop', dc: 0, dr: 0 },
    { type: 'shop', dc: 1, dr: 0 },
    { type: 'road', dc: 0, dr: 1 },
    { type: 'road', dc: 1, dr: 1 },
  ],
};

/**
 * What the city could do next: up to three places for whatever it needs most, plus widening
 * the territory when it is running out of room.
 */
export function getProposals(state: GameState, report: CityReport): Proposal[] {
  const proposals: Proposal[] = [];
  const kinds = neededKinds(state, report);

  for (const kind of kinds) {
    const steps = usableTemplate(state, kind);
    if (steps.length === 0) continue;
    let candidate = 0;
    for (const spot of findSpots(state, kind, CONSULTING.candidateSpots)) {
      candidate++;
      const plan = steps.map((step) => ({ type: step.type, col: spot.col + step.dc, row: spot.row + step.dr }));
      if (plan.some((step) => !isFree(state, step.col, step.row))) continue;
      const cost = plan.reduce((total, step) => total + getBuildCost(step.type, state.era), 0);
      proposals.push({
        id: `${kind}:${spot.col}:${spot.row}`,
        kind,
        anchor: { col: spot.col, row: spot.row },
        where: whereIn(state, spot.col, spot.row),
        candidate,
        cost,
        steps: plan,
      });
    }
    if (proposals.length >= CONSULTING.candidateSpots) break;
  }

  // Running out of room is a decision for the player: offer every side that still has space.
  if (freeTiles(state) <= CONSULTING.roomRunningOutTiles) {
    const cost = getExpansionCost(state.expansionLevel);
    for (const option of expansionOptions(state).sort((a, b) => b.tiles - a.tiles)) {
      proposals.push({
        id: `expand:${option.direction}`,
        kind: 'expand',
        cost,
        steps: [],
        direction: option.direction,
        tiles: option.tiles,
        anchor: {
          col: Math.round((option.band.minCol + option.band.maxCol) / 2),
          row: Math.round((option.band.minRow + option.band.maxRow) / 2),
        },
      });
    }
  }

  return proposals.slice(0, CONSULTING.maxProposals);
}

/** Which kinds of plan would help, most useful first. */
function neededKinds(state: GameState, report: CityReport): Exclude<ProposalKind, 'expand'>[] {
  const kinds: Exclude<ProposalKind, 'expand'>[] = [];
  const people = Math.floor(state.resources.population);
  if (report.populationCapacity === 0 || state.resources.population >= report.populationCapacity * CONSULTING.housingFullShare) {
    kinds.push('housing');
  }
  if (people > 0 && report.jobs < people * CONSULTING.jobsPerCitizen) kinds.push('commerce');
  if (state.resources.happiness < CONSULTING.happinessBelow) kinds.push('green');
  if (report.powerDemand > report.powerSupply) kinds.push('industry');
  // Something is always on offer, even when the city is comfortable.
  for (const fallback of ['housing', 'commerce', 'green'] as const) {
    if (!kinds.includes(fallback)) kinds.push(fallback);
  }
  return kinds;
}

/** The template with anything the city cannot build yet dropped. */
function usableTemplate(state: GameState, kind: Exclude<ProposalKind, 'expand'>) {
  return TEMPLATES[kind].filter((step) => getUnlockState(step.type, state) === 'available');
}

/**
 * Free spots for a plan, spread out so the three candidates are genuinely different places.
 * Housing likes to be near the centre, industry away from it.
 */
function findSpots(state: GameState, kind: ProposalKind, wanted: number): { col: number; row: number }[] {
  const area = getUnlockedArea(state);
  const hall = state.buildings.find((building) => building.type === 'townHall');
  const centre = hall ?? { col: (area.minCol + area.maxCol) / 2, row: (area.minRow + area.maxRow) / 2 };
  const spots: { col: number; row: number; score: number }[] = [];

  for (let row = area.minRow; row <= area.maxRow - 1; row++) {
    for (let col = area.minCol; col <= area.maxCol - 1; col++) {
      // A plan needs its 2x2 block free.
      if (!isFree(state, col, row) || !isFree(state, col + 1, row) || !isFree(state, col, row + 1) || !isFree(state, col + 1, row + 1)) {
        continue;
      }
      const distance = Math.hypot(col - centre.col, row - centre.row);
      const score = kind === 'industry' ? distance : -distance;
      spots.push({ col, row, score });
    }
  }

  spots.sort((a, b) => b.score - a.score);
  const chosen: { col: number; row: number }[] = [];
  for (const spot of spots) {
    if (chosen.every((taken) => Math.hypot(taken.col - spot.col, taken.row - spot.row) >= CONSULTING.spotSpacing)) {
      chosen.push({ col: spot.col, row: spot.row });
      if (chosen.length >= wanted) break;
    }
  }
  return chosen;
}

/** Which part of the city a tile is in, for the proposal's name. */
function whereIn(state: GameState, col: number, row: number): Where {
  const area = getUnlockedArea(state);
  const midCol = (area.minCol + area.maxCol) / 2;
  const midRow = (area.minRow + area.maxRow) / 2;
  const dc = col - midCol;
  const dr = row - midRow;
  // Only the very middle counts as "the centre", so candidates in different places read as
  // different places.
  const span = Math.max(area.maxCol - area.minCol, 1) / 8;
  if (Math.abs(dc) < span && Math.abs(dr) < span) return 'centre';
  return Math.abs(dc) > Math.abs(dr) ? (dc > 0 ? 'east' : 'west') : dr > 0 ? 'south' : 'north';
}

export interface ProposalResult {
  /** How many buildings actually went up. */
  built: number;
  expanded: boolean;
}

/** Carries out an accepted plan, skipping anything that no longer fits. */
export function applyProposal(state: GameState, proposal: Proposal): ProposalResult {
  if (proposal.kind === 'expand') {
    return { built: 0, expanded: proposal.direction ? expandTerritory(state, proposal.direction).ok : false };
  }
  let built = 0;
  for (const step of proposal.steps) {
    if (placeBuilding(state, step.type, step.col, step.row).ok) built++;
  }
  return { built, expanded: false };
}
