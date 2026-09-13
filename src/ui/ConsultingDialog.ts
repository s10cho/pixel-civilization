import { t, tKey } from '../i18n';
import { buildingName } from '../i18n/names';
import type { Advice } from '../consulting/advice';
import type { ModelOpinion } from '../consulting/llm';
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
  /** What a model made of the city, when one is configured. */
  model: ModelOpinion;
}

export interface ConsultingHandlers {
  onShow(focus: { col: number; row: number }): void;
  onApply(proposal: Proposal): void;
  onStartProject(kind: ProjectKind): void;
}

/** An open consulting card, which can be refreshed in place when the model answers. */
export interface ConsultingCard {
  modal: Modal;
  update(view: ConsultingView): void;
}

/**
 * The AI consulting card: what the city looks like from outside, and a few plans the player
 * can accept with one tap. Nothing here happens without being chosen.
 */
export function openConsulting(
  root: HTMLElement,
  view: ConsultingView,
  handlers: ConsultingHandlers,
): ConsultingCard {
  const body = el('div', 'consulting');
  fill(body, view, handlers);
  const modal = new Modal(root, {
    title: t('consult.title'),
    icon: 'lightbulb',
    body,
    actions: [{ label: t('consult.close'), variant: 'primary' }],
  });
  return {
    modal,
    update(next: ConsultingView) {
      if (!modal.isOpen) return;
      body.replaceChildren();
      fill(body, next, handlers);
    },
  };
}

function fill(body: HTMLElement, view: ConsultingView, handlers: ConsultingHandlers): void {
  body.append(el('p', 'modal-text', t('consult.intro')));
  const opinion = modelCard(view.model);
  if (opinion) body.append(opinion);

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
    for (const proposal of ordered(view)) {
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
      const why = view.model.why?.get(proposal.id);
      if (why) {
        const note = el('div', 'proposal-why');
        note.append(icon('lightbulb', 'advice-icon'), el('span', '', why));
        card.append(note);
      }

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
}

/** The model's own reading of the city, while it is thinking and once it has answered. */
function modelCard(model: ModelOpinion): HTMLElement | null {
  if (model.state === 'off' || model.state === 'failed') return null;
  const card = el('div', 'model-note');
  card.append(el('span', 'model-badge', t('consult.modelBadge')));
  if (model.state === 'pending') {
    card.classList.add('is-pending');
    card.append(el('span', 'model-text', t('consult.modelThinking')));
    return card;
  }
  if (!model.note) return null;
  card.append(el('span', 'model-text', model.note));
  return card;
}

/** The plans, with anything the model singled out brought to the front. */
function ordered(view: ConsultingView): readonly Proposal[] {
  const picks = view.model.order;
  if (!picks || picks.length === 0) return view.proposals;
  const rank = new Map(picks.map((id, index) => [id, index]));
  return [...view.proposals].sort(
    (a, b) => (rank.get(a.id) ?? picks.length) - (rank.get(b.id) ?? picks.length),
  );
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
