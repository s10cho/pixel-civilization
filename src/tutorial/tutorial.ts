import { buildingName } from '../building/rules';
import type { BuildingType } from '../building/types';

/** Player actions the tutorial listens for. */
export type TutorialEvent = { kind: 'toolSelected' | 'placed' | 'selected'; type: BuildingType };

export interface TutorialStep {
  title: string;
  text: string;
  /** The step completes when this matches an event; steps without it wait for "Next". */
  completes?(event: TutorialEvent): boolean;
}

const name = (type: BuildingType): string => buildingName(type, 'ancient');

/** First-time guidance: build a home, give it work, find the city's goals. */
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    title: 'Welcome, chief!',
    text: `Your people need homes. Pick the ${name('house')} in the build dock below.`,
    completes: (e) => e.kind === 'toolSelected' && e.type === 'house',
  },
  {
    title: `Place the ${name('house')}`,
    text: 'Tap a free green tile. Citizens move in, walk to work and pay taxes.',
    completes: (e) => e.kind === 'placed' && e.type === 'house',
  },
  {
    title: 'Give them work',
    text: `Build a ${name('shop')}: it employs citizens and earns gold, more so next to homes.`,
    completes: (e) => e.kind === 'placed' && e.type === 'shop',
  },
  {
    title: `Your ${name('townHall')}`,
    text: `Tap the ${name('townHall')} to see your city level and what the next era needs.`,
    completes: (e) => e.kind === 'selected' && e.type === 'townHall',
  },
  {
    title: "You're all set",
    text: 'Level up to unlock parks, power and research. Expand when you run out of room. Your city keeps working while you are away, for up to 8 hours.',
  },
];

/** Progress through the tutorial steps. */
export class Tutorial {
  private index = 0;

  get step(): TutorialStep | null {
    return TUTORIAL_STEPS[this.index] ?? null;
  }

  get stepNumber(): number {
    return this.index + 1;
  }

  get finished(): boolean {
    return this.index >= TUTORIAL_STEPS.length;
  }

  /** Returns true if the event completed the current step. */
  notify(event: TutorialEvent): boolean {
    if (!this.step?.completes?.(event)) return false;
    this.index++;
    return true;
  }

  /** "Next" on a step that waits for the player. */
  next(): void {
    if (this.step && !this.step.completes) this.index++;
  }
}
