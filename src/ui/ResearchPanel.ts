import type { ResearchId } from '../config/research';
import { t } from '../i18n';
import type { ResearchStatus } from '../progression/research';
import { button, el, setText } from './dom';
import { formatAmount, formatRate } from './format';
import { icon } from './icons';

export interface ResearchCard {
  id: ResearchId;
  name: string;
  description: string;
  eraName: string;
  cost: number;
  status: ResearchStatus;
  /** 0..1 for the active research. */
  progress: number;
  /** Names of prerequisites still missing (for locked research). */
  missing: string[];
}

export interface ResearchPanelView {
  open: boolean;
  /** Whether the city has a research building at all. */
  canResearch: boolean;
  /** Current-era name of the research building, for the hint. */
  buildingName: string;
  pointsPerSecond: number;
  gold: number;
  busy: boolean;
  cards: ResearchCard[];
}

export interface ResearchPanelHandlers {
  onStart(id: ResearchId): void;
  onClose(): void;
}

/** Research tree for the current and past eras: status, cost and progress of each entry. */
export class ResearchPanel {
  readonly element = el('section', 'panel research-panel');
  private readonly rate = el('div', 'panel-subtitle');
  private readonly notice = el('p', 'panel-notice');
  private readonly list = el('div', 'research-list');
  private readonly progressBars = new Map<ResearchId, { fill: HTMLElement; label: HTMLElement }>();
  private rendered = '';

  constructor(private readonly handlers: ResearchPanelHandlers) {
    const badge = el('div', 'panel-badge');
    badge.append(icon('flask'));
    const heading = el('div', 'panel-heading');
    heading.append(el('h2', 'panel-title', t('research.title')), this.rate);
    const header = el('header', 'panel-header');
    header.append(
      badge,
      heading,
      button({ icon: 'close', ariaLabel: t('ui.close'), className: 'btn-icon close-button', onClick: handlers.onClose }),
    );
    this.element.append(header, this.notice, this.list);
    this.element.hidden = true;
  }

  update(view: ResearchPanelView): void {
    this.element.hidden = !view.open;
    if (!view.open) return;

    setText(
      this.rate,
      view.canResearch ? t('research.rate', { rate: formatRate(view.pointsPerSecond) }) : t('research.none'),
    );
    this.notice.hidden = view.canResearch;
    setText(this.notice, t('research.needBuilding', { building: view.buildingName }));

    const signature = [
      view.canResearch,
      view.busy,
      ...view.cards.map((card) => `${card.id}:${card.status}:${view.gold >= card.cost}`),
    ].join('|');
    if (signature !== this.rendered) {
      this.rendered = signature;
      this.render(view);
    }
    for (const card of view.cards) {
      const bar = this.progressBars.get(card.id);
      if (!bar) continue;
      bar.fill.style.width = `${Math.round(card.progress * 100)}%`;
      setText(bar.label, `${Math.round(card.progress * 100)}%`);
    }
  }

  private render(view: ResearchPanelView): void {
    this.progressBars.clear();
    this.list.replaceChildren(
      ...view.cards.map((card) => {
        const article = el('article', 'research-card');
        article.dataset.status = card.status;
        article.dataset.research = card.id;
        const head = el('div', 'research-head');
        head.append(el('strong', undefined, card.name), el('span', 'research-era', card.eraName));
        article.append(head, el('p', 'research-desc', card.description), this.footer(card, view));
        return article;
      }),
    );
  }

  private footer(card: ResearchCard, view: ResearchPanelView): HTMLElement {
    const foot = el('div', 'research-foot');
    switch (card.status) {
      case 'available': {
        const start = button({
          label: t('research.start'),
          variant: 'primary',
          className: 'research-start',
          disabled: !view.canResearch || view.busy,
          onClick: () => this.handlers.onStart(card.id),
        });
        const cost = el('span', 'btn-cost', t('format.gold', { amount: formatAmount(card.cost) }));
        cost.classList.toggle('is-unaffordable', view.gold < card.cost);
        start.append(cost);
        foot.append(start);
        if (view.busy) foot.append(el('span', undefined, t('research.busy')));
        break;
      }
      case 'active': {
        const track = el('div', 'progress');
        const fill = el('div', 'progress-fill');
        track.append(fill);
        const label = el('span', 'research-percent');
        foot.append(track, label);
        this.progressBars.set(card.id, { fill, label });
        break;
      }
      case 'done':
        foot.append(icon('sparkles'), el('span', undefined, t('research.completed')));
        break;
      case 'locked':
        foot.append(el('span', undefined, t('research.requires', { names: card.missing.join(', ') })));
        break;
      case 'excluded':
        foot.append(el('span', undefined, t('research.excluded')));
        break;
      case 'laterEra':
        break;
    }
    return foot;
  }
}
