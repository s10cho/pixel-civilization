import type { CityReport } from '../../economy/cityReport';
import { getLocale } from '../../i18n';
import type { GameState } from '../../simulation/gameState';
import { freeTiles } from '../../world/territory';
import type { Advice } from '../advice';
import type { Proposal } from '../proposals';
import type { BriefOption, CityBrief } from './types';

/**
 * Boils the city down to the few dozen numbers worth reasoning about. The model never sees the
 * whole board: it reads this summary and speaks about the plans the game has already worked
 * out, which is what keeps it an advisor rather than a player.
 */
export function buildBrief(
  state: GameState,
  report: CityReport,
  advice: readonly Advice[],
  proposals: readonly Proposal[],
): CityBrief {
  const buildings: Record<string, number> = {};
  for (const building of state.buildings) {
    buildings[building.type] = (buildings[building.type] ?? 0) + 1;
  }

  return {
    locale: getLocale(),
    era: state.era,
    cityLevel: state.cityLevel,
    population: Math.floor(state.resources.population),
    populationCapacity: report.populationCapacity,
    jobs: report.jobs,
    happiness: Math.round(state.resources.happiness),
    gold: Math.floor(state.resources.gold),
    goldPerSecond: Math.round(report.goldPerSecond * 10) / 10,
    powerSupply: Math.round(report.powerSupply),
    powerDemand: Math.round(report.powerDemand),
    pollutedHomes: report.pollution.size,
    freeTiles: freeTiles(state),
    buildings,
    notices: advice.map((item) => item.id),
    options: proposals.map(toOption),
  };
}

function toOption(proposal: Proposal): BriefOption {
  return {
    id: proposal.id,
    kind: proposal.kind,
    where: proposal.where,
    cost: proposal.cost,
    builds: proposal.steps.map((step) => step.type),
  };
}

/** A stable fingerprint of a brief, so the same city is not asked about twice. */
export function briefKey(brief: CityBrief): string {
  return JSON.stringify([
    brief.locale,
    brief.era,
    brief.cityLevel,
    brief.population,
    brief.happiness,
    brief.notices,
    brief.options.map((option) => option.id),
  ]);
}
