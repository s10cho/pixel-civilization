import { audio } from '../audio/AudioEngine';
import type { AutoLevel, GrowthPace } from '../config/balance';
import { LOCALE_NAMES, LOCALES, resolveLocale, setLocale, t, type LocalePreference, type MessageKey } from '../i18n';
import { loadPreferences, savePreferences, type Preferences } from '../storage/preferences';
import { el } from './dom';
import { Modal } from './Modal';

const QUALITY_OPTIONS: readonly [Preferences['quality'], MessageKey][] = [
  ['auto', 'settings.quality.auto'],
  ['high', 'settings.quality.high'],
  ['medium', 'settings.quality.medium'],
  ['low', 'settings.quality.low'],
];

const PACE_OPTIONS: readonly [GrowthPace, MessageKey][] = [
  ['relaxed', 'settings.pace.relaxed'],
  ['standard', 'settings.pace.standard'],
  ['fast', 'settings.pace.fast'],
];

const AUTO_OPTIONS: readonly [AutoLevel, MessageKey][] = [
  ['off', 'settings.auto.off'],
  ['low', 'settings.auto.low'],
  ['medium', 'settings.auto.medium'],
  ['high', 'settings.auto.high'],
];

export interface SettingsOptions {
  /** Called when the graphics quality setting changes (a running city applies it live). */
  onQualityChange?(quality: Preferences['quality']): void;
  /** Called when the growth pace or automation level changes. */
  onPaceChange?(): void;
  onClose?(): void;
}

/**
 * Volume sliders, language and graphics quality; every change is saved immediately. Changing
 * the language reopens the dialog in the new language (the rest of the UI rebuilds itself).
 */
export function openSettings(root: HTMLElement, options: SettingsOptions = {}): Modal {
  const preferences = loadPreferences();
  const volumes = { music: preferences.musicVolume, sfx: preferences.sfxVolume };
  const applyVolumes = (): void => {
    audio.setVolumes(volumes.music, volumes.sfx);
    savePreferences({ musicVolume: volumes.music, sfxVolume: volumes.sfx });
  };

  const body = el('div', 'settings');
  body.append(
    slider(t('settings.music'), volumes.music, (value) => {
      volumes.music = value;
      applyVolumes();
    }),
    slider(
      t('settings.sfx'),
      volumes.sfx,
      (value) => {
        volumes.sfx = value;
        applyVolumes();
      },
      // A sample of the new level when the slider is released.
      () => audio.play('place'),
    ),
  );

  const languageOptions: [LocalePreference, string][] = [
    ['auto', t('settings.language.auto')],
    ...LOCALES.map((locale): [LocalePreference, string] => [locale, LOCALE_NAMES[locale]]),
  ];
  body.append(
    select(
      t('settings.pace'),
      PACE_OPTIONS.map(([value, key]): [GrowthPace, string] => [value, t(key)]),
      preferences.growthPace,
      (value) => {
        savePreferences({ growthPace: value });
        options.onPaceChange?.();
      },
    ),
    select(
      t('settings.autoLevel'),
      AUTO_OPTIONS.map(([value, key]): [AutoLevel, string] => [value, t(key)]),
      preferences.autoLevel,
      (value) => {
        savePreferences({ autoLevel: value });
        options.onPaceChange?.();
      },
    ),
    el('p', 'modal-note', t('settings.paceNote')),
    select(t('settings.language'), languageOptions, preferences.locale, (value) => {
      savePreferences({ locale: value });
      setLocale(resolveLocale(value));
      // Reopen so this dialog is in the new language too.
      modal.close();
      modal = openSettings(root, options);
    }),
    select(
      t('settings.graphics'),
      QUALITY_OPTIONS.map(([value, key]): [Preferences['quality'], string] => [value, t(key)]),
      preferences.quality,
      (value) => {
        savePreferences({ quality: value });
        options.onQualityChange?.(value);
      },
    ),
    el('p', 'modal-note', t('settings.note')),
  );

  let modal = new Modal(root, {
    title: t('settings.title'),
    icon: 'settings',
    body,
    actions: [{ label: t('settings.done'), variant: 'primary' }],
    onClose: () => options.onClose?.(),
  });
  return modal;
}

function slider(label: string, value: number, onInput: (value: number) => void, onCommit?: () => void): HTMLElement {
  const row = el('label', 'settings-row');
  const input = el('input', 'settings-range');
  input.type = 'range';
  input.min = '0';
  input.max = '100';
  input.step = '5';
  input.value = String(Math.round(value * 100));
  const output = el('span', 'settings-value', `${input.value}%`);
  input.addEventListener('input', () => {
    output.textContent = `${input.value}%`;
    onInput(Number(input.value) / 100);
  });
  if (onCommit) input.addEventListener('change', onCommit);
  row.append(el('span', 'settings-label', label), input, output);
  return row;
}

function select<T extends string>(
  label: string,
  options: readonly [T, string][],
  selected: T,
  onChange: (value: T) => void,
): HTMLElement {
  const row = el('label', 'settings-row');
  const node = el('select', 'settings-select');
  for (const [value, text] of options) {
    const option = el('option', '', text);
    option.value = value;
    option.selected = value === selected;
    node.append(option);
  }
  node.addEventListener('change', () => onChange(node.value as T));
  row.append(el('span', 'settings-label', label), node);
  return row;
}
