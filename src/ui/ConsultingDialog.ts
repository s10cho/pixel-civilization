import { t, tKey } from '../i18n';
import { buildingName } from '../i18n/names';
import type { Advice } from '../consulting/advice';
import type { Proposal } from '../consulting/proposals';
import type { ProjectKind } from '../config/balance';
import type { EraId } from '../progression/era';
import { button, el } from './dom';
import { formatAmount } from './format';
import { icon } from './icons';
import { Modal } from './Modal';

export interface ProjectOffer {
  kind: ProjectKind;
  /** Tiles the work would cover. */
  tiles: number;
  cost: number;
}

export interface ProjectProgress {
  kind: ProjectKind;
  /** 0..1 */
  progress: number;
}

export interface ConsultingView {
  advice: readonly Advice[];
  proposals: readonly Proposal[];
  /** Large works available to commission. */
  projects: readonly ProjectOffer[];
  /** Large works already under way. */
  building: readonly ProjectProgress[];
  era: EraId;
  gold: number;
}

export interface ConsultingHandlers {
  onShow(focus: { col: number; row: number }): void;
  onApply(proposal: Proposal): void;
  onStartProject(kind: ProjectKind): void;
}

/**
 * The AI consulting card: what the city looks like from outside, and a few plans the player
 * can accept with one tap. Nothing here happens without being chosen.
 */
export function openConsulting(root: HTMLElement, view: ConsultingView, handlers: ConsultingHandlers): Modal {
  const body = el('div', 'consulting');
  body.append(el('p', 'modal-text', t('consult.intro')));

  if (view.advice.length === 0 && view.proposals.length === 0) {
    body.append(el('p', 'modal-text', t('consult.none')));
  }

  if (view.advice.length > 0) {
    body.append(el('h3', 'credits-heading', t('consult.adviceTitle')));
    const list = el('div', 'advice-list');
    for (const item of view.advice) {
      const row = el('div', 'advice');
      row.append(icon('lightbulb', 'advice-icon'), el('span', 'advice-text', adviceText(item)));
      if (item.focus) {
        const focus = item.focus;
        row.append(button({ label: t('consult.show'), className: 'btn-link', onClick: () => handlers.onShow(focus) }));
      }
      list.append(row);
    }
    body.append(list);
  }

  if (view.proposals.length > 0) {
    body.append(el('h3', 'credits-heading', t('consult.proposalTitle')));
    for (const proposal of view.proposals) {
      const card = el('div', 'proposal');
      const where = proposal.where ? tKey(`where.${proposal.where}`) : '';
      const title = el('div', 'proposal-title', tKey(`proposal.${proposal.kind}`, { where }));
      if (proposal.candidate) {
        title.append(el('span', 'proposal-candidate', t('consult.candidate', { index: proposal.candidate })));
      }
      card.append(title);
      card.append(
        el(
          'div',
          'proposal-detail',
          proposal.kind === 'expand' ? t('proposal.expandDetail') : summarize(proposal, view.era),
        ),
      );

      const foot = el('div', 'proposal-foot');
      const affordable = view.gold >= proposal.cost;
      const cost = el('span', 'btn-cost', t('format.gold', { amount: formatAmount(proposal.cost) }));
      cost.classList.toggle('is-unaffordable', !affordable);
      foot.append(cost);
      if (proposal.anchor) {
        const anchor = proposal.anchor;
        foot.append(button({ label: t('consult.show'), className: 'btn-link', onClick: () => handlers.onShow(anchor) }));
      }
      foot.append(
        button({
          label: t('consult.apply'),
          variant: 'primary',
          disabled: !affordable,
          onClick: () => handlers.onApply(proposal),
        }),
      );
      card.append(foot);
      body.append(card);
    }
  }

  if (view.building.length > 0) {
    body.append(el('h3', 'credits-heading', t('consult.underway')));
    for (const work of view.building) {
      const row = el('div', 'advice');
      row.append(
        icon('hammer', 'advice-icon'),
        el('span', 'advice-text', tKey(`project.${work.kind}.name`)),
        el('span', 'project-progress', `${Math.round(work.progress * 100)}%`),
      );
      const track = el('div', 'progress');
      const fill = el('div', 'progress-fill');
      fill.style.width = `${Math.round(work.progress * 100)}%`;
      track.append(fill);
      const wrapper = el('div', 'project-row');
      wrapper.append(row, track);
      body.append(wrapper);
    }
  }

  if (view.projects.length > 0) {
    body.append(el('h3', 'credits-heading', t('consult.projects')));
    for (const offer of view.projects) {
      const card = el('div', 'proposal');
      card.append(el('div', 'proposal-title', tKey(`project.${offer.kind}.name`)));
      card.append(
        el('div', 'proposal-detail', tKey(`project.${offer.kind}.detail`, { tiles: offer.tiles })),
      );
      const foot = el('div', 'proposal-foot');
      const affordable = view.gold >= offer.cost;
      const cost = el('span', 'btn-cost', t('format.gold', { amount: formatAmount(offer.cost) }));
      cost.classList.toggle('is-unaffordable', !affordable);
      foot.append(
        cost,
        button({
          label: t('consult.commission'),
          variant: 'primary',
          disabled: !affordable,
          onClick: () => handlers.onStartProject(offer.kind),
        }),
      );
      card.append(foot);
      body.append(card);
    }
  }

  body.append(el('p', 'modal-note', t('consult.footer')));

  return new Modal(root, {
    title: t('consult.title'),
    icon: 'lightbulb',
    body,
    actions: [{ label: t('consult.close'), variant: 'primary' }],
  });
}

function adviceText(advice: Advice): string {
  return tKey(`advice.${advice.id}`, { amount: formatAmount(advice.amount ?? 0) });
}

/** "Hut x3, Grove x1" — what the plan would actually build. */
function summarize(proposal: Proposal, era: EraId): string {
  const counts = new Map<string, number>();
  for (const step of proposal.steps) {
    const name = buildingName(step.type, era);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].map(([name, count]) => `${name} x${count}`).join(' · ');
}
