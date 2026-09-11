import { POWER, PROBLEMS } from '../config/balance';
import type { GameState } from '../simulation/gameState';
import type { CityReport } from './cityReport';

export type ProblemKind = 'powerShortage' | 'lowHappiness' | 'pollution';

/**
 * A city problem lowers efficiency or growth but never ends the game; fixing the cause clears it
 * automatically on the next tick.
 */
export interface CityProblem {
  kind: ProblemKind;
  /** Tile the camera should show for this problem, if any. */
  focus: { col: number; row: number } | null;
  /** powerShortage: output lost (0..1); lowHappiness: city happiness; pollution: homes affected. */
  amount: number;
}

export function detectProblems(state: GameState, report: CityReport): CityProblem[] {
  const problems: CityProblem[] = [];
  const at = (id: number | undefined) => {
    const building = state.buildings.find((b) => b.id === id);
    return building ? { col: building.col, row: building.row } : null;
  };

  if (report.powerDemand > report.powerSupply) {
    const consumer = state.buildings.find((b) => (report.buildings.get(b.id)?.powerDemand ?? 0) > 0);
    problems.push({
      kind: 'powerShortage',
      focus: at(consumer?.id),
      amount: (1 - POWER.minEfficiency) * (1 - report.powerRatio),
    });
  }

  if (state.citizens.length > 0 && state.resources.happiness < PROBLEMS.lowHappinessBelow) {
    const hall = state.buildings.find((b) => b.type === 'townHall');
    problems.push({ kind: 'lowHappiness', focus: at(hall?.id), amount: state.resources.happiness });
  }

  if (report.pollution.size > 0) {
    let worst: number | undefined;
    for (const [houseId, amount] of report.pollution) {
      if (worst === undefined || amount > report.pollution.get(worst)!) worst = houseId;
    }
    problems.push({ kind: 'pollution', focus: at(worst), amount: report.pollution.size });
  }

  return problems;
}
