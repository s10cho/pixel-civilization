import { buildingName, canUpgradeFurther, getBuildingOutput, getUpgradeCost } from '../building/rules';
import type { Building } from '../building/types';
import type { Occupancy } from '../citizen/occupancy';
import { BUILDINGS } from '../config/balance';
import type { BuildingReport } from '../economy/cityReport';
import type { EraId } from '../progression/era';
import { button, el, setText } from './dom';
import { formatAmount, formatRate } from './format';
import { BUILDING_ICONS, icon, type IconName } from './icons';
import { BUILDING_DESCRIPTIONS, effectText } from './messages';

export interface BuildingPanelHandlers {
  onUpgrade(buildingId: number): void;
  onMove(buildingId: number): void;
  onAdvanceEra(): void;
  onClose(): void;
}

/** Era status: requirements for the next one and whether the city may advance. */
export interface EraInfo {
  current: string;
  /** Name of the next era, or null in the final era. */
  next: string | null;
  requirements: { text: string; met: boolean }[];
  ready: boolean;
}

/** City status shown on the Town Hall's card. */
export interface CityInfo {
  level: number;
  xp: number;
  /** XP needed for the next level, or null at max level. */
  xpToNext: number | null;
  /** Names of buildings the next level unlocks. */
  nextUnlocks: string[];
  era: EraInfo;
}

export interface BuildingPanelView {
  building: Building | null;
  city: CityInfo | null;
  occupancy: Occupancy | null;
  report: BuildingReport | null;
  era: EraId;
  gold: number;
  /** Whether this building is currently being relocated. */
  moving: boolean;
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

/** Card for the selected building: output, effects, occupancy, upgrade and move. */
export class BuildingPanel {
  readonly element = el('section', 'panel building-panel');
  private readonly badge = el('div', 'panel-badge');
  private readonly title = el('h2', 'panel-title');
  private readonly level = el('div', 'panel-subtitle');
  private readonly description = el('p', 'panel-text');
  private readonly stats = {
    gold: statRow('coins', 'stat-gold'),
    capacity: statRow('home', 'stat-pop'),
    jobs: statRow('store', 'stat-jobs'),
    happiness: statRow('smile', 'stat-happy'),
    power: statRow('zap', 'stat-power'),
    efficiency: statRow('gauge', 'stat-efficiency'),
    occupancy: statRow('users', 'stat-pop'),
  };
  private readonly statList = el('ul', 'panel-stats');
  private readonly city = el('div', 'panel-city');
  private readonly cityLevel = el('strong');
  private readonly cityXp = el('span', 'panel-city-xp');
  private readonly cityXpFill = el('div', 'progress-fill is-xp');
  private readonly cityNote = el('div', 'panel-city-note');
  private readonly era = el('div', 'panel-era');
  private readonly eraTitle = el('strong');
  private readonly eraNext = el('div', 'panel-city-note');
  private readonly eraRequirements = el('ul', 'era-requirements');
  private readonly advanceButton: HTMLButtonElement;
  private readonly advanceLabel: HTMLElement;
  private renderedRequirements = '';
  private readonly effects = el('ul', 'panel-effects');
  private readonly actions = el('div', 'panel-actions');
  private readonly upgradeButton: HTMLButtonElement;
  private readonly upgradeCost = el('span', 'btn-cost');
  private readonly moveButton: HTMLButtonElement;
  private readonly moveLabel: HTMLElement;
  private renderedEffects = '';
  private buildingId: number | null = null;
  private badgeType: string | null = null;

  constructor(handlers: BuildingPanelHandlers) {
    const heading = el('div', 'panel-heading');
    heading.append(this.title, this.level);
    const header = el('header', 'panel-header');
    header.append(
      this.badge,
      heading,
      button({ icon: 'close', ariaLabel: 'Close', className: 'btn-icon close-button', onClick: handlers.onClose }),
    );

    this.upgradeButton = button({
      icon: 'arrowUp',
      label: 'Upgrade',
      variant: 'success',
      className: 'upgrade-button',
      onClick: () => {
        if (this.buildingId !== null) handlers.onUpgrade(this.buildingId);
      },
    });
    this.upgradeButton.append(this.upgradeCost);

    this.moveButton = button({
      icon: 'move',
      label: 'Move',
      className: 'move-button',
      onClick: () => {
        if (this.buildingId !== null) handlers.onMove(this.buildingId);
      },
    });
    this.moveLabel = this.moveButton.querySelector('.btn-label')!;
    this.actions.append(this.upgradeButton, this.moveButton);

    this.statList.append(...Object.values(this.stats).map((stat) => stat.row));

    const cityTitle = el('div', 'panel-city-title');
    cityTitle.append(this.cityLevel, this.cityXp);
    const xpTrack = el('div', 'progress');
    xpTrack.append(this.cityXpFill);
    this.advanceButton = button({
      icon: 'sparkles',
      label: 'Advance',
      variant: 'primary',
      className: 'advance-era-button',
      onClick: handlers.onAdvanceEra,
    });
    this.advanceLabel = this.advanceButton.querySelector('.btn-label')!;
    this.era.append(this.eraTitle, this.eraNext, this.eraRequirements, this.advanceButton);
    this.city.append(cityTitle, xpTrack, this.cityNote, this.era);

    this.element.append(header, this.description, this.city, this.statList, this.effects, this.actions);
    this.element.hidden = true;
  }

