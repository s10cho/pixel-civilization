import type { Building, BuildingType } from '../building/types';
import type { Occupancy } from '../citizen/occupancy';
import { OFFLINE } from '../config/balance';
import { ERA_TRANSITION } from '../config/gameConfig';
import { t } from '../i18n';
import { eraName } from '../i18n/names';
import type { ResearchId } from '../config/research';
import type { BuildingReport } from '../economy/cityReport';
import type { CityProblem, ProblemKind } from '../economy/problems';
import type { EraId } from '../progression/era';
import type { Resources } from '../simulation/gameState';
import type { OfflineReport } from '../simulation/offline';
import { BuildBar, type BuildOption } from './BuildBar';
import { BuildingPanel, type CityInfo } from './BuildingPanel';
import { button, el, setText } from './dom';
import { formatAmount, formatDuration } from './format';
import { Hud } from './Hud';
import { icon } from './icons';
import { Modal } from './Modal';
import { ProblemsBar } from './ProblemsBar';
import { ResearchPanel, type ResearchPanelView } from './ResearchPanel';
import { Toast } from './Toast';
import { TutorialCard, type TutorialView } from './TutorialCard';

export interface CityUIHandlers {
  onSelectTool(type: BuildingType): void;
  onUpgrade(buildingId: number): void;
  onMoveBuilding(buildingId: number): void;
  onCloseBuildingPanel(): void;
  onExpand(): void;
  onFocusProblem(kind: ProblemKind): void;
  onToggleResearch(): void;
  onStartResearch(id: ResearchId): void;
  onAdvanceEra(): void;
  /** Show the Town Hall, where the era can be advanced. */
  onShowEra(): void;
  onOpenMenu(): void;
  onTutorialNext(): void;
  onTutorialSkip(): void;
  onToggleAutoGrow(): void;
}

/** Presentation state the scene pushes into the UI. */
export interface CityUIView {
  resources: Resources;
  era: EraId;
  buildOptions: readonly BuildOption[];
  activeTool: BuildingType | null;
  selectedBuilding: Building | null;
  selectedOccupancy: Occupancy | null;
  selectedReport: BuildingReport | null;
  /** City status, shown when the Town Hall is selected. */
  city: CityInfo | null;
  /** The building currently being relocated, if any. */
  movingBuildingId: number | null;
  problems: readonly CityProblem[];
  research: ResearchPanelView;
  /** Progress (0..1) of the running research, for the button badge; null when idle. */
  researchProgress: number | null;
  /** The next era once every requirement is met, else null. */
  eraReady: EraId | null;
  /** Cost of the next territory expansion, or null when fully expanded. */
  expansionCost: number | null;
  /** Short instruction shown above the build dock, or null. */
  hint: string | null;
  /** The current tutorial tip, or null when there is no tutorial. */
  tutorial: TutorialView | null;
  /** Whether the advisor is tending the city. */
  autoGrow: boolean;
}

/** DOM overlay for the city scene. Owns no game state; renders the view it is given. */
export class CityUI {
  private readonly container = el('div', 'city-ui');
  private readonly hud = new Hud();
  private readonly problems: ProblemsBar;
  private readonly eraChip: HTMLButtonElement;
  private readonly eraChipLabel: HTMLElement;
  private readonly researchPanel: ResearchPanel;
  private readonly autoGrowButton: HTMLButtonElement;
  private readonly researchButton: HTMLButtonElement;
  private readonly researchBadge = el('span', 'btn-badge');
  private readonly buildBar: BuildBar;
  private readonly expandButton: HTMLButtonElement;
  private readonly expandLabel: HTMLElement;
  private readonly expandCost = el('span', 'btn-cost');
  private readonly buildingPanel: BuildingPanel;
  private readonly tutorialCard: TutorialCard;
  private readonly hint = el('div', 'hint');
  private readonly toast = new Toast();
  private readonly eraBannerTitle = el('div', 'era-banner-title');
  private readonly eraBannerSubtitle = el('div', 'era-banner-subtitle');
  private readonly eraOverlay = this.createEraOverlay();
  private eraTimer: number | undefined;
  private offlineModal: Modal | null = null;

