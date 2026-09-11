import { button, el } from './dom';
import { icon } from './icons';

export interface MainMenuHandlers {
  onNewGame(): void;
}

/** Title screen overlay. Only "New Game" is wired up; the rest arrive with later milestones. */
export class MainMenuUI {
  private readonly element = el('div', 'main-menu');

  constructor(root: HTMLElement, handlers: MainMenuHandlers) {
    const buttons = el('div', 'main-menu-buttons');
    buttons.append(
      button({ label: 'Continue', disabled: true }),
      button({ label: 'New Game', variant: 'primary', onClick: handlers.onNewGame }),
      button({ label: 'Settings', disabled: true }),
      button({ label: 'Credits', disabled: true }),
    );

    this.element.append(
      icon('building', 'main-menu-logo'),
      el('h1', 'main-menu-title', 'Pixel Civilization'),
      el('p', 'main-menu-subtitle', 'Build a tiny settlement into a great civilization'),
      buttons,
    );
    root.append(this.element);
  }

  destroy(): void {
    this.element.remove();
  }
}
