import { t } from '../i18n';
import { button, el, setText } from './dom';

export interface TutorialView {
  step: number;
  total: number;
  title: string;
  text: string;
  /** The step waits for "Next" rather than a player action. */
  canContinue: boolean;
}

/** The current tutorial tip, docked above the build bar. */
export class TutorialCard {
  readonly element = el('div', 'tutorial-card panel');
  private readonly counter = el('div', 'tutorial-step');
  private readonly title = el('div', 'tutorial-title');
  private readonly text = el('div', 'tutorial-text');
  private readonly nextButton: HTMLButtonElement;

  constructor(onNext: () => void, onSkip: () => void) {
    this.element.setAttribute('role', 'status');
    this.nextButton = button({ label: t('tutorial.next'), variant: 'primary', onClick: onNext });
    const actions = el('div', 'tutorial-actions');
    actions.append(button({ label: t('tutorial.skip'), className: 'btn-link', onClick: onSkip }), this.nextButton);
    this.element.append(this.counter, this.title, this.text, actions);
    this.element.hidden = true;
  }

  update(view: TutorialView | null): void {
    this.element.hidden = view === null;
    if (!view) return;
    setText(this.counter, t('tutorial.counter', { step: view.step, total: view.total }));
    setText(this.title, view.title);
    setText(this.text, view.text);
    this.nextButton.hidden = !view.canContinue;
    setText(this.nextButton.querySelector('.btn-label')!, t(view.step === view.total ? 'tutorial.letsGo' : 'tutorial.next'));
  }
}
