import type { BuildingType } from '../building/types';
import type { EraId } from '../progression/era';

export type ResearchId =
  | 'agriculture'
  | 'pottery'
  | 'masonry'
  | 'guilds'
  | 'engineering'
  | 'printingPress'
  | 'steamPower'
  | 'electricity'
  | 'massProduction'
  | 'megaFactory'
  | 'ecoFactory'
  | 'urbanPlanning';

/** Permanent bonuses granted by completed research. Amounts are fractions (0.25 = +25%). */
export type ResearchEffect =
  | { kind: 'gold'; building: BuildingType; amount: number }
  | { kind: 'power'; amount: number }
  | { kind: 'research'; amount: number }
  | { kind: 'capacity'; amount: number }
  | { kind: 'pollution'; amount: number }
  /** Flat city-wide happiness points. */
  | { kind: 'happiness'; amount: number };

export interface ResearchDefinition {
  name: string;
  description: string;
  era: EraId;
  /** Gold paid when the research starts. */
  cost: number;
  /** Research points needed to finish (a Lv1 research building makes 1 per second). */
  points: number;
  requires: readonly ResearchId[];
  /** Branch choice: once this is started, these can no longer be researched. */
  excludes?: readonly ResearchId[];
  effects: readonly ResearchEffect[];
  /** Completing it is one of the requirements for entering this era. */
  opensEra?: EraId;
}

export const RESEARCH: Record<ResearchId, ResearchDefinition> = {
  agriculture: {
    name: 'Agriculture',
    description: 'Fields feed more people: homes hold 20% more citizens.',
    era: 'ancient',
    cost: 60,
    points: 40,
    requires: [],
    effects: [{ kind: 'capacity', amount: 0.2 }],
  },
  pottery: {
    name: 'Pottery',
    description: 'Better wares to sell: shops earn 25% more gold.',
    era: 'ancient',
    cost: 80,
    points: 50,
    requires: [],
    effects: [{ kind: 'gold', building: 'shop', amount: 0.25 }],
  },
  masonry: {
    name: 'Masonry',
    description: 'Building in stone. Required to enter the Medieval era.',
    era: 'ancient',
    cost: 150,
    points: 90,
    requires: ['agriculture', 'pottery'],
    effects: [{ kind: 'happiness', amount: 3 }],
    opensEra: 'medieval',
  },
  guilds: {
    name: 'Guilds',
    description: 'Organized trade: shops earn 30% more gold.',
    era: 'medieval',
    cost: 300,
    points: 120,
    requires: [],
    effects: [{ kind: 'gold', building: 'shop', amount: 0.3 }],
  },
  engineering: {
    name: 'Engineering',
    description: 'Gears and waterwheels: power plants make 30% more power.',
    era: 'medieval',
    cost: 350,
    points: 140,
    requires: [],
    effects: [{ kind: 'power', amount: 0.3 }],
  },
  printingPress: {
    name: 'Printing Press',
    description: 'Knowledge spreads faster: research is 50% quicker.',
    era: 'medieval',
    cost: 400,
    points: 150,
    requires: [],
    effects: [{ kind: 'research', amount: 0.5 }],
  },
  steamPower: {
    name: 'Steam Power',
    description: 'Engines change everything. Required to enter the Industrial era.',
    era: 'medieval',
    cost: 700,
    points: 240,
    requires: ['engineering', 'printingPress'],
    effects: [{ kind: 'power', amount: 0.2 }],
    opensEra: 'industrial',
  },
  electricity: {
    name: 'Electricity',
    description: 'A power grid: power plants make 50% more power.',
    era: 'industrial',
    cost: 1200,
    points: 300,
    requires: [],
    effects: [{ kind: 'power', amount: 0.5 }],
  },
  massProduction: {
    name: 'Mass Production',
    description: 'Assembly lines: factories earn 30% more gold.',
    era: 'industrial',
    cost: 1400,
    points: 320,
    requires: [],
    effects: [{ kind: 'gold', building: 'factory', amount: 0.3 }],
  },
  megaFactory: {
    name: 'Mega Factories',
    description: 'Factories earn 50% more gold but pollute 50% more. Rules out Eco Factories.',
    era: 'industrial',
    cost: 2000,
    points: 400,
    requires: ['massProduction'],
    excludes: ['ecoFactory'],
    effects: [
      { kind: 'gold', building: 'factory', amount: 0.5 },
      { kind: 'pollution', amount: 0.5 },
    ],
  },
  ecoFactory: {
    name: 'Eco Factories',
    description: 'Factories earn 15% more gold and pollute 60% less. Rules out Mega Factories.',
    era: 'industrial',
    cost: 2000,
    points: 400,
    requires: ['massProduction'],
    excludes: ['megaFactory'],
    effects: [
      { kind: 'gold', building: 'factory', amount: 0.15 },
      { kind: 'pollution', amount: -0.6 },
    ],
  },
  urbanPlanning: {
    name: 'Urban Planning',
    description: 'Better cities: homes hold 25% more citizens and everyone is happier.',
    era: 'industrial',
    cost: 1600,
    points: 350,
    requires: [],
    effects: [
      { kind: 'capacity', amount: 0.25 },
      { kind: 'happiness', amount: 5 },
    ],
  },
};

export const RESEARCH_IDS = Object.keys(RESEARCH) as ResearchId[];
