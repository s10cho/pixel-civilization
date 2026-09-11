import { canUpgradeFurther, getBuildingOutput, getUpgradeCost } from '../building/rules';
import type { Building } from '../building/types';
import { BUILDINGS } from '../config/balance';
import { button, el, setText } from './dom';
import { formatAmount, formatRate } from './format';
import { BUILDING_DESCRIPTIONS } from './messages';

export interface BuildingPanelHandlers {
  onUpgrade(buildingId: number): void;
  onClose(): void;
}

/** Details for the selected building: name, level, output and the upgrade action. */
export class BuildingPanel {
  readonly element = el('section', 'panel building-panel');
  private readonly title = el('h2', 'panel-title');
  private readonly level = el('div', 'panel-muted');
  private readonly description = el('p', 'panel-text');
  private readonly output = el('div', 'panel-text');
  private readonly upgradeButton: HTMLButtonElement;
  private buildingId: number | null = null;

  constructor(handlers: BuildingPanelHandlers) {
    const header = el('div', 'panel-header');
    header.append(this.title, button('Close', handlers.onClose, 'close-button'));

    this.upgradeButton = button('Upgrade', () => {
      if (this.buildingId !== null) handlers.onUpgrade(this.buildingId);
    });
    this.upgradeButton.classList.add('upgrade-button');

    this.element.append(header, this.level, this.description, this.output, this.upgradeButton);
    this.element.hidden = true;
  }

  update(building: Building | null, gold: number): void {
    this.element.hidden = building === null;
    this.buildingId = building?.id ?? null;
    if (!building) return;

    const definition = BUILDINGS[building.type];
    setText(this.title, definition.name);
    setText(this.level, `Level ${building.level} / ${definition.maxLevel}`);
    setText(this.description, BUILDING_DESCRIPTIONS[building.type]);
    setText(this.output, describeOutput(building));

    const upgradable = canUpgradeFurther(building);
    this.upgradeButton.hidden = definition.maxLevel <= 1;
    if (upgradable) {
      const cost = getUpgradeCost(building);
      setText(this.upgradeButton, `Upgrade to Lv ${building.level + 1} · ${formatAmount(cost)}g`);
      this.upgradeButton.disabled = false;
      this.upgradeButton.classList.toggle('unaffordable', gold < cost);
    } else {
      setText(this.upgradeButton, 'Max level');
      this.upgradeButton.disabled = true;
      this.upgradeButton.classList.remove('unaffordable');
    }
  }
}

function describeOutput(building: Building): string {
  const output = getBuildingOutput(building);
  const parts: string[] = [];
  if (output.goldPerSecond > 0) parts.push(`+${formatRate(output.goldPerSecond)} gold/s`);
  if (output.populationCapacity > 0) parts.push(`Houses ${output.populationCapacity} citizens`);
  return parts.join(' · ');
}
