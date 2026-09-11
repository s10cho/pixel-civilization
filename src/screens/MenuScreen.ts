import { MainMenuUI, type MainMenuHandlers } from '../ui/MainMenuUI';
import type { Screen } from './Screen';

/** Title screen. */
export class MenuScreen implements Screen {
  private ui: MainMenuUI | null = null;

  constructor(
    private readonly uiRoot: HTMLElement,
    private readonly handlers: MainMenuHandlers,
  ) {}

  mount(): void {
    this.ui = new MainMenuUI(this.uiRoot, this.handlers);
  }

  unmount(): void {
    this.ui?.destroy();
    this.ui = null;
  }
}
