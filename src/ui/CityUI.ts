import type { Building, BuildingType } from '../building/types';
import type { Occupancy } from '../citizen/occupancy';
import type { ResearchId } from '../config/research';
import type { BuildingReport } from '../economy/cityReport';
import type { CityProblem, ProblemKind } from '../economy/problems';
import type { EraId } from '../progression/era';
import type { Resources } from '../simulation/gameState';
import { BuildBar, type BuildOption } from './BuildBar';
import { BuildingPanel, type CityInfo } from './BuildingPanel';
import { button, el, setText } from './dom';
import { formatAmount } from './format';
import { Hud } from './Hud';
import { ProblemsBar } from './ProblemsBar';
import { ResearchPanel, type ResearchPanelView } from './ResearchPanel';
import { Toast } from './Toast';

export interface CityUIHandlers {
  onSelectTool(type: BuildingType): void;
  onUpgrade(buildingId: number): void;
  onMoveBuilding(buildingId: number): void;
  onCloseBuildingPanel(): void;
  onExpand(): void;
  onFocusProblem(kind: ProblemKind): void;
  onToggleResearch(): void;
  onStartResearch(id: ResearchId): void;
  onOpenMenu(): void;
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
  /** Cost of the next territory expansion, or null when fully expanded. */
  expansionCost: number | null;
  /** Short instruction shown above the build dock, or null. */
  hint: string | null;
}

/** DOM overlay for the city scene. Owns no game state; renders the view it is given. */
export class CityUI {
  private readonly container = el('div', 'city-ui');
  private readonly hud = new Hud();
  private readonly problems: ProblemsBar;
  private readonly researchPanel: ResearchPanel;
  private readonly researchButton: HTMLButtonElement;
  private readonly researchBadge = el('span', 'btn-badge');
  private readonly buildBar: BuildBar;
  private readonly expandButton: HTMLButtonElement;
  private readonly expandLabel: HTMLElement;
  private readonly expandCost = el('span', 'btn-cost');
  private readonly buildingPanel: BuildingPanel;
  private readonly hint = el('div', 'hint');
  private readonly toast = new Toast();

  constructor(root: HTMLElement, handlers: CityUIHandlers) {
    this.problems = new ProblemsBar(handlers.onFocusProblem);
    this.researchPanel = new ResearchPanel({
      onStart: handlers.onStartResearch,
      onClose: handlers.onToggleResearch,
    });
    // On desktop the research panel stacks under the HUD and problems; on mobile CSS turns it
    // into a bottom sheet.
    const topLeft = el('div', 'top-left');
    topLeft.append(this.hud.element, this.problems.element, this.researchPanel.element);

    this.researchButton = button({
      icon: 'flask',
      label: 'Research',
      className: 'research-button',
      onClick: handlers.onToggleResearch,
    });
    this.researchButton.append(this.researchBadge);
    const topRight = el('div', 'top-right');
    topRight.append(
      this.researchButton,
      button({ icon: 'menu', label: 'Menu', className: 'menu-button', onClick: handlers.onOpenMenu }),
    );
    const topBar = el('div', 'top-bar');
    topBar.append(topLeft, topRight);

    this.buildingPanel = new BuildingPanel({
      onUpgrade: handlers.onUpgrade,
      onMove: handlers.onMoveBuilding,
      onClose: handlers.onCloseBuildingPanel,
    });

    this.buildBar = new BuildBar(handlers.onSelectTool);
    this.expandButton = button({
      icon: 'expand',
      label: 'Expand',
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
    bottomBar.append(this.buildingPanel.element, this.hint, this.buildBar.element);

    this.container.append(topBar, this.toast.element, bottomBar);
    root.append(this.container);
  }

  update(view: CityUIView): void {
    const gold = view.resources.gold;
    this.hud.update(view.resources);
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
      setText(this.expandLabel, 'Max territory');
      this.expandCost.hidden = true;
      this.expandButton.disabled = true;
    } else {
      setText(this.expandLabel, 'Expand');
      setText(this.expandCost, `${formatAmount(view.expansionCost)}g`);
      this.expandCost.hidden = false;
      this.expandCost.classList.toggle('is-unaffordable', gold < view.expansionCost);
      this.expandButton.disabled = false;
    }

    this.hint.hidden = view.hint === null;
    if (view.hint) setText(this.hint, view.hint);
  }

  showMessage(text: string): void {
    this.toast.show(text);
  }

  destroy(): void {
    this.toast.dispose();
    this.container.remove();
  }
}
