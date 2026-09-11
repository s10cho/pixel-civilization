import type { BuildingType } from '../building/types';
import type { ActionError } from '../simulation/actions';

export const ACTION_ERROR_MESSAGES: Record<ActionError, string> = {
  outOfBounds: 'Outside the map',
  locked: 'This land is not part of your territory yet',
  occupied: 'That tile is already occupied',
  notBuildable: 'This building cannot be built',
  insufficientGold: 'Not enough gold',
  notFound: 'That building no longer exists',
  maxLevel: 'Already at max level',
  maxExpansion: 'Your territory already covers the whole map',
};

export const BUILDING_DESCRIPTIONS: Record<BuildingType, string> = {
  townHall: 'City center. Collects taxes from every citizen.',
  house: 'Home for citizens.',
  shop: 'Earns gold and gives citizens jobs.',
  park: 'Makes the whole city happier.',
};
