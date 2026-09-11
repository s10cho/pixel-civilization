import type { GameState } from './gameState';

/**
 * Deterministic PRNG (mulberry32) whose state lives in the game state, so simulation runs are
 * reproducible and survive save/load.
 */
export function nextRandom(state: GameState): number {
  let t = (state.rngState = (state.rngState + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomRange(state: GameState, range: readonly [number, number]): number {
  return range[0] + (range[1] - range[0]) * nextRandom(state);
}
