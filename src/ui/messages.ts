import type { BuildingEffect } from '../economy/cityReport';
import type { CityProblem } from '../economy/problems';
import { t, tKey } from '../i18n';
import { researchName } from '../i18n/names';
import type { EraError, EraRequirement } from '../progression/eraProgress';
import type { ResearchError } from '../progression/research';
import type { ActionError } from '../simulation/actions';

/** Error codes share their message key, e.g. 'occupied' -> 'error.occupied'. */
export function actionErrorText(error: ActionError): string {
  return tKey(`error.${error}`);
}

export function eraErrorText(error: EraError): string {
  return tKey(`error.${error}`);
}

export function researchErrorText(error: ResearchError): string {
  return tKey(`error.${error}`);
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

export function effectText(effect: BuildingEffect): string {
  switch (effect.kind) {
    case 'nearHomes':
    case 'nearPower':
    case 'unpowered':
    case 'understaffed':
      return tKey(`effect.${effect.kind}`, { percent: percent(effect.amount) });
    default:
      return tKey(`effect.${effect.kind}`);
  }
}

export function eraRequirementText(requirement: EraRequirement): string {
  switch (requirement.kind) {
    case 'population':
    case 'cityLevel':
      return tKey(`requirement.${requirement.kind}`, {
        current: requirement.current,
        target: requirement.target,
      });
    case 'research':
      return t('requirement.research', { name: requirement.researchId ? researchName(requirement.researchId) : '' });
  }
}

export function problemText(problem: CityProblem): string {
  switch (problem.kind) {
    case 'powerShortage':
      return t('problem.powerShortage', { percent: percent(problem.amount) });
    case 'lowHappiness':
      return t('problem.lowHappiness');
    case 'pollution':
      return t('problem.pollution', { count: problem.amount });
  }
}
