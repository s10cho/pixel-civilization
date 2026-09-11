import type { Building } from '../building/types';
import { BUILDINGS, CITIZENS, HAPPINESS } from '../config/balance';
import { getSpeedMultiplier } from '../economy/happiness';
import type { GameState } from '../simulation/gameState';
import { nextRandom, randomRange } from '../simulation/random';
import type { Citizen } from './types';

/** Whether the citizen is outside (visible) rather than inside a home or workplace. */
export function isCitizenOutside(citizen: Citizen): boolean {
  return citizen.activity !== 'atHome' && citizen.activity !== 'working';
}

/** Advances every citizen's daily routine: home -> work -> free time (leisure) -> home. */
export function updateCitizens(state: GameState, dtSeconds: number): void {
  const buildings = new Map(state.buildings.map((b) => [b.id, b]));
  const leisureSpots = state.buildings.filter((b) => BUILDINGS[b.type].leisureSpot);
  for (const citizen of state.citizens) {
    updateCitizen(state, citizen, buildings, leisureSpots, dtSeconds);
  }
}

function updateCitizen(
  state: GameState,
  citizen: Citizen,
  buildings: Map<number, Building>,
  leisureSpots: Building[],
  dt: number,
): void {
  switch (citizen.activity) {
    case 'atHome':
      citizen.timer -= dt;
      if (citizen.timer > 0) break;
      if (citizen.workplaceId !== null) citizen.activity = 'toWork';
      else if (!tryStartLeisure(state, citizen, leisureSpots)) {
        citizen.timer = randomRange(state, CITIZENS.homeRestSeconds);
      }
      break;

    case 'working':
      citizen.timer -= dt;
      if (citizen.workplaceId === null || citizen.timer <= 0) {
        // Free time after work: maybe a park, otherwise straight home.
        if (!tryStartLeisure(state, citizen, leisureSpots)) citizen.activity = 'toHome';
      }
      break;

    case 'leisure': {
      citizen.timer -= dt;
      const spotGone = citizen.leisureId === null || !buildings.has(citizen.leisureId);
      if (citizen.timer <= 0 || spotGone) {
        if (!spotGone) citizen.leisureBoost = HAPPINESS.leisureBoost;
        citizen.leisureId = null;
        citizen.activity = 'toHome';
      }
      break;
    }

    case 'toWork': {
      const workplace = citizen.workplaceId === null ? undefined : buildings.get(citizen.workplaceId);
      if (!workplace) {
        citizen.activity = 'toHome';
        break;
      }
      if (walkTowards(citizen, workplace.col + 0.5, workplace.row + 0.5, dt)) {
        citizen.activity = 'working';
        citizen.timer = randomRange(state, CITIZENS.workSeconds);
      }
      break;
    }

    case 'toLeisure': {
      const spot = citizen.leisureId === null ? undefined : buildings.get(citizen.leisureId);
      if (!spot) {
        citizen.leisureId = null;
        citizen.activity = 'toHome';
        break;
      }
      const x = spot.col + 0.5 + citizen.leisureOffsetX;
      const y = spot.row + 0.5 + citizen.leisureOffsetY;
      if (walkTowards(citizen, x, y, dt)) {
        citizen.activity = 'leisure';
        citizen.timer = randomRange(state, CITIZENS.leisureSeconds);
      }
      break;
    }

    case 'toHome': {
      const home = buildings.get(citizen.homeId);
      // A missing home is fixed by syncCitizens on the next tick; wait in place until then.
      if (home && walkTowards(citizen, home.col + 0.5, home.row + 0.5, dt)) {
        citizen.activity = 'atHome';
        citizen.timer = randomRange(state, CITIZENS.homeRestSeconds);
      }
      break;
    }
  }
}

/** Sends the citizen to a random leisure spot, with some probability. Returns true if sent. */
function tryStartLeisure(state: GameState, citizen: Citizen, spots: Building[]): boolean {
  if (spots.length === 0 || nextRandom(state) >= CITIZENS.leisureChance) return false;
  const spot = spots[Math.floor(nextRandom(state) * spots.length)];
  citizen.leisureId = spot.id;
  // Spread visitors over the tile so they don't stack on one pixel.
  citizen.leisureOffsetX = (nextRandom(state) * 2 - 1) * CITIZENS.leisureSpreadTiles;
  citizen.leisureOffsetY = (nextRandom(state) * 2 - 1) * CITIZENS.leisureSpreadTiles;
  citizen.activity = 'toLeisure';
  return true;
}

/** Moves the citizen towards (x, y) in tile units. Returns true on arrival. */
function walkTowards(citizen: Citizen, x: number, y: number, dt: number): boolean {
  const dx = x - citizen.x;
  const dy = y - citizen.y;
  const distance = Math.hypot(dx, dy);
  const step = CITIZENS.walkSpeedTilesPerSecond * getSpeedMultiplier(citizen.happiness) * dt;

  if (distance <= step) {
    citizen.x = x;
    citizen.y = y;
    return true;
  }
  citizen.x += (dx / distance) * step;
  citizen.y += (dy / distance) * step;
  return false;
}
