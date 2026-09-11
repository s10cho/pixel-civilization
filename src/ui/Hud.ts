import { getMood } from '../economy/happiness';
import type { Resources } from '../simulation/gameState';
import { el, setText } from './dom';
import { formatAmount } from './format';
import { icon, type IconName } from './icons';

const RESOURCES: readonly { key: keyof Resources; label: string; icon: IconName }[] = [
  { key: 'gold', label: 'Gold', icon: 'coins' },
  { key: 'population', label: 'Population', icon: 'users' },
  { key: 'power', label: 'Power', icon: 'zap' },
  { key: 'happiness', label: 'Happiness', icon: 'smile' },
];

/** Always-visible top bar with the four core resources. */
export class Hud {
  readonly element = el('div', 'hud');
  private readonly chips = new Map<keyof Resources, { chip: HTMLElement; value: HTMLElement }>();

  constructor() {
    for (const resource of RESOURCES) {
      const chip = el('div', 'hud-resource');
      chip.dataset.resource = resource.key;
      chip.title = resource.label;
      const value = el('span', 'hud-value', '0');
      chip.append(icon(resource.icon), el('span', 'sr-only', resource.label), value);
      this.chips.set(resource.key, { chip, value });
      this.element.append(chip);
    }
  }

  update(resources: Resources): void {
    for (const [key, { value }] of this.chips) setText(value, formatAmount(resources[key]));
    // The happiness icon changes colour with the city's mood.
    this.chips.get('happiness')!.chip.dataset.mood = getMood(resources.happiness);
  }
}
