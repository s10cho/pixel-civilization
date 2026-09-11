import { deleteSlot, listSlots, loadSlot, type LoadedSave } from '../storage/saveStore';
import { MainMenuUI } from '../ui/MainMenuUI';
import type { Screen } from './Screen';

export interface MenuScreenHandlers {
  /** Opens a city in `slot`: a loaded save, or a new city when `save` is null. */
  onStart(slot: number, save: LoadedSave | null): void;
  onSettings?(): void;
  onCredits?(): void;
}

const STORAGE_UNAVAILABLE = 'Saving is unavailable in this browser, so progress will not be kept.';

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
          .catch(() => this.ui?.showNotice('Could not delete the save.'));
      },
      onSettings: this.handlers.onSettings,
      onCredits: this.handlers.onCredits,
    });
    this.refresh();
  }

  unmount(): void {
    this.ui?.destroy();
    this.ui = null;
  }

  private refresh(): void {
    listSlots()
      .then((slots) => this.ui?.update({ slots, notice: null }))
      .catch(() => this.ui?.update({ slots: [null, null, null], notice: STORAGE_UNAVAILABLE }));
  }

  private load(slot: number): void {
    loadSlot(slot)
      .then((save) => {
        if (save) this.handlers.onStart(slot, save);
        else this.refresh();
      })
      .catch((error: unknown) =>
        this.ui?.showNotice(`This save could not be loaded: ${error instanceof Error ? error.message : 'unknown error'}.`),
      );
  }
}
