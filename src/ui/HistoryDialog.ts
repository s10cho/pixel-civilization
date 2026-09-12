import { t } from '../i18n';
import { eraName } from '../i18n/names';
import type { CityHistory } from '../progression/cityHistory';
import { el } from './dom';
import { formatAmount } from './format';
import { Modal } from './Modal';

/** "Then and now": how far the city has come since it was founded (Phase 2 §9). */
export function openHistory(root: HTMLElement, history: CityHistory): Modal {
  const body = el('div', 'history');
  body.append(el('p', 'modal-text', t('history.days', { days: history.days })));

  const table = el('table', 'help-table history-table');
  const head = el('tr');
  head.append(el('th', '', ''), el('th', '', t('history.then')), el('th', '', t('history.now')));
  table.append(head);

  const rows: [string, string, string][] = [
    [t('history.population'), formatAmount(history.population.first), formatAmount(history.population.now)],
    [t('history.buildings'), formatAmount(history.buildings.first), formatAmount(history.buildings.now)],
    [
      t('history.territory'),
      t('history.territoryValue', { side: history.territory.first }),
      t('history.territoryValue', { side: history.territory.now }),
    ],
    [
      t('history.roads'),
      t('history.roadsValue', { count: history.roads.first }),
      t('history.roadsValue', { count: history.roads.now }),
    ],
  ];
  for (const [label, then, now] of rows) {
    const row = el('tr');
    row.append(el('th', '', label), el('td', '', then), el('td', 'history-now', now));
    table.append(row);
  }
  body.append(table);

  body.append(el('h3', 'credits-heading', t('history.eras')));
  const eras = el('ul', 'history-eras');
  for (const entry of history.eras) {
    eras.append(el('li', '', t('history.eraEntry', { era: eraName(entry.era), day: entry.day })));
  }
  body.append(eras);

  body.append(
    el(
      'p',
      'modal-note',
      `${t('history.level')} ${history.cityLevel} · ${t('history.achievements')} ${history.achievements.done} / ${history.achievements.total}`,
    ),
  );

  return new Modal(root, {
    title: t('history.title'),
    icon: 'clock',
    body,
    actions: [{ label: t('history.close'), variant: 'primary' }],
  });
}
