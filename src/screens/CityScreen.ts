import type { BuildingType } from '../building/types';
import { getOccupancy } from '../citizen/occupancy';
import { CAMERA, SIMULATION } from '../config/gameConfig';
import { BuildingView } from '../render3d/BuildingView';
import { CameraRig } from '../render3d/CameraRig';
import { CitizenView } from '../render3d/CitizenView';
import type { TileCoord } from '../render3d/coords';
import { GroundView } from '../render3d/GroundView';
import { getQualityPreset } from '../render3d/quality';
import { Stage } from '../render3d/Stage';
import { TileMarkers } from '../render3d/TileMarkers';
import { TilePicker } from '../render3d/TilePicker';
import {
  expandTerritory,
  placeBuilding,
  upgradeBuilding,
  validatePlacement,
} from '../simulation/actions';
import { createInitialState, type GameState } from '../simulation/gameState';
import { tickSimulation } from '../simulation/tick';
import { CityUI } from '../ui/CityUI';
import { ACTION_ERROR_MESSAGES } from '../ui/messages';
import { getBuildingAt } from '../world/placement';
import { getExpansionCost, getUnlockedArea } from '../world/territory';
import type { Screen } from './Screen';

export interface CityScreenHandlers {
  onExit(): void;
}

interface Press {
  x: number;
  y: number;
  /** Set once the press turns into a camera drag or a multi-touch gesture. */
  cancelled: boolean;
}

/**
 * The city: owns the game state for the session, runs the fixed-step simulation, turns taps into
 * player actions, and keeps the 3D view and DOM UI in sync with the state.
 */
export class CityScreen implements Screen {
  private readonly state: GameState = createInitialState();
  private stage!: Stage;
  private rig!: CameraRig;
  private ground!: GroundView;
  private buildings!: BuildingView;
  private citizens!: CitizenView;
  private markers!: TileMarkers;
  private picker!: TilePicker;
  private ui!: CityUI;

  private activeTool: BuildingType | null = null;
  private selectedTile: TileCoord | null = null;
  /** Tile under the mouse, for the placement preview (desktop only). */
  private hoverTile: TileCoord | null = null;
  private press: Press | null = null;
  private readonly activePointers = new Set<number>();
  /** Unsimulated time carried over between frames, in seconds. */
  private accumulator = 0;
  private lastFrame = 0;

  constructor(
    private readonly viewRoot: HTMLElement,
    private readonly uiRoot: HTMLElement,
    private readonly handlers: CityScreenHandlers,
  ) {}

  mount(): void {
    const quality = getQualityPreset();
    this.stage = new Stage(this.viewRoot, quality);
    this.ground = new GroundView(this.stage.scene);
    this.buildings = new BuildingView(this.stage.scene);
    this.citizens = new CitizenView(this.stage.scene, quality.renderedCitizens);
    this.markers = new TileMarkers(this.stage.scene);
    this.ground.syncTerritory(this.state);
    this.buildings.sync(this.state.buildings);
    this.citizens.sync(this.state.citizens);

    this.rig = new CameraRig(this.stage.camera, this.stage.canvas);
    this.rig.focusArea(getUnlockedArea(this.state.expansionLevel));
    this.picker = new TilePicker(this.stage.camera, this.stage.canvas, this.buildings);

    this.ui = new CityUI(this.uiRoot, {
      onSelectTool: (type) => this.selectTool(type),
      onUpgrade: (buildingId) => this.upgrade(buildingId),
      onCloseBuildingPanel: () => this.clearSelection(),
      onExpand: () => this.expand(),
      onOpenMenu: () => this.handlers.onExit(),
    });
    this.refreshUI();

    const canvas = this.stage.canvas;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);

