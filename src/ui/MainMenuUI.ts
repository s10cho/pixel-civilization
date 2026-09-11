import { ERA_SETTINGS } from '../config/balance';
import type { SlotInfo } from '../storage/saveStore';
import { button, el } from './dom';
import { formatAgo, formatAmount } from './format';
import { icon } from './icons';

export interface MainMenuHandlers {
  onContinue(slot: number): void;
  onNewGame(slot: number): void;
  onLoad(slot: number): void;
  onDelete(slot: number): void;
  onSettings?(): void;
  onCredits?(): void;
}

export interface MainMenuView {
  /** One entry per slot (null = empty); null while the saves are still being read. */
  slots: readonly (SlotInfo | null)[] | null;
  /** Shown when saving is unavailable. */
  notice: string | null;
}

type Mode = 'main' | 'new' | 'load';

/** Title screen: continue, start a city in a slot, load or delete one, settings, credits. */
export class MainMenuUI {
  private readonly element = el('div', 'main-menu');
  private readonly content = el('div', 'main-menu-content');
  private mode: Mode = 'main';
  /** A slot waiting for "overwrite" / "delete" confirmation. */
  private confirming: number | null = null;
  private view: MainMenuView = { slots: null, notice: null };

  constructor(
    root: HTMLElement,
    private readonly handlers: MainMenuHandlers,
  ) {
    this.element.append(
      icon('building', 'main-menu-logo'),
      el('h1', 'main-menu-title', 'Pixel Civilization'),
      el('p', 'main-menu-subtitle', 'Build a tiny settlement into a great civilization'),
      this.content,
    );
    root.append(this.element);
    this.render();
  }

  update(view: MainMenuView): void {
    this.view = view;
    this.confirming = null;
    this.render();
  }

  /** Brief error line under the menu (e.g. a save that failed to load). */
  showNotice(text: string): void {
    this.view = { ...this.view, notice: text };
    this.render();
  }

  destroy(): void {
    this.element.remove();
  }

  private setMode(mode: Mode): void {
    this.mode = mode;
    this.confirming = null;
    this.render();
  }

  private render(): void {
    this.content.replaceChildren(this.mode === 'main' ? this.renderMain() : this.renderSlots(this.mode));
    if (this.view.notice) this.content.append(el('p', 'main-menu-notice', this.view.notice));
  }

  private renderMain(): HTMLElement {
    const slots = this.view.slots ?? [];
    const saved = slots.filter((slot): slot is SlotInfo => slot !== null);
    const latest = saved.reduce<SlotInfo | null>((best, slot) => (!best || slot.savedAt > best.savedAt ? slot : best), null);

    const buttons = el('div', 'main-menu-buttons');
    const continueButton = button({
      icon: 'play',
      label: 'Continue',
      variant: latest ? 'primary' : undefined,
      disabled: !latest,
      onClick: () => latest && this.handlers.onContinue(latest.slot),
    });
    buttons.append(continueButton);
    if (latest) {
      buttons.append(el('p', 'main-menu-caption', `Slot ${latest.slot} · ${slotLine(latest)} · ${formatAgo(latest.savedAt)}`));
    }
    buttons.append(
      button({
        icon: 'plus',
        label: 'New Game',
        variant: latest ? undefined : 'primary',
        disabled: this.view.slots === null,
        onClick: () => this.setMode('new'),
      }),
      button({ icon: 'folder', label: 'Load Game', disabled: saved.length === 0, onClick: () => this.setMode('load') }),
      button({
        icon: 'settings',
        label: 'Settings',
        disabled: !this.handlers.onSettings,
        onClick: () => this.handlers.onSettings?.(),
      }),
      button({
        icon: 'info',
        label: 'Credits',
        disabled: !this.handlers.onCredits,
        onClick: () => this.handlers.onCredits?.(),
      }),
    );
    return buttons;
  }

  private renderSlots(mode: 'new' | 'load'): HTMLElement {
    const panel = el('div', 'slot-picker');
    panel.append(el('h2', 'slot-picker-title', mode === 'new' ? 'Choose a slot for your city' : 'Load a city'));
    const list = el('div', 'slot-list');
    (this.view.slots ?? []).forEach((info, index) => list.append(this.renderSlot(mode, index + 1, info)));
    panel.append(list, button({ icon: 'arrowLeft', label: 'Back', onClick: () => this.setMode('main') }));
    return panel;
  }

  private renderSlot(mode: 'new' | 'load', slot: number, info: SlotInfo | null): HTMLElement {
    const card = el('div', 'slot-card panel');
    card.dataset.slot = String(slot);
    const heading = el('div', 'slot-heading');
    heading.append(el('span', 'slot-number', `Slot ${slot}`));
    if (info) heading.append(el('span', 'slot-time', formatAgo(info.savedAt)));
    card.append(heading);

    if (!info) {
      card.classList.add('is-empty');
      card.append(el('div', 'slot-line', 'Empty slot'));
      if (mode === 'new') {
        card.append(button({ icon: 'plus', label: 'Start here', variant: 'primary', onClick: () => this.handlers.onNewGame(slot) }));
      }
      return card;
    }

    card.append(
      el('div', 'slot-era', `${ERA_SETTINGS[info.summary.era].name} Era`),
      el('div', 'slot-line', slotLine(info)),
    );
    const actions = el('div', 'slot-actions');
    if (this.confirming === slot) {
      card.classList.add('is-confirming');
      const deleting = mode === 'load';
      actions.append(
        el('span', 'slot-confirm', deleting ? 'Delete this city for good?' : 'Replace this city?'),
        button({ label: 'Cancel', onClick: () => this.confirm(null) }),
        button({
          label: deleting ? 'Delete' : 'Overwrite',
          variant: 'warning',
          onClick: () => (deleting ? this.handlers.onDelete(slot) : this.handlers.onNewGame(slot)),
        }),
      );
    } else if (mode === 'new') {
      actions.append(button({ label: 'Overwrite', onClick: () => this.confirm(slot) }));
    } else {
      actions.append(
        button({ icon: 'trash', ariaLabel: `Delete slot ${slot}`, className: 'btn-icon', onClick: () => this.confirm(slot) }),
        button({ icon: 'play', label: 'Load', variant: 'primary', onClick: () => this.handlers.onLoad(slot) }),
      );
    }
    card.append(actions);
    return card;
  }

  private confirm(slot: number | null): void {
    this.confirming = slot;
    this.render();
  }
}

function slotLine(info: SlotInfo): string {
  const { cityLevel, population, gold } = info.summary;
  return `Level ${cityLevel} · ${formatAmount(population)} citizens · ${formatAmount(gold)} gold`;
}
