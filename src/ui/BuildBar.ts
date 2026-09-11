import { BUILDABLE_TYPES } from '../building/rules';
import type { BuildingType } from '../building/types';
import { BUILDINGS } from '../config/balance';
import { button, el } from './dom';
import { formatAmount } from './format';

/** Build menu: one toggle button per buildable type, labelled with its cost. */
export class BuildBar {
  readonly element = el('div', 'build-bar');
  private readonly buttons = new Map<BuildingType, HTMLButtonElement>();

  constructor(onSelect: (type: BuildingType) => void) {
    for (const type of BUILDABLE_TYPES) {
      const definition = BUILDINGS[type];
      const node = button(`${definition.name} ${formatAmount(definition.buildCost)}g`, () => onSelect(type));
      node.dataset.building = type;
      this.buttons.set(type, node);
      this.element.append(node);
    }
  }

  update(activeTool: BuildingType | null, gold: number): void {
    for (const [type, node] of this.buttons) {
      const active = type === activeTool;
      node.classList.toggle('active', active);
      node.classList.toggle('unaffordable', gold < BUILDINGS[type].buildCost);
      node.setAttribute('aria-pressed', String(active));
    }
  }
}
