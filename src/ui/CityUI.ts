import type { Building, BuildingType } from '../building/types';
import type { Occupancy } from '../citizen/occupancy';
import { BUILDINGS } from '../config/balance';
import type { Resources } from '../simulation/gameState';
import { BuildBar } from './BuildBar';
import { BuildingPanel } from './BuildingPanel';
import { button, el, setText } from './dom';
import { formatAmount } from './format';
import { Hud } from './Hud';
import { Toast } from './Toast';

export interface CityUIHandlers {
  onSelectTool(type: BuildingType): void;
  onUpgrade(buildingId: number): void;
  onCloseBuildingPanel(): void;
  onExpand(): void;
  onOpenMenu(): void;
}

/** Presentation state the scene pushes into the UI. */
export interface CityUIView {
  resources: Resources;
  activeTool: BuildingType | null;
  selectedBuilding: Building | null;
  selectedOccupancy: Occupancy | null;
  /** Cost of the next territory expansion, or null when fully expanded. */
  expansionCost: number | null;
}

/** DOM overlay for the city scene. Owns no game state; renders the view it is given. */
export class CityUI {
  private readonly container = el('div', 'city-ui');
  private readonly hud = new Hud();
  private readonly buildBar: BuildBar;
  private readonly expandButton: HTMLButtonElement;
  private readonly expandLabel: HTMLElement;
  private readonly expandCost = el('span', 'btn-cost');
  private readonly buildingPanel: BuildingPanel;
  private readonly hint = el('div', 'hint');
  private readonly toast = new Toast();

  constructor(root: HTMLElement, handlers: CityUIHandlers) {
    const topBar = el('div', 'top-bar');
    topBar.append(
      this.hud.element,
      button({ icon: 'menu', label: 'Menu', className: 'menu-button', onClick: handlers.onOpenMenu }),
    );

    this.buildingPanel = new BuildingPanel({
      onUpgrade: handlers.onUpgrade,
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

    // The panel lives in the bottom bar so that on mobile it stacks above the build bar however
    // many rows that wraps to; on desktop CSS docks it to the right side instead.
    const bottomBar = el('div', 'bottom-bar');
    bottomBar.append(this.buildingPanel.element, this.hint, this.buildBar.element);

    this.container.append(topBar, this.toast.element, bottomBar);
    root.append(this.container);
  }

  update(view: CityUIView): void {
    const gold = view.resources.gold;
    this.hud.update(view.resources);
    this.buildBar.update(view.activeTool, gold);
    this.buildingPanel.update(view.selectedBuilding, view.selectedOccupancy, gold);

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

    this.hint.hidden = view.activeTool === null;
    if (view.activeTool) {
      setText(this.hint, `Tap a tile to place ${BUILDINGS[view.activeTool].name}. Tap the button again to stop.`);
    }
  }

  showMessage(text: string): void {
    this.toast.show(text);
  }

  destroy(): void {
    this.toast.dispose();
    this.container.remove();
  }
}
