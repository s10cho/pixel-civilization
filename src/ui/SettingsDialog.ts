import { audio } from '../audio/AudioEngine';
import { loadPreferences, savePreferences, type Preferences } from '../storage/preferences';
import { el } from './dom';
import { Modal } from './Modal';

const QUALITY_OPTIONS: readonly [Preferences['quality'], string][] = [
  ['auto', 'Auto (adapts to your device)'],
  ['high', 'High'],
  ['medium', 'Medium'],
  ['low', 'Low'],
];

export interface SettingsOptions {
  /** Called when the graphics quality setting changes (a running city applies it live). */
  onQualityChange?(quality: Preferences['quality']): void;
  onClose?(): void;
}

/** Volume sliders and graphics quality; every change is saved immediately. */
export function openSettings(root: HTMLElement, options: SettingsOptions = {}): Modal {
  const preferences = loadPreferences();
  const volumes = { music: preferences.musicVolume, sfx: preferences.sfxVolume };
  const applyVolumes = (): void => {
    audio.setVolumes(volumes.music, volumes.sfx);
    savePreferences({ musicVolume: volumes.music, sfxVolume: volumes.sfx });
  };

  const body = el('div', 'settings');
  body.append(
    slider('Music', volumes.music, (value) => {
      volumes.music = value;
      applyVolumes();
    }),
    slider(
      'Sound effects',
      volumes.sfx,
      (value) => {
        volumes.sfx = value;
        applyVolumes();
      },
      // A sample of the new level when the slider is released.
      () => audio.play('place'),
    ),
  );

  const qualityRow = el('label', 'settings-row');
  const select = el('select', 'settings-select');
  for (const [value, label] of QUALITY_OPTIONS) {
    const option = el('option', '', label);
    option.value = value;
    option.selected = value === preferences.quality;
    select.append(option);
  }
  select.addEventListener('change', () => {
    const quality = select.value as Preferences['quality'];
    savePreferences({ quality });
    options.onQualityChange?.(quality);
  });
  qualityRow.append(el('span', 'settings-label', 'Graphics'), select);
  body.append(qualityRow, el('p', 'modal-note', 'Anti-aliasing changes apply the next time a city opens.'));

  return new Modal(root, {
    title: 'Settings',
    icon: 'settings',
    body,
    actions: [{ label: 'Done', variant: 'primary' }],
    onClose: options.onClose,
  });
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
