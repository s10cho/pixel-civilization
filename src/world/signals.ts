import { SIGNALS } from '../config/balance';
import { DAY_NIGHT } from '../config/gameConfig';

/**
 * Traffic signals. A junction runs a three-step cycle: east-west traffic goes, then
 * north-south, then everyone stops and people cross. A zebra crossing away from a junction
 * runs a simpler two-step one: traffic goes, then people cross.
 *
 * The phase comes from the city's own clock, so the simulation (people waiting) and the view
 * (cars waiting, lamps lit) always agree.
 */
export type SignalState = 'eastWest' | 'northSouth' | 'walk';

const CYCLE = SIGNALS.carPhaseSeconds * 2 + SIGNALS.walkPhaseSeconds;

/** What the lights at this junction are showing. Junctions are offset so they don't all match. */
export function signalAt(timeOfDay: number, col: number, row: number): SignalState {
  const seconds = timeOfDay * DAY_NIGHT.daySeconds + ((col * 7 + row * 13) % 3) * SIGNALS.offsetSeconds;
  const phase = ((seconds % CYCLE) + CYCLE) % CYCLE;
  if (phase < SIGNALS.carPhaseSeconds) return 'eastWest';
  if (phase < SIGNALS.carPhaseSeconds * 2) return 'northSouth';
  return 'walk';
}

/** Whether traffic running along this axis may enter the junction. */
export function carsMayPass(signal: SignalState, axis: 'x' | 'z'): boolean {
  return axis === 'x' ? signal === 'eastWest' : signal === 'northSouth';
}

/** Whether people may step into the junction. */
export function peopleMayCross(signal: SignalState): boolean {
  return signal === 'walk';
}

/** What a mid-block pedestrian crossing is showing: traffic's turn, or the walk signal. */
export type CrossingSignal = 'cars' | 'walk';

const CROSSING_CYCLE = SIGNALS.crossingCarSeconds + SIGNALS.crossingWalkSeconds;

/**
 * What the pedestrian lights at this crossing are showing. A wide road's crossing covers
 * several tiles, so the phase follows the road's own axis: every lane of one crossing agrees.
 */
export function crossingSignalAt(
  timeOfDay: number,
  col: number,
  row: number,
  axis: 'x' | 'z',
): CrossingSignal {
  const along = axis === 'x' ? col : row;
  // Neighbouring crossings sit a third of a cycle apart, so a street never turns green as one.
  const seconds = timeOfDay * DAY_NIGHT.daySeconds + ((along % 3) * CROSSING_CYCLE) / 3;
  const phase = ((seconds % CROSSING_CYCLE) + CROSSING_CYCLE) % CROSSING_CYCLE;
  return phase < SIGNALS.crossingCarSeconds ? 'cars' : 'walk';
}

/** What holds people up on a tile: junction lights, or a crossing's own lights. */
export type TileControl = { kind: 'junction' } | { kind: 'crossing'; axis: 'x' | 'z' };

/** Whether people may step onto a controlled tile. */
export function peopleMayStep(control: TileControl, timeOfDay: number, col: number, row: number): boolean {
  return control.kind === 'junction'
    ? peopleMayCross(signalAt(timeOfDay, col, row))
    : crossingSignalAt(timeOfDay, col, row, control.axis) === 'walk';
}
