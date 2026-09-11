import type { BuildingType } from '../building/types';
import type { BuildingEffect } from '../economy/cityReport';
import type { CityProblem } from '../economy/problems';
import type { ResearchError } from '../progression/research';
import type { ActionError } from '../simulation/actions';

export const ACTION_ERROR_MESSAGES: Record<ActionError, string> = {
  outOfBounds: 'Outside the map',
  locked: 'This land is not part of your territory yet',
  occupied: 'That tile is already occupied',
  notBuildable: 'This building cannot be built',
  notUnlocked: 'Not unlocked yet',
  notMovable: 'This building cannot be moved',
  insufficientGold: 'Not enough gold',
  notFound: 'That building no longer exists',
  maxLevel: 'Already at max level',
  maxExpansion: 'Your territory already covers the whole map',
};

export const BUILDING_DESCRIPTIONS: Record<BuildingType, string> = {
  townHall: 'The heart of the city. Collects taxes from every citizen.',
  house: 'Home for citizens. A park next door helps them thrive.',
  shop: 'Earns gold and gives citizens jobs. Nearby homes bring more customers.',
  park: 'Makes the whole city happier and gives citizens somewhere to relax.',
  powerPlant: 'Generates power for shops and industry.',
  researchCenter: 'Researches new technology. More and bigger ones research faster.',
  factory: 'Earns a lot of gold, but pollutes homes nearby.',
};

export const RESEARCH_ERROR_MESSAGES: Record<ResearchError, string> = {
  noResearchCenter: 'Build a research building first',
  researchUnavailable: 'That research is not available',
  researchBusy: 'Finish the current research first',
  insufficientGold: 'Not enough gold',
};

const percent = (value: number) => `${Math.round(value * 100)}%`;

export function effectText(effect: BuildingEffect): string {
  switch (effect.kind) {
    case 'nearHomes':
      return `+${percent(effect.amount)} gold from nearby homes`;
    case 'nearPower':
      return `+${percent(effect.amount)} output from a power plant next door`;
    case 'nearPark':
      return 'Park next door: faster growth, happier residents';
    case 'polluted':
      return 'Polluted by industry nearby';
    case 'unpowered':
      return `Not enough power: −${percent(effect.amount)} output`;
    case 'understaffed':
      return `Not enough workers: −${percent(effect.amount)} output`;
  }
}

export function problemText(problem: CityProblem): string {
  switch (problem.kind) {
    case 'powerShortage':
      return `Power shortage: −${percent(problem.amount)} output`;
    case 'lowHappiness':
      return 'Citizens are unhappy: growth has stopped';
    case 'pollution':
      return `Pollution is hurting ${problem.amount} ${problem.amount === 1 ? 'home' : 'homes'}`;
  }
}
