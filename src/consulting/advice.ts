import { getUnlockState } from '../building/rules';
import type { BuildingType } from '../building/types';
import { CONSULTING } from '../config/balance';
import type { CityReport } from '../economy/cityReport';
import { hasResearchBuilding } from '../progression/research';
import type { GameState } from '../simulation/gameState';
import { canExpand, freeTiles } from '../world/territory';
import { canBuildOn } from '../world/placement';

/** Things the consulting service notices about the city. */
export type AdviceId =
  | 'needPower'
  | 'needHomes'
  | 'needJobs'
  | 'needParks'
  | 'needWater'
  | 'needResearch'
  | 'pollutedHomes'
  | 'roomRunningOut'
  | 'unhappy'
  | 'idleGold'
  | 'noRoads';

export interface Advice {
  id: AdviceId;
  /** A number worth showing in the message (a count or a percentage). */
  amount?: number;
  /** Where to look, if the advice is about a place. */
  focus?: { col: number; row: number };
}

const count = (state: GameState, type: BuildingType): number =>
  state.buildings.reduce((total, building) => total + (building.type === type ? 1 : 0), 0);

/**
 * Reads the city and returns what is worth mentioning, most pressing first. Advice is never a
 * scolding: it points at something and leaves the decision to the player (Phase 2 §6).
 */
export function getAdvice(state: GameState, report: CityReport): Advice[] {
  const advice: Advice[] = [];
  const available = (type: BuildingType) => getUnlockState(type, state) === 'available';
  const people = Math.floor(state.resources.population);

  if (report.powerDemand > report.powerSupply) {
    advice.push({
      id: 'needPower',
      amount: Math.ceil(report.powerDemand - report.powerSupply),
      focus: firstOfType(state, 'powerPlant'),
    });
  }

  if (report.populationCapacity > 0 && state.resources.population >= report.populationCapacity * CONSULTING.housingFullShare) {
    advice.push({ id: 'needHomes', amount: Math.max(1, Math.ceil((people + 5 - report.populationCapacity) / 5)) });
  }

  if (people > 0 && report.jobs < people * CONSULTING.jobsPerCitizen) {
    advice.push({ id: 'needJobs', amount: Math.max(1, Math.ceil(people * CONSULTING.jobsPerCitizen - report.jobs)) });
  }

  const houses = count(state, 'house');
  if (available('park') && houses >= 4 && count(state, 'park') < houses * CONSULTING.parksPerHouse) {
    advice.push({ id: 'needParks', amount: Math.ceil(houses * CONSULTING.parksPerHouse - count(state, 'park')) });
  }

  if (state.resources.happiness < CONSULTING.happinessBelow) {
    advice.push({ id: 'unhappy', amount: Math.round(state.resources.happiness) });
    if (available('well') && count(state, 'well') === 0) advice.push({ id: 'needWater' });
  }

  if (report.pollution.size > 0) {
    const [houseId] = [...report.pollution.keys()];
    const home = state.buildings.find((building) => building.id === houseId);
    advice.push({ id: 'pollutedHomes', amount: report.pollution.size, focus: home && { col: home.col, row: home.row } });
  }

  if (available('researchCenter') && !hasResearchBuilding(state)) advice.push({ id: 'needResearch' });

  const free = freeTiles(state);
  if (free <= CONSULTING.roomRunningOutTiles && canExpand(state)) {
    advice.push({ id: 'roomRunningOut', amount: free });
  }

  if (available('road') && count(state, 'road') === 0) advice.push({ id: 'noRoads' });

  if (state.resources.gold >= CONSULTING.idleGold) {
    advice.push({ id: 'idleGold', amount: Math.floor(state.resources.gold) });
  }

  return advice;
}

function firstOfType(state: GameState, type: BuildingType): { col: number; row: number } | undefined {
  const building = state.buildings.find((candidate) => candidate.type === type);
  return building && { col: building.col, row: building.row };
}

/** Whether a plan could put a building on this tile. */
export function isFree(state: GameState, col: number, row: number): boolean {
  return canBuildOn(state, col, row);
}
