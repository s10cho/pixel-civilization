import { BUILDABLE_TYPES, type UnlockState } from '../building/rules';
import type { BuildingType } from '../building/types';
import { t } from '../i18n';
import { button, el, setText } from './dom';
import { formatAmount } from './format';
import { BUILDING_ICONS } from './icons';

/** What the build menu shows for one building type in the current era. */
export interface BuildOption {
  type: BuildingType;
  name: string;
  cost: number;
  unlock: UnlockState;
  requiredLevel: number;
  /** Recently unlocked: the button pulses to draw attention. */
  isNew: boolean;
}

interface Entry {
  node: HTMLButtonElement;
  label: HTMLElement;
  cost: HTMLElement;
  lock: HTMLElement;
}

/**
 * Build menu: one toggle button per buildable type with its era name and cost. Types waiting
 * for a city level show the level they need; types from a later era stay hidden.
 */
export class BuildBar {
  readonly element = el('div', 'build-bar');
  private readonly entries = new Map<BuildingType, Entry>();

  constructor(onSelect: (type: BuildingType) => void) {
    for (const type of BUILDABLE_TYPES) {
      const node = button({ icon: BUILDING_ICONS[type], label: '', onClick: () => onSelect(type) });
      const cost = el('span', 'btn-cost');
      const lock = el('span', 'btn-lock');
      node.append(cost, lock);
      node.dataset.building = type;
      this.entries.set(type, { node, label: node.querySelector('.btn-label')!, cost, lock });
      this.element.append(node);
    }
  }

  update(options: readonly BuildOption[], activeTool: BuildingType | null, gold: number): void {
    for (const option of options) {
      const entry = this.entries.get(option.type);
      if (!entry) continue;
      const locked = option.unlock === 'needsLevel';
      entry.node.hidden = option.unlock === 'needsEra';
      entry.node.disabled = locked;
      entry.node.classList.toggle('btn-primary', option.type === activeTool);
      entry.node.classList.toggle('is-new', option.isNew && !locked);
      entry.node.setAttribute('aria-pressed', String(option.type === activeTool));
      setText(entry.label, option.name);
      entry.cost.hidden = locked;
      setText(entry.cost, t('format.gold', { amount: formatAmount(option.cost) }));
      entry.cost.classList.toggle('is-unaffordable', gold < option.cost);
      entry.lock.hidden = !locked;
      setText(entry.lock, t('build.lockLevel', { level: option.requiredLevel }));
    }
  }
}
