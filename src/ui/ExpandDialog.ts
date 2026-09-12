import { t, tKey } from '../i18n';
import type { Direction } from '../world/territory';
import { button, el } from './dom';
import { formatAmount } from './format';
import { Modal } from './Modal';

export interface ExpandOption {
  direction: Direction;
  /** Tiles of land this side would add. */
  tiles: number;
  /** How many of those are buildable (the rest is rough ground). */
  buildable: number;
  recommended: boolean;
}

/**
 * Where the city grows is the player's call (Phase 2 §1.3), so expanding asks for a side
 * rather than spreading in every direction at once.
 */
export function openExpand(
  root: HTMLElement,
  options: { cost: number; gold: number; sides: readonly ExpandOption[] },
  onChoose: (direction: Direction) => void,
): Modal {
  const body = el('div', 'expand');
  body.append(el('p', 'modal-text', t('expand.intro')));

  const affordable = options.gold >= options.cost;
  for (const side of options.sides) {
    const card = el('div', 'proposal');
    const title = el('div', 'proposal-title', tKey(`expand.side.${side.direction}`));
    if (side.recommended) title.append(el('span', 'proposal-candidate', t('expand.recommended')));
    card.append(title, el('div', 'proposal-detail', t('expand.detail', { tiles: side.tiles, buildable: side.buildable })));

    const foot = el('div', 'proposal-foot');
    const cost = el('span', 'btn-cost', t('format.gold', { amount: formatAmount(options.cost) }));
    cost.classList.toggle('is-unaffordable', !affordable);
    foot.append(
      cost,
      button({
        label: t('expand.choose'),
        variant: 'primary',
        disabled: !affordable,
        onClick: () => onChoose(side.direction),
      }),
    );
    card.append(foot);
    body.append(card);
  }

  return new Modal(root, {
    title: t('expand.title'),
    icon: 'expand',
    body,
    actions: [{ label: t('expand.later'), variant: 'primary' }],
  });
}
