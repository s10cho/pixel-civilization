import { canUpgradeFurther, getBuildingOutput, getUpgradeCost } from '../building/rules';
import type { Building } from '../building/types';
import type { Occupancy } from '../citizen/occupancy';
import { BUILDINGS } from '../config/balance';
import { button, el, setDisabled, setText } from './dom';
import { formatAmount, formatRate } from './format';
import { icon, type IconName } from './icons';
import { BUILDING_DESCRIPTIONS } from './messages';

export interface BuildingPanelHandlers {
  onUpgrade(buildingId: number): void;
  onClose(): void;
}

interface StatRow {
  row: HTMLLIElement;
  text: HTMLSpanElement;
}

function statRow(iconName: IconName, className: string): StatRow {
  const row = el('li', className);
  const text = el('span');
  row.append(icon(iconName), text);
  return { row, text };
}

function showStat(stat: StatRow, visible: boolean, text: string): void {
  stat.row.hidden = !visible;
  if (visible) setText(stat.text, text);
}

/** Details for the selected building: name, level, output, occupancy and the upgrade action. */
export class BuildingPanel {
  readonly element = el('section', 'nes-container is-dark with-title panel building-panel');
  private readonly title = el('p', 'title');
  private readonly level = el('div', 'panel-level');
  private readonly description = el('p', 'panel-text');
  private readonly stats = {
    gold: statRow('coins', 'stat-gold'),
    capacity: statRow('home', 'stat-pop'),
    jobs: statRow('store', 'stat-jobs'),
    happiness: statRow('smile', 'stat-happy'),
    occupancy: statRow('users', 'stat-pop'),
  };
  private readonly upgradeButton: HTMLButtonElement;
  private readonly upgradeLabel: HTMLElement;
  private readonly upgradeCost = el('span', 'btn-cost');
  private buildingId: number | null = null;

  constructor(handlers: BuildingPanelHandlers) {
    const closeButton = button({
      icon: 'close',
      ariaLabel: 'Close',
      className: 'close-button',
      onClick: handlers.onClose,
    });

    this.upgradeButton = button({
      icon: 'arrowUp',
      label: 'Upgrade',
      variant: 'success',
      className: 'upgrade-button',
      onClick: () => {
        if (this.buildingId !== null) handlers.onUpgrade(this.buildingId);
      },
    });
    this.upgradeLabel = this.upgradeButton.querySelector('.btn-label')!;
    this.upgradeButton.append(this.upgradeCost);

    const statList = el('ul', 'panel-stats');
    statList.append(...Object.values(this.stats).map((stat) => stat.row));

    // NES.css expects the `.title` element first inside a `.with-title` container.
    this.element.append(
      this.title,
      closeButton,
      this.level,
      this.description,
      statList,
      this.upgradeButton,
    );
    this.element.hidden = true;
  }

  update(building: Building | null, occupancy: Occupancy | null, gold: number): void {
    this.element.hidden = building === null;
    this.buildingId = building?.id ?? null;
    if (!building) return;

    const definition = BUILDINGS[building.type];
    const output = getBuildingOutput(building);
    setText(this.title, definition.name);
    setText(this.level, `Lv ${building.level} / ${definition.maxLevel}`);
    setText(this.description, BUILDING_DESCRIPTIONS[building.type]);

    const happinessSign = output.happinessBonus > 0 ? '+' : '';
    showStat(this.stats.gold, output.goldPerSecond > 0, `+${formatRate(output.goldPerSecond)} gold/s`);
    showStat(this.stats.capacity, output.populationCapacity > 0, `Houses ${output.populationCapacity}`);
    showStat(this.stats.jobs, output.jobs > 0, `${output.jobs} jobs`);
    showStat(
      this.stats.happiness,
      output.happinessBonus !== 0,
      `${happinessSign}${formatRate(output.happinessBonus)} happiness`,
    );
    showStat(
      this.stats.occupancy,
      occupancy !== null,
      occupancy
        ? `${occupancy.kind === 'residents' ? 'Residents' : 'Workers'} ${occupancy.count} / ${occupancy.capacity}`
        : '',
    );

    this.upgradeButton.hidden = definition.maxLevel <= 1;
    if (canUpgradeFurther(building)) {
      const cost = getUpgradeCost(building);
      setText(this.upgradeLabel, `Upgrade to Lv ${building.level + 1}`);
      setText(this.upgradeCost, `${formatAmount(cost)}g`);
      this.upgradeCost.hidden = false;
      this.upgradeCost.classList.toggle('is-unaffordable', gold < cost);
      setDisabled(this.upgradeButton, false);
    } else {
      setText(this.upgradeLabel, 'Max level');
      this.upgradeCost.hidden = true;
      setDisabled(this.upgradeButton, true);
    }
  }
}
