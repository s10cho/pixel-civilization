import { t } from '../i18n';
import { el } from './dom';
import { Modal } from './Modal';

const THIRD_PARTY = [
  { name: 'three.js', roleKey: 'credits.role.render', license: 'MIT', file: 'licenses/three-LICENSE.txt' },
  { name: 'Lucide', roleKey: 'credits.role.icons', license: 'ISC', file: 'licenses/lucide-static-LICENSE.txt' },
] as const;

/** Credits and third-party licenses. */
export function openCredits(root: HTMLElement): Modal {
  const body = el('div', 'credits');
  body.append(
    el('p', 'modal-text', t('credits.about1')),
    el('p', 'modal-text', t('credits.about2')),
    el('h3', 'credits-heading', t('credits.openSource')),
  );
  const list = el('ul', 'credits-list');
  for (const item of THIRD_PARTY) {
    const entry = el('li');
    const link = el('a', '', t('credits.license', { license: item.license }));
    link.href = item.file;
    link.target = '_blank';
    link.rel = 'noopener';
    entry.append(el('strong', '', item.name), el('span', '', ` · ${t(item.roleKey)} · `), link);
    list.append(entry);
  }
  body.append(list);
  return new Modal(root, {
    title: t('credits.title'),
    icon: 'info',
    body,
    actions: [{ label: t('credits.close'), variant: 'primary' }],
  });
}
