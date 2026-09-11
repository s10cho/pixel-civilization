import type { Resources } from '../simulation/gameState';
import { el } from './dom';
import { formatAmount } from './format';

const RESOURCE_LABELS: Record<keyof Resources, string> = {
  gold: 'Gold',
  population: 'Pop',
  power: 'Power',
  happiness: 'Happy',
};

/** Always-visible top bar with the four core resources. */
export class Hud {
  readonly element = el('div', 'hud');
  private readonly values = new Map<keyof Resources, HTMLElement>();

  constructor() {
    for (const key of Object.keys(RESOURCE_LABELS) as (keyof Resources)[]) {
      const chip = el('div', 'hud-resource');
      chip.dataset.resource = key;
      const value = el('span', 'hud-value', '0');
      chip.append(el('span', 'hud-label', RESOURCE_LABELS[key]), value);
      this.values.set(key, value);
      this.element.append(chip);
    }
  }

  update(resources: Resources): void {
    for (const [key, node] of this.values) {
      const text = formatAmount(resources[key]);
      if (node.textContent !== text) node.textContent = text;
    }
  }
}
