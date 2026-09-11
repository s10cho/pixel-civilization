import { el } from './dom';
import { Modal } from './Modal';

const THIRD_PARTY = [
  { name: 'three.js', role: '3D rendering', license: 'MIT', file: 'licenses/three-LICENSE.txt' },
  { name: 'Lucide', role: 'Icons', license: 'ISC', file: 'licenses/lucide-static-LICENSE.txt' },
] as const;

/** Credits and third-party licenses. */
export function openCredits(root: HTMLElement): Modal {
  const body = el('div', 'credits');
  body.append(
    el('p', 'modal-text', 'Pixel Civilization: grow a tiny settlement through the Ancient, Medieval and Industrial eras.'),
    el('p', 'modal-text', 'Models, music and sound effects are generated in code: the 3D city from simple shapes, the audio live with the Web Audio API.'),
    el('h3', 'credits-heading', 'Open source'),
  );
  const list = el('ul', 'credits-list');
  for (const item of THIRD_PARTY) {
    const entry = el('li');
    const link = el('a', '', `${item.license} license`);
    link.href = item.file;
    link.target = '_blank';
    link.rel = 'noopener';
    entry.append(el('strong', '', item.name), el('span', '', ` · ${item.role} · `), link);
    list.append(entry);
  }
  body.append(list);
  return new Modal(root, { title: 'Credits', icon: 'info', body, actions: [{ label: 'Close', variant: 'primary' }] });
}
