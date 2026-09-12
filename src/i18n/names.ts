import type { BuildingType } from '../building/types';
import type { ResearchId } from '../config/research';
import type { EraId } from '../progression/era';
import { t, tKey } from './index';

/** Display name of a building type in an era (buildings are renamed as the city advances). */
export function buildingName(type: BuildingType, era: EraId): string {
  return tKey(`building.${type}.${era}`);
}

export function buildingDescription(type: BuildingType): string {
  return tKey(`building.${type}.desc`);
}

export function researchName(id: ResearchId): string {
  return tKey(`research.${id}.name`);
}

export function researchDescription(id: ResearchId): string {
  return tKey(`research.${id}.desc`);
}

export function eraName(era: EraId): string {
  return tKey(`era.${era}`);
}

export function eraTagline(era: EraId): string {
  return tKey(`era.tagline.${era}`);
}

/** Gold amounts as shown on buttons and costs. */
export function goldText(amount: string): string {
  return t('format.gold', { amount });
}
