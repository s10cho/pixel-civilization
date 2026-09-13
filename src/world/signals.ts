import { SIGNALS } from '../config/balance';
import { DAY_NIGHT } from '../config/gameConfig';

/**
 * Traffic signals at junctions: east-west traffic goes, then north-south, then everyone stops
 * and people cross. Mid-block zebra crossings have no lights — there, cars give way.
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
