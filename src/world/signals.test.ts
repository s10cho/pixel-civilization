import { describe, expect, it } from 'vitest';
import { SIGNALS } from '../config/balance';
import { DAY_NIGHT } from '../config/gameConfig';
import { carsMayPass, peopleMayCross, signalAt } from './signals';

/** Time of day for a number of seconds into the city's clock. */
const at = (seconds: number): number => seconds / DAY_NIGHT.daySeconds;

describe('traffic signals', () => {
  it('gives each direction its turn, then lets people cross', () => {
    const seen = new Set<string>();
    for (let second = 0; second < SIGNALS.carPhaseSeconds * 2 + SIGNALS.walkPhaseSeconds; second++) {
      seen.add(signalAt(at(second), 0, 0));
    }
    expect([...seen].sort()).toEqual(['eastWest', 'northSouth', 'walk']);
  });

  it('never lets both directions through at once, nor cars while people cross', () => {
    for (let second = 0; second < 120; second++) {
      const signal = signalAt(at(second), 3, 5);
      expect(carsMayPass(signal, 'x') && carsMayPass(signal, 'z')).toBe(false);
      if (peopleMayCross(signal)) {
        expect(carsMayPass(signal, 'x')).toBe(false);
        expect(carsMayPass(signal, 'z')).toBe(false);
      }
    }
  });

  it('does not switch every junction at the same moment', () => {
    const states = new Set([signalAt(at(0), 0, 0), signalAt(at(0), 1, 0), signalAt(at(0), 2, 0)]);
    expect(states.size).toBeGreaterThan(1);
  });
});
