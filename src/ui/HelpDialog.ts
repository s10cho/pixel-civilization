import { t, type MessageKey } from '../i18n';
import { el } from './dom';
import { Modal } from './Modal';

const ROWS: readonly [MessageKey, MessageKey, MessageKey][] = [
  ['help.select', 'help.selectMouse', 'help.selectTouch'],
  ['help.pan', 'help.panMouse', 'help.panTouch'],
  ['help.rotate', 'help.rotateMouse', 'help.rotateTouch'],
  ['help.zoom', 'help.zoomMouse', 'help.zoomTouch'],
  ['help.moveBuilding', 'help.moveBuildingMouse', 'help.moveBuildingTouch'],
];

/** What the controls are: shown once on the first city, and from the menus afterwards. */
export function openHelp(root: HTMLElement, onClose?: () => void): Modal {
  const body = el('div', 'help');
  body.append(el('p', 'modal-text', t('help.intro')));

  const table = el('table', 'help-table');
  const head = el('tr');
  for (const key of ['help.action', 'help.mouse', 'help.touch'] as const) head.append(el('th', '', t(key)));
  table.append(head);
  for (const [action, mouse, touch] of ROWS) {
    const row = el('tr');
    row.append(el('th', '', t(action)), el('td', '', t(mouse)), el('td', '', t(touch)));
    table.append(row);
  }
  body.append(table, el('p', 'modal-note', t('help.autoGrow')));

  return new Modal(root, {
    title: t('help.title'),
    icon: 'info',
    body,
    actions: [{ label: t('help.close'), variant: 'primary' }],
    onClose,
  });
}
