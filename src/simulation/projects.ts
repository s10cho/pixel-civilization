import type { BuildingType } from '../building/types';
import { GROWTH_PACE, PROGRESSION, PROJECTS, type ProjectKind } from '../config/balance';
import { gainXp } from '../progression/level';
import { eraIndex } from '../progression/era';
import { canBuildOn } from '../world/placement';
import { clearTile, isMountain } from '../world/terrain';
import { getUnlockedArea, isUnlocked } from '../world/territory';
import type { GameState } from './gameState';

export interface Project {
  id: number;
  kind: ProjectKind;
  /** Tiles the work covers; they show scaffolding until it is finished. */
  tiles: { col: number; row: number }[];
  /** Seconds of work done, out of `work`. */
  progress: number;
  work: number;
}

/** A project the city could commission, with the ground it would take. */
export interface ProjectPlan {
  kind: ProjectKind;
  tiles: { col: number; row: number }[];
  cost: number;
}

/** Whether the city is far enough along to commission this kind of work. */
export function isProjectUnlocked(state: GameState, kind: ProjectKind): boolean {
  const definition = PROJECTS[kind];
  return eraIndex(state.era) >= eraIndex(definition.era) && state.cityLevel >= definition.cityLevel;
}

/** Where a project would go, or null when there is no room for it. */
export function planProject(state: GameState, kind: ProjectKind): ProjectPlan | null {
  const tiles = kind === 'railway' ? planRailway(state) : kind === 'tunnel' ? planTunnel(state) : planCentralPark(state);
  if (tiles.length === 0) return null;
  return { kind, tiles, cost: PROJECTS[kind].cost };
}

/** A line across the city on the row or column with the most open ground. */
function planRailway(state: GameState): { col: number; row: number }[] {
  const area = getUnlockedArea(state);
  let best: { col: number; row: number }[] = [];
  for (let row = area.minRow; row <= area.maxRow; row++) {
    const line: { col: number; row: number }[] = [];
    for (let col = area.minCol; col <= area.maxCol; col++) {
      if (canBuildOn(state, col, row)) line.push({ col, row });
    }
    if (line.length > best.length) best = line;
  }
  for (let col = area.minCol; col <= area.maxCol; col++) {
    const line: { col: number; row: number }[] = [];
    for (let row = area.minRow; row <= area.maxRow; row++) {
      if (canBuildOn(state, col, row)) line.push({ col, row });
    }
    if (line.length > best.length) best = line;
  }
  return best.length >= 4 ? best : [];
}

/** The shortest run of rock leading out of the territory: a tunnel makes it passable. */
function planTunnel(state: GameState): { col: number; row: number }[] {
  const area = getUnlockedArea(state);
  let best: { col: number; row: number }[] = [];

  const scan = (start: { col: number; row: number }, step: { col: number; row: number }) => {
    const run: { col: number; row: number }[] = [];
    let col = start.col;
    let row = start.row;
    for (let i = 0; i < 8; i++) {
      col += step.col;
      row += step.row;
      if (!isMountain(state, col, row)) break;
      run.push({ col, row });
    }
    if (run.length > 0 && (best.length === 0 || run.length < best.length)) best = run;
  };

  for (let row = area.minRow; row <= area.maxRow; row++) {
    scan({ col: area.minCol, row }, { col: -1, row: 0 });
    scan({ col: area.maxCol, row }, { col: 1, row: 0 });
  }
  for (let col = area.minCol; col <= area.maxCol; col++) {
    scan({ col, row: area.minRow }, { col: 0, row: -1 });
    scan({ col, row: area.maxRow }, { col: 0, row: 1 });
  }
  return best;
}

/** A three-by-three block of open ground as close to the town hall as possible. */
function planCentralPark(state: GameState): { col: number; row: number }[] {
  const area = getUnlockedArea(state);
  const hall = state.buildings.find((building) => building.type === 'townHall');
  const centre = hall ?? { col: (area.minCol + area.maxCol) / 2, row: (area.minRow + area.maxRow) / 2 };
  let best: { col: number; row: number }[] = [];
  let bestDistance = Infinity;

  for (let row = area.minRow; row <= area.maxRow - 2; row++) {
    for (let col = area.minCol; col <= area.maxCol - 2; col++) {
      const block: { col: number; row: number }[] = [];
      for (let dRow = 0; dRow < 3; dRow++) {
        for (let dCol = 0; dCol < 3; dCol++) {
          if (canBuildOn(state, col + dCol, row + dRow)) block.push({ col: col + dCol, row: row + dRow });
        }
      }
      if (block.length < 9) continue;
      const distance = Math.hypot(col + 1 - centre.col, row + 1 - centre.row);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = block;
      }
    }
  }
  return best;
}

/** Commissions a project: the gold is paid now and the work starts. */
export function startProject(state: GameState, plan: ProjectPlan): boolean {
  if (!isProjectUnlocked(state, plan.kind)) return false;
  if (state.resources.gold < plan.cost) return false;
  state.resources.gold -= plan.cost;
  state.projects.push({
    id: state.nextProjectId++,
    kind: plan.kind,
    tiles: plan.tiles,
    progress: 0,
    work: PROJECTS[plan.kind].workSeconds,
  });
  return true;
}

/** Moves every project along and finishes the ones that are done, returning those. */
export function advanceProjects(state: GameState, dtSeconds: number): Project[] {
  if (state.projects.length === 0) return [];
  const speed = GROWTH_PACE[state.growthPace].output;
  const finished: Project[] = [];
  for (const project of state.projects) {
    project.progress += dtSeconds * speed;
    if (project.progress >= project.work) finished.push(project);
  }
  if (finished.length === 0) return [];
  state.projects = state.projects.filter((project) => !finished.includes(project));
  for (const project of finished) complete(state, project);
  return finished;
}

function complete(state: GameState, project: Project): void {
  switch (project.kind) {
    case 'railway':
      for (const tile of project.tiles) raise(state, 'railway', tile);
      break;
    case 'tunnel':
      for (const tile of project.tiles) {
        clearTile(state, tile.col, tile.row);
        // The tunnel mouth belongs to the city, so the road has somewhere to sit.
        if (!isUnlocked(state, tile.col, tile.row)) {
          state.territory.push({ minCol: tile.col, maxCol: tile.col, minRow: tile.row, maxRow: tile.row });
        }
        raise(state, 'road', tile);
      }
      break;
    case 'centralPark':
      for (const tile of project.tiles) raise(state, 'park', tile);
      break;
  }
}

/**
 * Puts up a building the project already paid for. This bypasses the build menu's rules on
 * purpose: railways are laid by the railway project, never by hand.
 */
function raise(state: GameState, type: BuildingType, tile: { col: number; row: number }): void {
  if (!canBuildOn(state, tile.col, tile.row)) return;
  state.buildings.push({
    id: state.nextBuildingId++,
    type,
    col: tile.col,
    row: tile.row,
    level: 1,
    builtEra: state.era,
  });
  gainXp(state, PROGRESSION.xp.build);
}
