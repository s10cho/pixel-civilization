import { audio } from './audio/AudioEngine';
import { onLocaleChange, resolveLocale, setLocale } from './i18n';
import { CityScreen } from './screens/CityScreen';
import { MenuScreen } from './screens/MenuScreen';
import type { Screen } from './screens/Screen';
import { loadPreferences } from './storage/preferences';
import type { LoadedSave } from './storage/saveStore';
import { openCredits } from './ui/CreditsDialog';
import { getUiRoot } from './ui/dom';
import { openSettings } from './ui/SettingsDialog';
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
  audio.playMusic('ancient');
  show(
    new MenuScreen(uiRoot, {
      onStart: showCity,
      onSettings: () => openSettings(uiRoot),
      onCredits: () => openCredits(uiRoot),
    }),
  );
}

function showCity(slot: number, save: LoadedSave | null): void {
  show(new CityScreen(viewRoot!, uiRoot, { onExit: showMenu }, { slot, save }));
}

setLocale(resolveLocale(loadPreferences().locale));
// A language change rebuilds the current screen's UI in place.
onLocaleChange(() => current?.rebuildUI?.());

// Browsers allow audio only after a user gesture; any press unlocks (or resumes) it.
for (const type of ['pointerdown', 'keydown'] as const) {
  window.addEventListener(type, () => audio.unlock(), { capture: true });
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
