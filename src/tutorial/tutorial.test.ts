import { describe, expect, it } from 'vitest';
import { Tutorial, TUTORIAL_STEPS } from './tutorial';

describe('Tutorial', () => {
  it('advances on the expected actions only', () => {
    const tutorial = new Tutorial();
    expect(tutorial.notify({ kind: 'placed', type: 'house' })).toBe(false);
    expect(tutorial.notify({ kind: 'toolSelected', type: 'house' })).toBe(true);
    expect(tutorial.notify({ kind: 'placed', type: 'house' })).toBe(true);
    expect(tutorial.notify({ kind: 'placed', type: 'shop' })).toBe(true);
    expect(tutorial.notify({ kind: 'selected', type: 'townHall' })).toBe(true);
    // The last step waits for "Next".
    expect(tutorial.stepNumber).toBe(TUTORIAL_STEPS.length);
    tutorial.next();
    expect(tutorial.finished).toBe(true);
  });
});
