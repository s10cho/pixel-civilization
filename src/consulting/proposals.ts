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

export type ProposalKind = 'housing' | 'industry' | 'green' | 'commerce' | 'civic' | 'culture' | 'transit' | 'expand';

export type PlanKind = Exclude<ProposalKind, 'expand'>;

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

/**
 * What each slot of a plan wants, best first: the consulting service offers the best thing the
 * city can build today, so a modern district is not handed a mud hut.
 */
const ROLES = {
  home: ['ecoHousing', 'highRise', 'townhouseRow', 'studioBlock', 'tenement', 'house'],
  shop: ['supermarket', 'generalStore', 'marketSquare', 'tradingPost', 'shop'],
  green: ['playground', 'promenade', 'park'],
  leisure: ['cinema', 'swimmingPool', 'bathhouse', 'campfire'],
  works: ['recyclingCenter', 'textileMill', 'sawmill', 'stonemason', 'workshop'],
  power: ['windFarm', 'gasWorks', 'coalPlant', 'powerPlant'],
  health: ['hospital', 'clinic', 'infirmary', 'herbalist'],
  water: ['sewageWorks', 'cistern', 'well'],
  culture: ['publicLibrary', 'museum', 'musicHall', 'newspaper', 'playhouse', 'storyGround'],
  transit: ['busTerminal', 'tramStop', 'trainStation', 'stable'],
  street: ['road'],
} as const satisfies Record<string, readonly BuildingType[]>;

type Role = keyof typeof ROLES;

/** A block the plan lays on the chosen spot, as roles rather than fixed buildings. */
const TEMPLATES: Record<PlanKind, { role: Role; dc: number; dr: number }[]> = {
  housing: [
    { role: 'home', dc: 0, dr: 0 },
    { role: 'home', dc: 1, dr: 0 },
    { role: 'home', dc: 0, dr: 1 },
    { role: 'green', dc: 1, dr: 1 },
  ],
  commerce: [
    { role: 'shop', dc: 0, dr: 0 },
    { role: 'shop', dc: 1, dr: 0 },
    { role: 'street', dc: 0, dr: 1 },
    { role: 'street', dc: 1, dr: 1 },
  ],
  industry: [
    { role: 'works', dc: 0, dr: 0 },
    { role: 'works', dc: 1, dr: 0 },
    { role: 'power', dc: 0, dr: 1 },
  ],
  green: [
    { role: 'green', dc: 0, dr: 0 },
    { role: 'green', dc: 1, dr: 1 },
    { role: 'leisure', dc: 1, dr: 0 },
  ],
  civic: [
    { role: 'health', dc: 0, dr: 0 },
    { role: 'water', dc: 1, dr: 0 },
    { role: 'green', dc: 0, dr: 1 },
  ],
  culture: [
    { role: 'culture', dc: 0, dr: 0 },
    { role: 'culture', dc: 1, dr: 1 },
    { role: 'green', dc: 1, dr: 0 },
  ],
  transit: [
    { role: 'transit', dc: 0, dr: 0 },
    { role: 'street', dc: 1, dr: 0 },
    { role: 'street', dc: 1, dr: 1 },
  ],
};

/**
 * What the city could do next: a few places for whatever it needs most, several kinds of plan
 * so there is a real choice, plus widening the territory when it is running out of room.
 */
export function getProposals(state: GameState, report: CityReport): Proposal[] {
  const proposals: Proposal[] = [];

  for (const kind of neededKinds(state, report)) {
    const steps = usableTemplate(state, kind);
    if (steps.length === 0) continue;
    // The city's most pressing need gets two places to choose between; the rest get one each,
    // so the list stays a spread of ideas rather than one idea over and over.
    const wanted = proposals.length === 0 ? CONSULTING.candidatesPerKind : 1;
    let candidate = 0;
    for (const spot of findSpots(state, kind, CONSULTING.candidateSpots)) {
      const plan = steps.map((step) => ({ type: step.type, col: spot.col + step.dc, row: spot.row + step.dr }));
      if (plan.some((step) => !isFree(state, step.col, step.row))) continue;
      candidate++;
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
      if (candidate >= wanted) break;
    }
    if (proposals.length >= CONSULTING.maxProposals) break;
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

/** All the plans that make sense, the ones the city actually needs first. */
function neededKinds(state: GameState, report: CityReport): PlanKind[] {
  const kinds: PlanKind[] = [];
  const people = Math.floor(state.resources.population);
  if (report.populationCapacity === 0 || state.resources.population >= report.populationCapacity * CONSULTING.housingFullShare) {
    kinds.push('housing');
  }
  if (people > 0 && report.jobs < people * CONSULTING.jobsPerCitizen) kinds.push('commerce');
  if (state.resources.happiness < CONSULTING.happinessBelow) kinds.push('green');
  if (report.powerDemand > report.powerSupply) kinds.push('industry');
  if (report.pollution.size > 0) kinds.push('civic');
  // A comfortable city still gets a choice: everything else follows, in a steady order.
  for (const rest of ['housing', 'commerce', 'green', 'culture', 'civic', 'transit', 'industry'] as const) {
    if (!kinds.includes(rest)) kinds.push(rest);
  }
  return kinds;
}

/** The best building the city can put in this slot today, or nothing if it can build none. */
function fillRole(state: GameState, role: Role): BuildingType | null {
  return ROLES[role].find((type) => getUnlockState(type, state) === 'available') ?? null;
}

/** The template with every slot filled in, dropping anything the city cannot build yet. */
function usableTemplate(state: GameState, kind: PlanKind): { type: BuildingType; dc: number; dr: number }[] {
  const steps: { type: BuildingType; dc: number; dr: number }[] = [];
  for (const step of TEMPLATES[kind]) {
    const type = fillRole(state, step.role);
    if (type) steps.push({ type, dc: step.dc, dr: step.dr });
  }
  return steps;
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
  const taken = new Set<Where>();
  // Two passes: first one spot per part of the city, then fill up from what is left. Candidates
  // for the same idea then read as different places rather than three times "the centre".
  for (const freshRegion of [true, false]) {
    for (const spot of spots) {
      if (chosen.length >= wanted) break;
      const where = whereIn(state, spot.col, spot.row);
      if (freshRegion && taken.has(where)) continue;
      if (chosen.some((other) => Math.hypot(other.col - spot.col, other.row - spot.row) < CONSULTING.spotSpacing)) {
        continue;
      }
      chosen.push({ col: spot.col, row: spot.row });
      taken.add(where);
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
