import { getMood } from '../economy/happiness';
import { t, type MessageKey } from '../i18n';
import type { Resources } from '../simulation/gameState';
import { el, setText } from './dom';
import { formatAmount } from './format';
import { icon, type IconName } from './icons';

const RESOURCES: readonly { key: keyof Resources; label: MessageKey; icon: IconName }[] = [
  { key: 'gold', label: 'hud.gold', icon: 'coins' },
  { key: 'population', label: 'hud.population', icon: 'users' },
  { key: 'power', label: 'hud.power', icon: 'zap' },
  { key: 'happiness', label: 'hud.happiness', icon: 'smile' },
];

/** Always-visible top bar with the four core resources. */
export class Hud {
  readonly element = el('div', 'hud');
  private readonly chips = new Map<keyof Resources, { chip: HTMLElement; value: HTMLElement }>();

  constructor() {
    for (const resource of RESOURCES) {
      const chip = el('div', 'hud-resource');
      chip.dataset.resource = resource.key;
      const label = t(resource.label);
      chip.title = label;
      const value = el('span', 'hud-value', '0');
      chip.append(icon(resource.icon), el('span', 'sr-only', label), value);
      this.chips.set(resource.key, { chip, value });
      this.element.append(chip);
    }
  }

  update(resources: Resources): void {
    for (const [key, { value }] of this.chips) {
      setText(value, key === 'power' ? formatSigned(resources.power) : formatAmount(resources[key]));
    }
    this.chips.get('power')!.chip.dataset.state = resources.power < 0 ? 'shortage' : 'ok';
    // The happiness icon changes colour with the city's mood.
    this.chips.get('happiness')!.chip.dataset.mood = getMood(resources.happiness);
  }
}

function formatSigned(value: number): string {
  const rounded = Math.round(value);
  return rounded > 0 ? `+${formatAmount(rounded)}` : formatAmount(rounded);
}
