import { canUpgradeFurther, getBuildCost, getUnlockState, getUpgradeCost } from '../building/rules';
import type { BuildingType } from '../building/types';
import { AUTO_GROW } from '../config/balance';
import { RESEARCH, RESEARCH_IDS, type ResearchId } from '../config/research';
import type { CityReport } from '../economy/cityReport';
import { getResearchStatus, hasResearchBuilding } from '../progression/research';
import { getBuildingAt } from '../world/placement';
import { getExpansionCost, getUnlockedArea } from '../world/territory';
import type { GameState } from './gameState';

/** One thing the advisor would like to do next. */
export type AutoAction =
  | { kind: 'build'; type: BuildingType; col: number; row: number }
  | { kind: 'upgrade'; buildingId: number }
  | { kind: 'expand' }
  | { kind: 'research'; id: ResearchId };

/**
 * The "auto-grow" advisor: a calm, deliberately slow player. It keeps the city balanced
 * (power, homes, jobs, a little greenery), never spends the player's whole purse and never
 * builds factories — their smoke is a choice the player should make.
 */
export function planAutoAction(state: GameState, report: CityReport): AutoAction | null {
  const budget = state.resources.gold * (1 - AUTO_GROW.goldReserve);

  const wanted = pickBuildingType(state, report);
  if (wanted && getBuildCost(wanted, state.era) <= budget) {
    const tile = pickTile(state, wanted);
    if (tile) return { kind: 'build', type: wanted, col: tile.col, row: tile.row };
  }

  const expansion = getExpansionCost(state.expansionLevel);
  if (expansion !== null && expansion <= budget && freeTiles(state) <= AUTO_GROW.expandWhenFreeTilesAtMost) {
    return { kind: 'expand' };
  }

  const research = pickResearch(state);
  if (research && RESEARCH[research].cost <= budget) return { kind: 'research', id: research };

  const upgrade = pickUpgrade(state, budget);
  if (upgrade !== null) return { kind: 'upgrade', buildingId: upgrade };

  return null;
}

/** What the city is missing most, of the types the advisor is willing to build. */
function pickBuildingType(state: GameState, report: CityReport): BuildingType | null {
  const unlocked = (type: BuildingType) => getUnlockState(type, state) === 'available';
  const counts = countByType(state);

  if (report.powerDemand > report.powerSupply && unlocked('powerPlant')) return 'powerPlant';

  // Somewhere to live, with farms to feed them.
  if (state.resources.population >= report.populationCapacity * AUTO_GROW.housingFullShare) {
    if (unlocked('farm') && counts.farm < counts.house * AUTO_GROW.farmsPerHouse) return 'farm';
    if (unlocked('house')) return 'house';
  }

  // Work for everyone, alternating shops and workshops.
  if (report.jobs < state.resources.population) {
    if (unlocked('workshop') && counts.workshop < counts.shop) return 'workshop';
    if (unlocked('shop')) return 'shop';
  }

  // Something cheerful while the city is a bit glum.
  if (state.resources.happiness < AUTO_GROW.happinessTarget) {
    if (unlocked('well') && counts.well === 0) return 'well';
    if (unlocked('inn') && counts.inn === 0) return 'inn';
  }

  if (unlocked('park') && counts.park < counts.house * AUTO_GROW.parksPerHouse) return 'park';
  if (unlocked('researchCenter') && counts.researchCenter === 0) return 'researchCenter';
  // Nothing urgent: keep making room for more citizens.
  return unlocked('house') ? 'house' : null;
}

/** The free tile that keeps the city compact and puts neighbours where they help. */
function pickTile(state: GameState, type: BuildingType): { col: number; row: number } | null {
  const area = getUnlockedArea(state.expansionLevel);
  const hall = state.buildings.find((building) => building.type === 'townHall');
  let best: { col: number; row: number } | null = null;
  let bestScore = -Infinity;

  for (let row = area.minRow; row <= area.maxRow; row++) {
    for (let col = area.minCol; col <= area.maxCol; col++) {
      if (getBuildingAt(state, col, row)) continue;
      const distance = hall ? Math.hypot(col - hall.col, row - hall.row) : 0;
      const score = neighbourScore(state, type, col, row) - distance;
      if (score > bestScore) {
        bestScore = score;
        best = { col, row };
      }
    }
  }
  return best;
}

/** Adjacency bonuses the city report rewards: shops near homes, homes near parks, away from smoke. */
function neighbourScore(state: GameState, type: BuildingType, col: number, row: number): number {
  let houses = 0;
  let parks = 0;
  let factories = 0;
  for (let dRow = -1; dRow <= 1; dRow++) {
    for (let dCol = -1; dCol <= 1; dCol++) {
      if (dRow === 0 && dCol === 0) continue;
      const neighbour = getBuildingAt(state, col + dCol, row + dRow);
      if (neighbour?.type === 'house') houses++;
      else if (neighbour?.type === 'park') parks++;
      else if (neighbour?.type === 'factory') factories++;
    }
  }
  const near = AUTO_GROW.adjacencyWeight;
  switch (type) {
    case 'shop':
    case 'park':
      return houses * near;
    case 'house':
      return parks * near - factories * near;
    default:
      return 0;
  }
}

function countByType(state: GameState): Record<BuildingType, number> {
  const counts: Record<BuildingType, number> = {
    townHall: 0,
    house: 0,
    farm: 0,
    shop: 0,
    workshop: 0,
    park: 0,
    well: 0,
    inn: 0,
    powerPlant: 0,
    researchCenter: 0,
    monument: 0,
    factory: 0,
  };
  for (const building of state.buildings) counts[building.type]++;
  return counts;
}

function freeTiles(state: GameState): number {
  const area = getUnlockedArea(state.expansionLevel);
  const tiles = (area.maxCol - area.minCol + 1) * (area.maxRow - area.minRow + 1);
  return tiles - state.buildings.length;
}

/** The cheapest research the city could start right now. */
function pickResearch(state: GameState): ResearchId | null {
  if (state.research.active || !hasResearchBuilding(state)) return null;
  const available = RESEARCH_IDS.filter((id) => getResearchStatus(state, id) === 'available');
  if (available.length === 0) return null;
  return available.reduce((cheapest, id) => (RESEARCH[id].cost < RESEARCH[cheapest].cost ? id : cheapest));
}

/** Levels up the least developed building, so the city improves evenly. */
function pickUpgrade(state: GameState, budget: number): number | null {
  let best: { id: number; level: number } | null = null;
  for (const building of state.buildings) {
    if (!canUpgradeFurther(building)) continue;
    if (getUpgradeCost(building, state.era) > budget * AUTO_GROW.upgradeBudgetShare) continue;
    if (!best || building.level < best.level) best = { id: building.id, level: building.level };
  }
  return best?.id ?? null;
}
