import { applyProduction } from '../economy/production';
import type { GameState } from './gameState';

/** Advances the whole simulation by one fixed step. */
export function tickSimulation(state: GameState, dtSeconds: number): void {
  applyProduction(state, dtSeconds);
}
