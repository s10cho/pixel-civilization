import { getBuildingOutput, type BuildingOutput } from '../building/rules';
import type { Building } from '../building/types';
import { ADJACENCY, ECONOMY, ERA_SETTINGS, HAPPINESS, POLLUTION, POWER, STAFFING } from '../config/balance';
import { getResearchModifiers } from '../progression/research';
import type { GameState } from '../simulation/gameState';

/** Why a building produces more or less than its base output. */
export type EffectKind =
  | 'nearHomes'
  | 'nearPower'
  | 'nearPark'
  | 'nearRoad'
  | 'polluted'
  | 'unpowered'
  | 'understaffed';

export interface BuildingEffect {
  kind: EffectKind;
  /** Fractional change (0.3 = 30%) or, for `polluted`, the pollution received. */
  amount: number;
}

export interface BuildingReport {
  /** Effective gold per second after every effect. */
  goldPerSecond: number;
  /** Effective research points per second. */
  researchPerSecond: number;
  powerSupply: number;
  powerDemand: number;
  /** Share of full output reached given power and staffing (1 = 100%). */
  efficiency: number;
  effects: BuildingEffect[];
}

/**
 * Everything derived from the current city layout and research, computed once per tick and
 * shared by production, happiness, research, city problems and the UI.
 */
export interface CityReport {
  buildings: Map<number, BuildingReport>;
  /** Total income: buildings plus taxes. */
  goldPerSecond: number;
  taxPerSecond: number;
  researchPerSecond: number;
  populationCapacity: number;
  jobs: number;
  powerSupply: number;
  powerDemand: number;
  /** min(1, supply / demand); 1 when nothing needs power. */
  powerRatio: number;
  /** Share of jobs that can be filled by the population (1 = fully staffed). */
  staffing: number;
  /** City-wide happiness from buildings (capped) and research. */
  happinessBonus: number;
  /** Population growth multiplier from homes next to parks (1 = no bonus). */
  growthMultiplier: number;
  /** Houses with a park next door. */
  parkHomes: Set<number>;
  /** Pollution reaching each affected house. */
  pollution: Map<number, number>;
}

const key = (col: number, row: number) => col * 1000 + row;

