import * as Phaser from 'phaser';
import type { BuildingType } from '../building/types';
import { CAMERA, SCENE_KEYS, SIMULATION, WORLD } from '../config/gameConfig';
import { CameraController } from '../rendering/CameraController';
import { WorldView, type TileCoord } from '../rendering/WorldView';
import {
  expandTerritory,
  placeBuilding,
  upgradeBuilding,
  validatePlacement,
} from '../simulation/actions';
import { createInitialState, type GameState } from '../simulation/gameState';
import { tickSimulation } from '../simulation/tick';
import { CityUI } from '../ui/CityUI';
import { getUiRoot } from '../ui/dom';
import { ACTION_ERROR_MESSAGES } from '../ui/messages';
import { getBuildingAt } from '../world/placement';
import { getExpansionCost, getUnlockedArea, isInsideWorld } from '../world/territory';

/**
 * City view: owns the game state for the session, turns pointer input into player actions,
 * and keeps the world view and DOM UI in sync with the state.
 */
export class CityScene extends Phaser.Scene {
  private state!: GameState;
  private worldView!: WorldView;
  private cameraController!: CameraController;
  private ui!: CityUI;

  private activeTool: BuildingType | null = null;
  private selectedTile: TileCoord | null = null;
  /** Unsimulated time carried over between frames, in seconds. */
  private tickAccumulator = 0;

  /** True only when the current press started on the canvas (not on DOM UI). */
  private pointerDownOnWorld = false;
  private dragging = false;
  private readonly pressStart = new Phaser.Math.Vector2();
  private readonly pressLast = new Phaser.Math.Vector2();

  constructor() {
    super(SCENE_KEYS.city);
  }

