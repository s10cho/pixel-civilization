import type { BuildingType } from '../building/types';

/** Player actions the tutorial listens for. */
export type TutorialEvent = { kind: 'toolSelected' | 'placed' | 'selected'; type: BuildingType };

export interface TutorialStep {
  /** Message keys; the text is resolved when shown, so it follows the chosen language. */
  titleKey: string;
  textKey: string;
  /** The step completes when this matches an event; steps without it wait for "Next". */
  completes?(event: TutorialEvent): boolean;
}

/** First-time guidance: build a home, give it work, find the city's goals. */
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    titleKey: 'tutorial.1.title',
    textKey: 'tutorial.1.text',
    completes: (e) => e.kind === 'toolSelected' && e.type === 'house',
  },
  {
    titleKey: 'tutorial.2.title',
    textKey: 'tutorial.2.text',
    completes: (e) => e.kind === 'placed' && e.type === 'house',
  },
  {
    titleKey: 'tutorial.3.title',
    textKey: 'tutorial.3.text',
    completes: (e) => e.kind === 'placed' && e.type === 'shop',
  },
  {
    titleKey: 'tutorial.4.title',
    textKey: 'tutorial.4.text',
    completes: (e) => e.kind === 'selected' && e.type === 'townHall',
  },
  { titleKey: 'tutorial.5.title', textKey: 'tutorial.5.text' },
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