export function computeCityReport(state: GameState): CityReport {
  const era = ERA_SETTINGS[state.era];
  const research = getResearchModifiers(state);
  const grid = new Map<number, Building>();
  const outputs = new Map<number, BuildingOutput>();
  for (const building of state.buildings) {
    grid.set(key(building.col, building.row), building);
    outputs.set(building.id, getBuildingOutput(building));
  }
  const around = (building: Building, radius: number): Building[] => {
    const found: Building[] = [];
    for (let dc = -radius; dc <= radius; dc++) {
      for (let dr = -radius; dr <= radius; dr++) {
        if (dc === 0 && dr === 0) continue;
        const neighbour = grid.get(key(building.col + dc, building.row + dr));
        if (neighbour) found.push(neighbour);
      }
    }
    return found;
  };

  let powerSupply = 0;
  let powerDemand = 0;
  let populationCapacity = 0;
  let jobs = 0;
  let buildingHappiness = 0;
  for (const output of outputs.values()) {
    powerSupply += output.powerSupply * (1 + research.power);
    powerDemand += output.powerDemand * era.powerDemandMultiplier;
    populationCapacity += Math.floor(output.populationCapacity * (1 + research.capacity));
    jobs += output.jobs;
    buildingHappiness += output.happinessBonus;
  }
  const powerRatio = powerDemand > 0 ? Math.min(1, powerSupply / powerDemand) : 1;
  const people = Math.floor(state.resources.population);
  const staffing = jobs > 0 ? Math.min(1, people / jobs) : 1;

  const buildings = new Map<number, BuildingReport>();
  const parkHomes = new Set<number>();
  let houses = 0;
  let buildingGold = 0;
  let researchPerSecond = 0;

  for (const building of state.buildings) {
    const output = outputs.get(building.id)!;
    const neighbours = around(building, ADJACENCY.radius);
    const effects: BuildingEffect[] = [];
    let bonus = research.gold[building.type] ?? 0;

    if (building.type === 'house') {
      houses++;
      if (neighbours.some((n) => n.type === 'park')) {
        parkHomes.add(building.id);
        effects.push({ kind: 'nearPark', amount: ADJACENCY.parkHomeGrowthBonus });
      }
    } else if (building.type === 'shop') {
      const homes = Math.min(ADJACENCY.shopMaxHouses, neighbours.filter((n) => n.type === 'house').length);
      if (homes > 0) {
        bonus += homes * ADJACENCY.shopPerHouseBonus;
        effects.push({ kind: 'nearHomes', amount: homes * ADJACENCY.shopPerHouseBonus });
      }
    } else if (building.type === 'factory' && neighbours.some((n) => n.type === 'powerPlant')) {
      bonus += ADJACENCY.factoryNearPowerBonus;
      effects.push({ kind: 'nearPower', amount: ADJACENCY.factoryNearPowerBonus });
    }

    // Anything that earns gold does better on a street.
    if (output.goldPerSecond > 0 && neighbours.some((n) => n.type === 'road')) {
      bonus += ADJACENCY.roadGoldBonus;
      effects.push({ kind: 'nearRoad', amount: ADJACENCY.roadGoldBonus });
    }

    let efficiency = 1;
    const demand = output.powerDemand * era.powerDemandMultiplier;
    if (demand > 0) {
      const powered = POWER.minEfficiency + (1 - POWER.minEfficiency) * powerRatio;
      if (powered < 1) effects.push({ kind: 'unpowered', amount: 1 - powered });
      efficiency *= powered;
    }
    if (output.jobs > 0) {
      const staffed = STAFFING.minEfficiency + (1 - STAFFING.minEfficiency) * staffing;
      if (staffed < 1) effects.push({ kind: 'understaffed', amount: 1 - staffed });
      efficiency *= staffed;
    }

    const gold = output.goldPerSecond * (1 + bonus) * efficiency * era.outputMultiplier;
    const points = output.research * efficiency * (1 + research.research);
    buildingGold += gold;
    researchPerSecond += points;
    buildings.set(building.id, {
      goldPerSecond: gold,
      researchPerSecond: points,
      powerSupply: output.powerSupply * (1 + research.power),
      powerDemand: demand,
      efficiency,
      effects,
    });
  }

  // Pollution spreads from polluting buildings into nearby homes.
  const pollution = new Map<number, number>();
  const pollutionMultiplier = Math.max(0, 1 + research.pollution);
  for (const building of state.buildings) {
    const emitted = outputs.get(building.id)!.pollution * pollutionMultiplier;
    if (emitted <= 0) continue;
    for (const neighbour of around(building, POLLUTION.radius)) {
      if (neighbour.type === 'house') pollution.set(neighbour.id, (pollution.get(neighbour.id) ?? 0) + emitted);
    }
  }
  for (const [houseId, amount] of pollution) {
    buildings.get(houseId)!.effects.push({ kind: 'polluted', amount });
  }

  const taxPerSecond = people * ECONOMY.taxPerCitizenPerSecond * era.outputMultiplier;
  return {
    buildings,
    goldPerSecond: buildingGold + taxPerSecond,
    taxPerSecond,
    researchPerSecond,
    populationCapacity,
    jobs,
    powerSupply,
    powerDemand,
    powerRatio,
    staffing,
    happinessBonus: Math.min(buildingHappiness, HAPPINESS.maxBuildingBonus) + research.happiness,
    growthMultiplier: houses > 0 ? 1 + (ADJACENCY.parkHomeGrowthBonus * parkHomes.size) / houses : 1,
    parkHomes,
    pollution,
  };
}
