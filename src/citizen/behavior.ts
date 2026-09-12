import type { Building } from '../building/types';
import { BUILDINGS, CITIZENS, HAPPINESS } from '../config/balance';
import { getSpeedMultiplier } from '../economy/happiness';
import type { GameState } from '../simulation/gameState';
import { nextRandom, randomRange } from '../simulation/random';
import { findWalkPath } from './path';
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
      if (walkRoute(state, citizen, workplace.col, workplace.row, workplace.col + 0.5, workplace.row + 0.5, dt)) {
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
      if (walkRoute(state, citizen, spot.col, spot.row, x, y, dt)) {
        citizen.activity = 'leisure';
        citizen.timer = randomRange(state, CITIZENS.leisureSeconds);
      }
      break;
    }

    case 'toHome': {
      const home = buildings.get(citizen.homeId);
      // A missing home is fixed by syncCitizens on the next tick; wait in place until then.
      if (home && walkRoute(state, citizen, home.col, home.row, home.col + 0.5, home.row + 0.5, dt)) {
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

/**
 * Walks the citizen along a route to the destination tile, stepping from tile to tile so they
 * keep off the carriageway and cross at crossings. Without a route (a home ringed by roads,
 * say) they walk straight there rather than standing still forever.
 */
function walkRoute(
  state: GameState,
  citizen: Citizen,
  targetCol: number,
  targetRow: number,
  exactX: number,
  exactY: number,
  dt: number,
): boolean {
  const planned = citizen.pathTo;
  if (!citizen.path || !planned || planned.col !== targetCol || planned.row !== targetRow) {
    const from = { col: Math.floor(citizen.x), row: Math.floor(citizen.y) };
    const route = findWalkPath(state, from, { col: targetCol, row: targetRow });
    citizen.path = route ?? [];
    citizen.pathTo = { col: targetCol, row: targetRow };
  }

  const next = citizen.path[0];
  if (!next) {
    const arrived = walkTowards(citizen, exactX, exactY, dt);
    if (arrived) clearRoute(citizen);
    return arrived;
  }

  // The last tile is the destination itself, where the exact spot matters.
  const last = citizen.path.length === 1;
  if (walkTowards(citizen, last ? exactX : next.col + 0.5, last ? exactY : next.row + 0.5, dt)) {
    citizen.path.shift();
    if (citizen.path.length === 0) {
      clearRoute(citizen);
      return true;
    }
  }
  return false;
}

function clearRoute(citizen: Citizen): void {
  citizen.path = undefined;
  citizen.pathTo = undefined;
}

/** Forgets every planned route, e.g. after the streets changed. */
export function clearRoutes(state: GameState): void {
  for (const citizen of state.citizens) clearRoute(citizen);
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