  constructor(root: HTMLElement, handlers: CityUIHandlers) {
    this.problems = new ProblemsBar(handlers.onFocusProblem);
    this.researchPanel = new ResearchPanel({
      onStart: handlers.onStartResearch,
      onClose: handlers.onToggleResearch,
    });
    // On desktop the research panel stacks under the HUD and problems; on mobile CSS turns it
    // into a bottom sheet.
    this.eraChip = button({ icon: 'sparkles', label: '', className: 'era-chip', onClick: handlers.onShowEra });
    this.eraChipLabel = this.eraChip.querySelector('.btn-label')!;
    const topLeft = el('div', 'top-left');
    topLeft.append(this.hud.element, this.eraChip, this.problems.element, this.researchPanel.element);

    this.autoGrowButton = button({
      icon: 'sparkles',
      label: t('ui.autoGrow'),
      className: 'auto-grow-button',
      onClick: handlers.onToggleAutoGrow,
    });
    this.researchButton = button({
      icon: 'flask',
      label: t('ui.research'),
      className: 'research-button',
      onClick: handlers.onToggleResearch,
    });
    this.researchButton.append(this.researchBadge);
    const topRight = el('div', 'top-right');
    topRight.append(
      this.autoGrowButton,
      this.researchButton,
      button({ icon: 'menu', label: t('ui.menu'), className: 'menu-button', onClick: handlers.onOpenMenu }),
    );
    const topBar = el('div', 'top-bar');
    topBar.append(topLeft, topRight);

    this.buildingPanel = new BuildingPanel({
      onUpgrade: handlers.onUpgrade,
      onMove: handlers.onMoveBuilding,
      onAdvanceEra: handlers.onAdvanceEra,
      onClose: handlers.onCloseBuildingPanel,
    });

    this.buildBar = new BuildBar(handlers.onSelectTool);
    this.expandButton = button({
      icon: 'expand',
      label: t('ui.expand'),
      variant: 'warning',
      className: 'expand-button',
      onClick: handlers.onExpand,
    });
    this.expandLabel = this.expandButton.querySelector('.btn-label')!;
    this.expandButton.append(this.expandCost);
    this.buildBar.element.append(this.expandButton);

    // The building panel lives in the bottom bar so that on mobile it stacks above the build
    // bar however many rows that wraps to; on desktop CSS docks it to the right side instead.
    const bottomBar = el('div', 'bottom-bar');
    this.tutorialCard = new TutorialCard(handlers.onTutorialNext, handlers.onTutorialSkip);
    bottomBar.append(this.buildingPanel.element, this.tutorialCard.element, this.hint, this.buildBar.element);

    this.container.append(topBar, this.toast.element, bottomBar, this.eraOverlay);
    root.append(this.container);
  }

  update(view: CityUIView): void {
    const gold = view.resources.gold;
    this.hud.update(view.resources);
    this.eraChip.hidden = view.eraReady === null;
    if (view.eraReady) setText(this.eraChipLabel, t('ui.eraReady', { era: eraName(view.eraReady) }));
    this.autoGrowButton.classList.toggle('btn-success', view.autoGrow);
    this.autoGrowButton.setAttribute('aria-pressed', String(view.autoGrow));
    this.autoGrowButton.title = t(view.autoGrow ? 'ui.autoGrowOn' : 'ui.autoGrowOff');
    this.problems.update(view.problems);
    this.researchPanel.update(view.research);
    this.researchButton.classList.toggle('btn-primary', view.research.open);
    this.researchBadge.hidden = view.researchProgress === null;
    if (view.researchProgress !== null) setText(this.researchBadge, `${Math.round(view.researchProgress * 100)}%`);

    this.buildBar.update(view.buildOptions, view.activeTool, gold);
    this.buildingPanel.update({
      building: view.selectedBuilding,
      city: view.city,
      occupancy: view.selectedOccupancy,
      report: view.selectedReport,
      era: view.era,
      gold,
      moving: view.selectedBuilding !== null && view.selectedBuilding.id === view.movingBuildingId,
    });

    if (view.expansionCost === null) {
      setText(this.expandLabel, t('ui.maxTerritory'));
      this.expandCost.hidden = true;
      this.expandButton.disabled = true;
    } else {
      setText(this.expandLabel, t('ui.expand'));
      setText(this.expandCost, t('format.gold', { amount: formatAmount(view.expansionCost) }));
      this.expandCost.hidden = false;
      this.expandCost.classList.toggle('is-unaffordable', gold < view.expansionCost);
      this.expandButton.disabled = false;
    }

    this.hint.hidden = view.hint === null;
    if (view.hint) setText(this.hint, view.hint);
    this.tutorialCard.update(view.tutorial);
  }