    this.lastFrame = performance.now();
    this.stage.renderer.setAnimationLoop(this.frame);
  }

  unmount(): void {
    this.stage.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    this.rig.dispose();
    this.markers.dispose();
    this.ground.dispose();
    this.buildings.dispose();
    this.citizens.dispose();
    this.ui.destroy();
    // Removing the canvas also drops its pointer listeners.
    this.stage.dispose();
  }

  private readonly frame = (now: number): void => {
    // rAF timestamps can precede the performance.now() taken at mount, so never step backwards.
    const dt = Math.min(Math.max(0, (now - this.lastFrame) / 1000), SIMULATION.maxCatchUpSeconds);
    this.lastFrame = now;
    this.accumulator += dt;
    let ticked = false;
    while (this.accumulator >= SIMULATION.tickSeconds) {
      tickSimulation(this.state, SIMULATION.tickSeconds);
      this.accumulator -= SIMULATION.tickSeconds;
      ticked = true;
    }
    if (ticked) {
      this.citizens.sync(this.state.citizens);
      // Gold changes over time, so a preview can flip between valid and invalid.
      this.updatePreview();
      this.refreshUI();
    }

    this.citizens.render(this.accumulator / SIMULATION.tickSeconds, now / 1000);
    this.rig.update();
    this.stage.render();
  };

  // --- Input -------------------------------------------------------------------------------
  // Camera gestures are handled by OrbitControls on the same canvas; here we only detect taps.

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.activePointers.add(event.pointerId);
    if (this.activePointers.size > 1) {
      // A second finger means pinch/twist, never a tap.
      if (this.press) this.press.cancelled = true;
      return;
    }
    this.press = event.button === 0 ? { x: event.clientX, y: event.clientY, cancelled: false } : null;
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.press) {
      const travelled = Math.hypot(event.clientX - this.press.x, event.clientY - this.press.y);
      if (travelled > CAMERA.dragThresholdPx) this.press.cancelled = true;
      return;
    }
    if (event.pointerType === 'mouse') {
      this.hoverTile = this.picker.pick(event.clientX, event.clientY);
      this.updatePreview();
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId);
    const press = this.press;
    this.press = null;
    if (press && !press.cancelled) this.handleTap(this.picker.pick(event.clientX, event.clientY));
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId);
    this.press = null;
  };

  private readonly onPointerLeave = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') return;
    this.hoverTile = null;
    this.updatePreview();
  };

  private readonly onResize = (): void => {
    this.stage.resize();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.cancelTool();
  };

  // --- Actions -----------------------------------------------------------------------------

  private handleTap(tile: TileCoord | null): void {
    if (this.activeTool) {
      if (!tile) return;
      const result = placeBuilding(this.state, this.activeTool, tile.col, tile.row);
      if (result.ok) this.buildings.sync(this.state.buildings);
      else this.ui.showMessage(ACTION_ERROR_MESSAGES[result.error]);
      this.hoverTile = tile;
      this.updatePreview();
      this.refreshUI();
      return;
    }

    this.selectedTile = tile;
    this.markers.setSelection(tile);
    this.refreshUI();
  }

  private updatePreview(): void {
    if (!this.activeTool || !this.hoverTile) {
      this.markers.hidePreview();
      return;
    }
    const { col, row } = this.hoverTile;
    const valid = validatePlacement(this.state, this.activeTool, col, row) === null;
    this.markers.showPreview(this.activeTool, this.hoverTile, valid);
  }

  private selectTool(type: BuildingType): void {
    this.activeTool = this.activeTool === type ? null : type;
    this.selectedTile = null;
    this.markers.setSelection(null);
    this.updatePreview();
    this.refreshUI();
  }

  private cancelTool(): void {
    this.activeTool = null;
    this.updatePreview();
    this.refreshUI();
  }

  private upgrade(buildingId: number): void {
    const result = upgradeBuilding(this.state, buildingId);
    if (result.ok) this.buildings.sync(this.state.buildings);
    else this.ui.showMessage(ACTION_ERROR_MESSAGES[result.error]);
    this.refreshUI();
  }

  private expand(): void {
    const result = expandTerritory(this.state);
    if (result.ok) {
      this.ground.syncTerritory(this.state);
      // Auto focus: frame the newly unlocked territory.
      this.rig.focusArea(getUnlockedArea(this.state.expansionLevel));
    } else {
      this.ui.showMessage(ACTION_ERROR_MESSAGES[result.error]);
    }
    this.refreshUI();
  }

  private clearSelection(): void {
    this.selectedTile = null;
    this.markers.setSelection(null);
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
      selectedOccupancy: selectedBuilding ? getOccupancy(this.state, selectedBuilding) : null,
      expansionCost: getExpansionCost(this.state.expansionLevel),
    });
  }
}
