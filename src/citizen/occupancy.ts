import { getBuildingOutput } from '../building/rules';
import type { Building } from '../building/types';
import type { GameState } from '../simulation/gameState';

export interface Occupancy {
  kind: 'residents' | 'workers';
  count: number;
  capacity: number;
}

/**
 * How many people (not simulated citizens) live or work in a building. Population is spread over
 * homes by capacity, and employed people over workplaces by jobs.
 */
export function getOccupancy(state: GameState, building: Building): Occupancy | null {
  const output = getBuildingOutput(building);
  const people = Math.floor(state.resources.population);

  let totalCapacity = 0;
  let totalJobs = 0;
  for (const other of state.buildings) {
    const otherOutput = getBuildingOutput(other);
    totalCapacity += otherOutput.populationCapacity;
    totalJobs += otherOutput.jobs;
  }

  if (output.populationCapacity > 0) {
    return {
      kind: 'residents',
      count: Math.round((people * output.populationCapacity) / totalCapacity),
      capacity: output.populationCapacity,
    };
  }
  if (output.jobs > 0) {
    const employed = Math.min(people, totalJobs);
    return {
      kind: 'workers',
      count: Math.round((employed * output.jobs) / totalJobs),
      capacity: output.jobs,
    };
  }
  return null;
}