  create(): void {
    // Scene instances are reused across restarts, so per-run fields are reset here.
    this.activeTool = null;
    this.selectedTile = null;
    this.tickAccumulator = 0;
    this.pointerDownOnWorld = false;
    this.dragging = false;

    this.state = createInitialState();

    this.worldView = new WorldView(this);
    this.worldView.syncTerritory(this.state);
    this.worldView.syncBuildings(this.state);

    this.cameraController = new CameraController(
      this.cameras.main,
      WorldView.worldWidth,
      WorldView.worldHeight,
    );
    this.focusTerritory();

    this.ui = new CityUI(getUiRoot(), {
      onSelectTool: (type) => this.selectTool(type),
      onUpgrade: (buildingId) => this.upgrade(buildingId),
      onCloseBuildingPanel: () => this.clearSelection(),
      onExpand: () => this.expand(),
      onOpenMenu: () => this.scene.start(SCENE_KEYS.menu),
    });
    this.refreshUI();

    this.input.mouse?.disableContextMenu();
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.endPress, this);
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
    this.input.keyboard?.on('keydown-ESC', this.cancelTool, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  private onShutdown(): void {
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.endPress, this);
    this.input.off(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
    this.input.keyboard?.off('keydown-ESC', this.cancelTool, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.ui.destroy();
  }

  update(_time: number, deltaMs: number): void {
    this.tickAccumulator = Math.min(
      this.tickAccumulator + deltaMs / 1000,
      SIMULATION.maxCatchUpSeconds,
    );
    let ticked = false;
    while (this.tickAccumulator >= SIMULATION.tickSeconds) {
      tickSimulation(this.state, SIMULATION.tickSeconds);
      this.tickAccumulator -= SIMULATION.tickSeconds;
      ticked = true;
    }
    if (ticked) this.refreshUI();
  }

  private focusTerritory(): void {
    const area = getUnlockedArea(this.state.expansionLevel);
    const size = WORLD.tileSize;
    this.cameraController.fitRect(
      area.minCol * size,
      area.minRow * size,
      (area.maxCol - area.minCol + 1) * size,
      (area.maxRow - area.minRow + 1) * size,
    );
  }

  // --- Input -------------------------------------------------------------------------------

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.rightButtonDown()) {
      this.cancelTool();
      return;
    }
    this.pointerDownOnWorld = true;
    this.dragging = false;
    this.pressStart.set(pointer.x, pointer.y);
    this.pressLast.set(pointer.x, pointer.y);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.pointerDownOnWorld && pointer.isDown) {
      const travelled = Phaser.Math.Distance.Between(
        pointer.x,
        pointer.y,
        this.pressStart.x,
        this.pressStart.y,
      );
      if (!this.dragging && travelled > CAMERA.dragThresholdPx) {
        this.dragging = true;
        this.worldView.hidePreview();
      }
      if (this.dragging) {
        this.cameraController.panByScreen(pointer.x - this.pressLast.x, pointer.y - this.pressLast.y);
      }
      this.pressLast.set(pointer.x, pointer.y);
      return;
    }
    this.updatePreview(pointer);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    const isTap = this.pointerDownOnWorld && !this.dragging;
    this.endPress();
    if (isTap) this.handleTap(pointer);
  }

  private endPress(): void {
    this.pointerDownOnWorld = false;
    this.dragging = false;
  }

  private onWheel(
    pointer: Phaser.Input.Pointer,
    _over: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void {
    this.cameraController.zoomAt(pointer.x, pointer.y, Math.exp(-deltaY * CAMERA.wheelZoomFactor));
    this.updatePreview(pointer);
  }

  private onResize(): void {
    this.cameraController.refresh();
  }

  private pointerToTile(pointer: Phaser.Input.Pointer): TileCoord {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return this.worldView.worldToTile(world.x, world.y);
  }

  // --- Actions -----------------------------------------------------------------------------

  private handleTap(pointer: Phaser.Input.Pointer): void {
    const tile = this.pointerToTile(pointer);

    if (this.activeTool) {
      const result = placeBuilding(this.state, this.activeTool, tile.col, tile.row);
      if (result.ok) {
        this.worldView.syncBuildings(this.state);
      } else {
        this.ui.showMessage(ACTION_ERROR_MESSAGES[result.error]);
      }
      this.updatePreview(pointer);
      this.refreshUI();
      return;
    }

    this.selectedTile = isInsideWorld(tile.col, tile.row) ? tile : null;
    this.worldView.setSelection(this.selectedTile);
    this.refreshUI();
  }

  private updatePreview(pointer: Phaser.Input.Pointer): void {
    if (!this.activeTool) return;
    const tile = this.pointerToTile(pointer);
    if (!isInsideWorld(tile.col, tile.row)) {
      this.worldView.hidePreview();
      return;
    }
    const valid = validatePlacement(this.state, this.activeTool, tile.col, tile.row) === null;
    this.worldView.showPreview(this.activeTool, tile, valid);
  }

  private selectTool(type: BuildingType): void {
    this.activeTool = this.activeTool === type ? null : type;
    if (!this.activeTool) this.worldView.hidePreview();
    this.selectedTile = null;
    this.worldView.setSelection(null);
    this.refreshUI();
  }

  private cancelTool(): void {
    this.activeTool = null;
    this.worldView.hidePreview();
    this.refreshUI();
  }

  private upgrade(buildingId: number): void {
    const result = upgradeBuilding(this.state, buildingId);
    if (result.ok) {
      this.worldView.syncBuildings(this.state);
    } else {
      this.ui.showMessage(ACTION_ERROR_MESSAGES[result.error]);
    }
    this.refreshUI();
  }

  private expand(): void {
    const result = expandTerritory(this.state);
    if (result.ok) {
      this.worldView.syncTerritory(this.state);
      // Auto focus: frame the newly unlocked territory.
      this.focusTerritory();
    } else {
      this.ui.showMessage(ACTION_ERROR_MESSAGES[result.error]);
    }
    this.refreshUI();
  }

  private clearSelection(): void {
    this.selectedTile = null;
    this.worldView.setSelection(null);
    this.refreshUI();
  }

  private refreshUI(): void {
    const selectedBuilding = this.selectedTile
      ? (getBuildingAt(this.state, this.selectedTile.col, this.selectedTile.row) ?? null)
      : null;
    this.ui.update({
      resources: this.state.resources,
      activeTool: this.activeTool,
      selectedBuilding,
      expansionCost: getExpansionCost(this.state.expansionLevel),
    });
  }
}
