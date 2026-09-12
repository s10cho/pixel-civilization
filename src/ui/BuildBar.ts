import { BUILDING_CATEGORIES, type BuildingCategory, type BuildingType } from '../building/types';
import { t, tKey } from '../i18n';
import { button, el, setText } from './dom';
import { formatAmount } from './format';
import { BUILDING_ICONS } from './icons';
import type { UnlockState } from '../building/rules';

/** What the build menu shows for one building type in the current era. */
export interface BuildOption {
  type: BuildingType;
  category: BuildingCategory;
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
 * Build menu: category tabs over a dock of buttons, one per buildable type in the chosen tab,
 * with its era name and cost. Types waiting for a city level show the level they need; types
 * from a later era stay hidden, and tabs with nothing to show hide themselves.
 */
export class BuildBar {
  readonly element = el('div', 'build-bar');
  private readonly tabsRow = el('div', 'build-tabs');
  private readonly dock = el('div', 'build-dock');
  private readonly tabs = new Map<BuildingCategory, HTMLButtonElement>();
  private readonly entries = new Map<BuildingType, Entry>();
  private activeTab: BuildingCategory | null = null;

  constructor(private readonly onSelect: (type: BuildingType) => void) {
    for (const category of BUILDING_CATEGORIES) {
      const tab = button({
        label: tKey(`category.${category}`),
        className: 'build-tab',
        onClick: () => {
          this.activeTab = category;
          this.render();
        },
      });
      tab.hidden = true;
      this.tabs.set(category, tab);
      this.tabsRow.append(tab);
    }
    this.element.append(this.tabsRow, this.dock);
  }

  update(options: readonly BuildOption[], activeTool: BuildingType | null, gold: number): void {
    this.activeTool = activeTool;
    this.gold = gold;

    // A tab appears once it holds something the player can see (built or level-locked).
    const shown = new Map<BuildingCategory, BuildOption[]>();
    for (const option of options) {
      if (option.unlock === 'needsEra') continue;
      const list = shown.get(option.category);
      if (list) list.push(option);
      else shown.set(option.category, [option]);
    }
    this.visible = shown;

    for (const [category, tab] of this.tabs) {
      const list = shown.get(category);
      tab.hidden = !list;
      if (list) tab.classList.toggle('has-new', list.some((option) => option.isNew));
    }
    // Keep the chosen tab if it still has anything, else fall back to the first one.
    if (!this.activeTab || !shown.has(this.activeTab)) {
      this.activeTab = [...BUILDING_CATEGORIES].find((category) => shown.has(category)) ?? null;
    }
    this.render();
  }

  private visible = new Map<BuildingCategory, BuildOption[]>();
  private activeTool: BuildingType | null = null;
  private gold = 0;

  private render(): void {
    for (const [category, tab] of this.tabs) {
      tab.classList.toggle('btn-primary', category === this.activeTab);
      tab.setAttribute('aria-pressed', String(category === this.activeTab));
    }

    const list = this.activeTab ? (this.visible.get(this.activeTab) ?? []) : [];
    this.dock.replaceChildren(...list.map((option) => this.entryFor(option).node));
    for (const option of list) this.updateEntry(option);
  }

  private entryFor(option: BuildOption): Entry {
    let entry = this.entries.get(option.type);
    if (entry) return entry;
    const node = button({ icon: BUILDING_ICONS[option.type], label: '', onClick: () => this.onSelect(option.type) });
    const cost = el('span', 'btn-cost');
    const lock = el('span', 'btn-lock');
    node.append(cost, lock);
    node.dataset.building = option.type;
    entry = { node, label: node.querySelector('.btn-label')!, cost, lock };
    this.entries.set(option.type, entry);
    return entry;
  }

  private updateEntry(option: BuildOption): void {
    const entry = this.entries.get(option.type);
    if (!entry) return;
    const locked = option.unlock === 'needsLevel';
    entry.node.disabled = locked;
    entry.node.classList.toggle('btn-primary', option.type === this.activeTool);
    entry.node.classList.toggle('is-new', option.isNew && !locked);
    entry.node.setAttribute('aria-pressed', String(option.type === this.activeTool));
    setText(entry.label, option.name);
    entry.cost.hidden = locked;
    setText(entry.cost, t('format.gold', { amount: formatAmount(option.cost) }));
    entry.cost.classList.toggle('is-unaffordable', this.gold < option.cost);
    entry.lock.hidden = !locked;
    setText(entry.lock, t('build.lockLevel', { level: option.requiredLevel }));
  }
}
