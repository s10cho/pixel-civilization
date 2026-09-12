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
    era: 'ancient',
    cost: 60,
    points: 40,
    requires: [],
    effects: [{ kind: 'capacity', amount: 0.2 }],
  },
  pottery: {
    era: 'ancient',
    cost: 80,
    points: 50,
    requires: [],
    effects: [{ kind: 'gold', building: 'shop', amount: 0.25 }],
  },
  masonry: {
    era: 'ancient',
    cost: 150,
    points: 90,
    requires: ['agriculture', 'pottery'],
    effects: [{ kind: 'happiness', amount: 3 }],
    opensEra: 'medieval',
  },
  guilds: {
    era: 'medieval',
    cost: 300,
    points: 120,
    requires: [],
    effects: [{ kind: 'gold', building: 'shop', amount: 0.3 }],
  },
  engineering: {
    era: 'medieval',
    cost: 350,
    points: 140,
    requires: [],
    effects: [{ kind: 'power', amount: 0.3 }],
  },
  printingPress: {
    era: 'medieval',
    cost: 400,
    points: 150,
    requires: [],
    effects: [{ kind: 'research', amount: 0.5 }],
  },
  steamPower: {
    era: 'medieval',
    cost: 700,
    points: 240,
    requires: ['engineering', 'printingPress'],
    effects: [{ kind: 'power', amount: 0.2 }],
    opensEra: 'industrial',
  },
  electricity: {
    era: 'industrial',
    cost: 1200,
    points: 300,
    requires: [],
    effects: [{ kind: 'power', amount: 0.5 }],
  },
  massProduction: {
    era: 'industrial',
    cost: 1400,
    points: 320,
    requires: [],
    effects: [{ kind: 'gold', building: 'factory', amount: 0.3 }],
  },
  megaFactory: {
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