  showMessage(text: string): void {
    this.toast.show(text);
  }

  /** "Welcome back" summary of what the city produced while the player was away. */
  showOfflineReport(report: OfflineReport, autoActions = 0): void {
    this.offlineModal?.close();
    const body = el('div', 'offline-report');
    body.append(el('p', 'modal-text', t('offline.away', { duration: formatDuration(report.awaySeconds) })));
    const stats = el('div', 'offline-stats');
    for (const [iconName, value, label] of [
      ['coins', report.gold, t('offline.gold')],
      ['users', report.population, t('offline.citizens')],
    ] as const) {
      const row = el('div', 'offline-stat');
      row.append(icon(iconName), el('strong', 'offline-value', `+${formatAmount(value)}`), el('span', '', label));
      stats.append(row);
    }
    body.append(stats);
    if (autoActions > 0) body.append(el('p', 'modal-text', t('auto.offline', { count: autoActions })));
    if (report.capped) {
      body.append(el('p', 'modal-note', t('offline.capped', { duration: formatDuration(OFFLINE.maxSeconds) })));
    }
    this.offlineModal = new Modal(this.container, {
      title: t('offline.title'),
      icon: 'clock',
      body,
      actions: [{ label: t('offline.collect'), variant: 'primary' }],
    });
  }

  /**
   * The new-era moment: a white flash and a banner, with the controls tucked away until the
   * banner leaves.
   */
  playEraTransition(title: string, subtitle: string): void {
    setText(this.eraBannerTitle, title);
    setText(this.eraBannerSubtitle, subtitle);
    window.clearTimeout(this.eraTimer);
    this.eraOverlay.hidden = false;
    this.container.classList.add('is-cinematic');
    // Restart the CSS animations even if a previous transition is still showing.
    this.eraOverlay.classList.remove('is-playing');
    void this.eraOverlay.offsetWidth;
    this.eraOverlay.classList.add('is-playing');
    this.eraTimer = window.setTimeout(() => {
      this.eraOverlay.hidden = true;
      this.eraOverlay.classList.remove('is-playing');
      this.container.classList.remove('is-cinematic');
    }, ERA_TRANSITION.bannerMs);
  }

  destroy(): void {
    this.toast.dispose();
    window.clearTimeout(this.eraTimer);
    this.container.remove();
  }

  private createEraOverlay(): HTMLElement {
    const overlay = el('div', 'era-transition');
    overlay.hidden = true;
    overlay.style.setProperty('--era-flash-ms', `${ERA_TRANSITION.flashMs}ms`);
    overlay.style.setProperty('--era-banner-ms', `${ERA_TRANSITION.bannerMs}ms`);
    const banner = el('div', 'era-banner');
    banner.setAttribute('role', 'status');
    banner.append(el('div', 'era-banner-kicker', t('era.banner.kicker')), this.eraBannerTitle, this.eraBannerSubtitle);
    overlay.append(el('div', 'era-flash'), banner);
    return overlay;
  }
}
