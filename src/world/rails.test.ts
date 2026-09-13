import { describe, expect, it } from 'vitest';
import { packRailVariant, railLaneWith, unpackRailVariant, type IsRailAt } from './rails';

/** A little network from a list of "col,row" tiles. */
const network = (...tiles: string[]): IsRailAt => {
  const set = new Set(tiles);
  return (col, row) => set.has(`${col},${row}`);
};

describe('reading a railway tile', () => {
  it('points a straight run the way the line runs', () => {
    const line = network('1,5', '2,5', '3,5', '4,5');
    expect(railLaneWith(line, 2, 5)).toMatchObject({ axis: 'x', buffer: false });
    const down = network('5,1', '5,2', '5,3');
    expect(railLaneWith(down, 5, 2)).toMatchObject({ axis: 'z', buffer: false });
  });

  it('bends where the line turns', () => {
    // Comes in from the west, leaves to the south.
    const bend = network('1,5', '2,5', '2,6', '2,7');
    expect(railLaneWith(bend, 2, 5).corner).toBe('southWest');
  });

  it('lays both directions where two lines cross', () => {
    const cross = network('2,4', '2,5', '2,6', '1,5', '3,5');
    expect(railLaneWith(cross, 2, 5).axis).toBe('crossing');
  });

  it('closes the end of a line with a buffer', () => {
    const line = network('1,5', '2,5', '3,5');
    expect(railLaneWith(line, 1, 5).buffer).toBe(true);
    expect(railLaneWith(line, 2, 5).buffer).toBe(false);
    expect(railLaneWith(line, 3, 5).buffer).toBe(true);
  });

  it('survives the trip through a packed variant', () => {
    const bend = network('1,5', '2,5', '2,6', '2,7');
    for (const [col, row] of [
      [2, 5],
      [1, 5],
      [2, 6],
    ]) {
      const lane = railLaneWith(bend, col, row);
      expect(unpackRailVariant(packRailVariant(lane))).toEqual(lane);
    }
  });
});