  update(view: BuildingPanelView): void {
    const { building, report } = view;
    this.element.hidden = building === null;
    this.buildingId = building?.id ?? null;
    if (!building) return;

    const definition = BUILDINGS[building.type];
    const output = getBuildingOutput(building);
    if (this.badgeType !== building.type) {
      this.badge.replaceChildren(icon(BUILDING_ICONS[building.type]));
      this.badgeType = building.type;
    }
    setText(this.title, buildingName(building.type, view.era));
    setText(this.level, `Level ${building.level} of ${definition.maxLevel}`);
    setText(this.description, BUILDING_DESCRIPTIONS[building.type]);

    this.city.hidden = view.city === null;
    if (view.city) {
      const { level, xp, xpToNext, nextUnlocks } = view.city;
      setText(this.cityLevel, `City level ${level}`);
      setText(this.cityXp, xpToNext === null ? 'Max level' : `${formatAmount(xp)} / ${formatAmount(xpToNext)} XP`);
      this.cityXpFill.style.width = xpToNext === null ? '100%' : `${Math.min(100, (xp / xpToNext) * 100)}%`;
      this.cityNote.hidden = nextUnlocks.length === 0;
      setText(this.cityNote, `Next level unlocks: ${nextUnlocks.join(', ')}`);
      this.updateEra(view.city.era);
    }

    const gold = report?.goldPerSecond ?? output.goldPerSecond;
    const happinessSign = output.happinessBonus > 0 ? '+' : '';
    const powerSupply = report?.powerSupply ?? output.powerSupply;
    const powerDemand = report?.powerDemand ?? output.powerDemand;
    showStat(this.stats.gold, gold > 0, `+${formatRate(gold)} gold/s`);
    showStat(this.stats.capacity, output.populationCapacity > 0, `Houses ${output.populationCapacity}`);
    showStat(this.stats.jobs, output.jobs > 0, `${output.jobs} jobs`);
    showStat(
      this.stats.happiness,
      output.happinessBonus !== 0,
      `${happinessSign}${formatRate(output.happinessBonus)} happiness`,
    );
    showStat(
      this.stats.power,
      powerSupply > 0 || powerDemand > 0,
      powerSupply > 0 ? `+${formatRate(powerSupply)} power` : `Uses ${formatRate(powerDemand)} power`,
    );
    const efficiency = report?.efficiency ?? 1;
    showStat(this.stats.efficiency, efficiency < 1, `Working at ${Math.round(efficiency * 100)}%`);
    showStat(
      this.stats.occupancy,
      view.occupancy !== null,
      view.occupancy
        ? `${view.occupancy.kind === 'residents' ? 'Residents' : 'Workers'} ${view.occupancy.count} / ${view.occupancy.capacity}`
        : '',
    );
    // Buildings without any output (e.g. the Town Hall) get no empty stats box.
    this.statList.hidden = Object.values(this.stats).every((stat) => stat.row.hidden);

    const effectTexts = (report?.effects ?? []).map(effectText);
    const signature = effectTexts.join('|');
    if (signature !== this.renderedEffects) {
      this.renderedEffects = signature;
      this.effects.replaceChildren(...effectTexts.map((text) => el('li', undefined, text)));
    }
    this.effects.hidden = effectTexts.length === 0;

    this.upgradeButton.hidden = definition.maxLevel <= 1;
    if (canUpgradeFurther(building)) {
      const cost = getUpgradeCost(building, view.era);
      setText(this.upgradeCost, `${formatAmount(cost)}g`);
      this.upgradeCost.hidden = false;
      this.upgradeCost.classList.toggle('is-unaffordable', view.gold < cost);
      this.upgradeButton.disabled = false;
    } else {
      this.upgradeCost.hidden = true;
      this.upgradeButton.disabled = true;
    }

    this.moveButton.hidden = !definition.movable;
    this.moveButton.classList.toggle('btn-primary', view.moving);
    setText(this.moveLabel, view.moving ? 'Cancel move' : 'Move');
    this.actions.hidden = this.upgradeButton.hidden && this.moveButton.hidden;
  }

  private updateEra(era: EraInfo): void {
    setText(this.eraTitle, `${era.current} Era`);
    this.eraNext.hidden = false;
    setText(
      this.eraNext,
      era.next ? `To enter the ${era.next} Era:` : 'Your civilization has reached the latest era.',
    );
    const signature = era.requirements.map((r) => `${r.met}:${r.text}`).join('|');
    if (signature !== this.renderedRequirements) {
      this.renderedRequirements = signature;
      this.eraRequirements.replaceChildren(
        ...era.requirements.map((requirement) => {
          const item = el('li', requirement.met ? 'is-met' : undefined, requirement.text);
          return item;
        }),
      );
    }
    this.eraRequirements.hidden = era.requirements.length === 0;
    this.advanceButton.hidden = era.next === null;
    this.advanceButton.disabled = !era.ready;
    if (era.next) setText(this.advanceLabel, `Enter the ${era.next} Era`);
  }
}
