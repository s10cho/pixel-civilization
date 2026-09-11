/** What a citizen is doing. `to*` activities are walks; the others are stays at a building. */
export type CitizenActivity = 'atHome' | 'toWork' | 'working' | 'toLeisure' | 'leisure' | 'toHome';

/**
 * A simulated citizen. Each one stands in for a share of the population: the number of
 * simulated citizens is capped (see CITIZENS.maxSimulated) while population can grow far beyond.
 */
export interface Citizen {
  id: number;
  homeId: number;
  workplaceId: number | null;
  /** Leisure destination (e.g. a park) while heading to or staying at it. */
  leisureId: number | null;
  /** Where on the leisure tile the citizen stands, relative to its centre (tile units). */
  leisureOffsetX: number;
  leisureOffsetY: number;
  happiness: number;
  /** Temporary happiness from a recent leisure visit; decays over time. */
  leisureBoost: number;
  activity: CitizenActivity;
  /** Position in tile units; a tile's centre is (col + 0.5, row + 0.5). */
  x: number;
  y: number;
  /** Seconds left in the current stay activity (atHome / working / leisure). */
  timer: number;
}
