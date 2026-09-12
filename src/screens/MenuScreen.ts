import { t } from '../i18n';
import { deleteSlot, listSlots, loadSlot, type LoadedSave } from '../storage/saveStore';
import { MainMenuUI } from '../ui/MainMenuUI';
import type { Screen } from './Screen';

export interface MenuScreenHandlers {
  /** Opens a city in `slot`: a loaded save, or a new city when `save` is null. */
  onStart(slot: number, save: LoadedSave | null): void;
  onSettings?(): void;
  onCredits?(): void;
}

/** Title screen: reads the save slots and starts or resumes a city. */
export class MenuScreen implements Screen {
  private ui: MainMenuUI | null = null;

  constructor(
    private readonly uiRoot: HTMLElement,
    private readonly handlers: MenuScreenHandlers,
  ) {}

  mount(): void {
    this.ui = new MainMenuUI(this.uiRoot, {
      onContinue: (slot) => this.load(slot),
      onLoad: (slot) => this.load(slot),
      onNewGame: (slot) => this.handlers.onStart(slot, null),
      onDelete: (slot) => {
        deleteSlot(slot)
          .then(() => this.refresh())
          .catch(() => this.ui?.showNotice(t('menu.deleteFailed')));
      },
      onSettings: this.handlers.onSettings,
      onCredits: this.handlers.onCredits,
    });
    this.refresh();
  }

  /** Rebuilds the menu in the current language. */
  rebuildUI(): void {
    if (!this.ui) return;
    this.ui.destroy();
    this.ui = null;
    this.mount();
  }

  unmount(): void {
    this.ui?.destroy();
    this.ui = null;
  }

  private refresh(): void {
    listSlots()
      .then((slots) => this.ui?.update({ slots, notice: null }))
      .catch(() => this.ui?.update({ slots: [null, null, null], notice: t('menu.storageUnavailable') }));
  }

  private load(slot: number): void {
    loadSlot(slot)
      .then((save) => {
        if (save) this.handlers.onStart(slot, save);
        else this.refresh();
      })
      .catch((error: unknown) =>
        this.ui?.showNotice(t('menu.loadFailed', { error: error instanceof Error ? error.message : '?' })),
      );
  }
}
