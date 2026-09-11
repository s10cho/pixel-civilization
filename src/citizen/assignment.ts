import { getBuildingOutput } from '../building/rules';
import type { Building } from '../building/types';
import { CITIZENS } from '../config/balance';
import type { GameState } from '../simulation/gameState';
import { randomRange } from '../simulation/random';
import type { Citizen } from './types';

interface Slot {
  building: Building;
  capacity: number;
  assigned: number;
}

/**
 * Keeps simulated citizens consistent with the city: one citizen per whole person up to the cap,
 * every citizen housed, and the employed share matching jobs / population.
 */
export function syncCitizens(state: GameState): void {
  const homes: Slot[] = [];
  const workplaces: Slot[] = [];
  for (const building of state.buildings) {
    const output = getBuildingOutput(building);
    if (output.populationCapacity > 0) homes.push({ building, capacity: output.populationCapacity, assigned: 0 });
    if (output.jobs > 0) workplaces.push({ building, capacity: output.jobs, assigned: 0 });
  }

  const people = Math.floor(state.resources.population);
  const target = homes.length > 0 ? Math.min(people, CITIZENS.maxSimulated) : 0;
  if (state.citizens.length > target) state.citizens.length = target;

  syncHomes(state, homes, target);
  syncJobs(state, workplaces, people);
}

function syncHomes(state: GameState, homes: Slot[], target: number): void {
  const byId = new Map(homes.map((slot) => [slot.building.id, slot]));
  const homeless: Citizen[] = [];

  for (const citizen of state.citizens) {
    const slot = byId.get(citizen.homeId);
    if (slot) slot.assigned++;
    else homeless.push(citizen);
  }

  for (const citizen of homeless) {
    const slot = leastLoaded(homes);
    if (!slot) break;
    slot.assigned++;
    citizen.homeId = slot.building.id;
    // Their old home is gone; they reappear inside the new one.
    moveInside(citizen, slot.building);
    citizen.activity = 'atHome';
    citizen.leisureId = null;
  }

  while (state.citizens.length < target) {
    const slot = leastLoaded(homes);
    if (!slot) break;
    slot.assigned++;
    state.citizens.push(spawnCitizen(state, slot.building));
  }
}

function syncJobs(state: GameState, workplaces: Slot[], people: number): void {
  const byId = new Map(workplaces.map((slot) => [slot.building.id, slot]));
  const totalJobs = workplaces.reduce((sum, slot) => sum + slot.capacity, 0);
  const employmentRate = people > 0 ? Math.min(1, totalJobs / people) : 0;
  const employedTarget = Math.round(state.citizens.length * employmentRate);

  const employed: Citizen[] = [];
  for (const citizen of state.citizens) {
    if (citizen.workplaceId === null) continue;
    const slot = byId.get(citizen.workplaceId);
    if (slot) {
      slot.assigned++;
      employed.push(citizen);
    } else {
      citizen.workplaceId = null;
    }
  }

  while (employed.length > employedTarget) {
    const citizen = employed.pop()!;
    byId.get(citizen.workplaceId!)!.assigned--;
    citizen.workplaceId = null;
  }

  for (const citizen of state.citizens) {
    if (employed.length >= employedTarget) break;
    if (citizen.workplaceId !== null) continue;
    const slot = leastLoaded(workplaces);
    if (!slot) break;
    slot.assigned++;
    citizen.workplaceId = slot.building.id;
    employed.push(citizen);
  }
}

/** The slot with the lowest assigned/capacity ratio, so citizens spread proportionally. */
function leastLoaded(slots: Slot[]): Slot | undefined {
  let best: Slot | undefined;
  for (const slot of slots) {
    if (!best || slot.assigned / slot.capacity < best.assigned / best.capacity) best = slot;
  }
  return best;
}

function spawnCitizen(state: GameState, home: Building): Citizen {
  const citizen: Citizen = {
    id: state.nextCitizenId++,
    homeId: home.id,
    workplaceId: null,
    leisureId: null,
    leisureOffsetX: 0,
    leisureOffsetY: 0,
    // Newcomers start at the city's current mood.
    happiness: state.resources.happiness,
    leisureBoost: 0,
    activity: 'atHome',
    x: 0,
    y: 0,
    // Staggered first departure so new citizens don't all leave at once.
    timer: randomRange(state, CITIZENS.homeRestSeconds),
  };
  moveInside(citizen, home);
  return citizen;
}

function moveInside(citizen: Citizen, building: Building): void {
  citizen.x = building.col + 0.5;
  citizen.y = building.row + 0.5;
}
