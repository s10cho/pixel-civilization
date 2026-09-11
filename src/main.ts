import { CityScreen } from './screens/CityScreen';
import { MenuScreen } from './screens/MenuScreen';
import type { Screen } from './screens/Screen';
import { getUiRoot } from './ui/dom';
import './ui/ui.css';

const viewRoot = document.getElementById('game');
if (!viewRoot) throw new Error('Missing #game view root in index.html');
const uiRoot = getUiRoot();

let current: Screen | null = null;

function show(next: Screen): void {
  current?.unmount();
  current = next;
  next.mount();
}

function showMenu(): void {
  show(new MenuScreen(uiRoot, { onNewGame: showCity }));
}

function showCity(): void {
  show(new CityScreen(viewRoot!, uiRoot, { onExit: showMenu }));
}

showMenu();

// Expose the active screen in development for browser-side debugging and verification.
if (import.meta.env.DEV) {
  (window as unknown as { __PIXEL_CIV__: object }).__PIXEL_CIV__ = {
    get screen() {
      return current;
    },
  };
}
