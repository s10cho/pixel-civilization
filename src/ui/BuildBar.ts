import { BUILDABLE_TYPES } from '../building/rules';
import type { BuildingType } from '../building/types';
import { BUILDINGS } from '../config/balance';
import { button, el } from './dom';
import { formatAmount } from './format';
import { BUILDING_ICONS } from './icons';

/** Build menu: one toggle button per buildable type, with its icon and cost. */
export class BuildBar {
  readonly element = el('div', 'build-bar');
  private readonly buttons = new Map<BuildingType, { node: HTMLButtonElement; cost: HTMLElement }>();

  constructor(onSelect: (type: BuildingType) => void) {
    for (const type of BUILDABLE_TYPES) {
      const definition = BUILDINGS[type];
      const node = button({
        icon: BUILDING_ICONS[type],
        label: definition.name,
        onClick: () => onSelect(type),
      });
      const cost = el('span', 'btn-cost', `${formatAmount(definition.buildCost)}g`);
      node.append(cost);
      node.dataset.building = type;
      this.buttons.set(type, { node, cost });
      this.element.append(node);
    }
  }

  update(activeTool: BuildingType | null, gold: number): void {
    for (const [type, { node, cost }] of this.buttons) {
      const active = type === activeTool;
      node.classList.toggle('btn-primary', active);
      node.setAttribute('aria-pressed', String(active));
      cost.classList.toggle('is-unaffordable', gold < BUILDINGS[type].buildCost);
    }
  }
}
