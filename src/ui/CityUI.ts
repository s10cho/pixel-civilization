import type { Building, BuildingType } from '../building/types';
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
  /** Cost of the next territory expansion, or null when fully expanded. */
  expansionCost: number | null;
}

/** DOM overlay for the city scene. Owns no game state; renders the view it is given. */
export class CityUI {
  private readonly container = el('div', 'city-ui');
  private readonly hud = new Hud();
  private readonly buildBar: BuildBar;
  private readonly expandButton: HTMLButtonElement;
  private readonly buildingPanel: BuildingPanel;
  private readonly hint = el('div', 'hint');
  private readonly toast = new Toast();

  constructor(root: HTMLElement, handlers: CityUIHandlers) {
    const topBar = el('div', 'top-bar');
    topBar.append(this.hud.element, button('Menu', handlers.onOpenMenu, 'menu-button'));

    this.buildingPanel = new BuildingPanel({
      onUpgrade: handlers.onUpgrade,
      onClose: handlers.onCloseBuildingPanel,
    });

    this.buildBar = new BuildBar(handlers.onSelectTool);
    this.expandButton = button('Expand', handlers.onExpand, 'expand-button');
    this.buildBar.element.append(this.expandButton);

    const bottomBar = el('div', 'bottom-bar');
    bottomBar.append(this.hint, this.buildBar.element);

    this.container.append(topBar, this.buildingPanel.element, this.toast.element, bottomBar);
    root.append(this.container);
  }

  update(view: CityUIView): void {
    const gold = view.resources.gold;
    this.hud.update(view.resources);
    this.buildBar.update(view.activeTool, gold);
    this.buildingPanel.update(view.selectedBuilding, gold);

    if (view.expansionCost === null) {
      setText(this.expandButton, 'Max territory');
      this.expandButton.disabled = true;
      this.expandButton.classList.remove('unaffordable');
    } else {
      setText(this.expandButton, `Expand ${formatAmount(view.expansionCost)}g`);
      this.expandButton.disabled = false;
      this.expandButton.classList.toggle('unaffordable', gold < view.expansionCost);
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
