import { audio } from '../audio/AudioEngine';
import { BUILDABLE_TYPES, buildingName, getBuildCost, getUnlockState } from '../building/rules';
import type { Building, BuildingType } from '../building/types';
import { getOccupancy } from '../citizen/occupancy';
import { BUILDINGS, ERA_SETTINGS, OFFLINE } from '../config/balance';
import { CAMERA, ERA_TRANSITION, SAVE, SIMULATION } from '../config/gameConfig';
import { RESEARCH, RESEARCH_IDS, type ResearchId } from '../config/research';
import { computeCityReport, type CityReport } from '../economy/cityReport';
import { detectProblems, type CityProblem, type ProblemKind } from '../economy/problems';
import type { EraId } from '../progression/era';
import { advanceEra, getEraProgress, type EraProgress } from '../progression/eraProgress';
import { isMaxLevel, unlocksAtLevel, xpToNextLevel } from '../progression/level';
import { getResearchStatus, hasResearchBuilding, startResearch } from '../progression/research';
import { BuildingView } from '../render3d/BuildingView';
import { CameraRig } from '../render3d/CameraRig';
import { CitizenView } from '../render3d/CitizenView';
import type { TileCoord } from '../render3d/coords';
import { DecorView } from '../render3d/DecorView';
import { GroundView } from '../render3d/GroundView';
import { getQualityPreset } from '../render3d/quality';
import { SmokeView } from '../render3d/SmokeView';
import { Stage } from '../render3d/Stage';
import { TileMarkers } from '../render3d/TileMarkers';
import { TilePicker } from '../render3d/TilePicker';
import {
  expandTerritory,
  moveBuilding,
  placeBuilding,
  upgradeBuilding,
  validateMove,
  validatePlacement,
} from '../simulation/actions';
import { createInitialState, type GameState } from '../simulation/gameState';
import { applyOfflineProgress } from '../simulation/offline';
import { tickSimulation } from '../simulation/tick';
import { saveSlot, type LoadedSave } from '../storage/saveStore';
import type { BuildOption } from '../ui/BuildBar';
import type { CityInfo, EraInfo } from '../ui/BuildingPanel';
import { CityUI } from '../ui/CityUI';
import {
  ACTION_ERROR_MESSAGES,
  ERA_ERROR_MESSAGES,
  ERA_TAGLINES,
  eraRequirementText,
  problemText,
  RESEARCH_ERROR_MESSAGES,
} from '../ui/messages';
import type { ResearchCard, ResearchPanelView } from '../ui/ResearchPanel';
import { getBuildingAt } from '../world/placement';
import { getExpansionCost, getUnlockedArea } from '../world/territory';
import type { Screen } from './Screen';

export interface CityScreenHandlers {
  onExit(): void;
}

export interface CityScreenOptions {
  /** Save slot this city lives in. */
  slot: number;
  /** A loaded save to resume, or null for a new city. */
  save: LoadedSave | null;
}

interface Press {
  x: number;
  y: number;
  pointerType: string;
  /** Movable building under the pointer when the press started, if any. */
  buildingId: number | null;
  /** Set once the press turns into a camera gesture; it is then neither a tap nor a move. */
  cancelled: boolean;
  /** True while this press is dragging a building to a new tile. */
  dragging: boolean;
  longPressTimer: number | undefined;
}

/** A running era change: the environment turns, then buildings transform one by one. */
interface EraTransition {
  startSeconds: number;
  environmentDone: boolean;
  /** Building ids in transformation order (outward from the Town Hall). */
  order: number[];
  /** Index of the next building to transform. */
  next: number;
  staggerSeconds: number;
}

/** How long newly unlocked build tools pulse, in ms. */
const NEW_UNLOCK_HIGHLIGHT_MS = 10_000;

/**
 * The city: owns the game state for the session, runs the fixed-step simulation, turns pointer
 * input into player actions, and keeps the 3D view and DOM UI in sync with the state.
 *
 * Input: a tap selects, places (with a build tool) or moves (in move mode). Dragging a building
 * with the mouse, or long-pressing it on touch, picks it up to move it; any other drag is a
 * camera gesture handled by OrbitControls on the same canvas.
 */
export class CityScreen implements Screen {
  private readonly state: GameState;
  private stage!: Stage;
  private rig!: CameraRig;
  private ground!: GroundView;
  private buildings!: BuildingView;
  private decor!: DecorView;
  private smoke!: SmokeView;
  private citizens!: CitizenView;
  private markers!: TileMarkers;
  private picker!: TilePicker;
  private ui!: CityUI;

  /** Derived view of the city from the latest tick (or player action). */
  private report!: CityReport;
  private problems: CityProblem[] = [];
  private announcedProblems = new Set<ProblemKind>();
  /** Progress already announced, to spot level-ups and finished research. */
  private seenLevel = 1;
  private seenResearchCount = 0;
  private newUnlocks = new Set<BuildingType>();
  private newUnlocksUntil = 0;
  /** Whether "ready for the next era" was already announced for the current era. */
  private announcedEraReady = false;
  /** The era the environment currently shows (lags state.era during a transition). */
  private displayEra: EraId;
  /** Buildings still showing an older era's model during a transition. */
  private readonly eraOverrides = new Map<number, EraId>();
  private transition: EraTransition | null = null;
  private readonly eraOf = (building: Building): EraId => this.eraOverrides.get(building.id) ?? this.state.era;

  private activeTool: BuildingType | null = null;
  private movingBuildingId: number | null = null;
  private selectedTile: TileCoord | null = null;
  private researchOpen = false;
  /** Tile under the pointer, for the placement / move preview. */
  private hoverTile: TileCoord | null = null;
  private press: Press | null = null;
  private readonly activePointers = new Set<number>();
  /** Unsimulated time carried over between frames, in seconds. */
  private accumulator = 0;
  private lastFrame = 0;
  /** Saves run one after another so an older snapshot never overwrites a newer one. */
  private saving: Promise<void> = Promise.resolve();
  private saveErrorShown = false;
  private autosaveTimer: number | undefined;
  /** Epoch ms when the tab was hidden, to credit the gap when it returns. */
  private hiddenAt: number | null = null;

  constructor(
    private readonly viewRoot: HTMLElement,
    private readonly uiRoot: HTMLElement,
    private readonly handlers: CityScreenHandlers,
    private readonly options: CityScreenOptions,
  ) {
    this.state = options.save?.state ?? createInitialState();
    this.displayEra = this.state.era;
  }

  mount(): void {
    const quality = getQualityPreset();
    this.stage = new Stage(this.viewRoot, quality);
    this.ground = new GroundView(this.stage.scene);
    this.buildings = new BuildingView(this.stage.scene);
    this.decor = new DecorView(this.stage.scene);
    this.smoke = new SmokeView(this.stage.scene, quality.smokePuffs);
    this.citizens = new CitizenView(this.stage.scene, quality.renderedCitizens);
    this.markers = new TileMarkers(this.stage.scene);
    this.applyEnvironment(this.state.era);
    this.syncBuildings();
    this.citizens.sync(this.state.citizens);
    audio.playMusic(this.state.era);

    this.rig = new CameraRig(this.stage.camera, this.stage.canvas);
    this.rig.focusArea(getUnlockedArea(this.state.expansionLevel));
    this.picker = new TilePicker(this.stage.camera, this.stage.canvas, this.buildings);

    this.ui = new CityUI(this.uiRoot, {
      onSelectTool: (type) => this.selectTool(type),
      onUpgrade: (buildingId) => this.upgrade(buildingId),
      onMoveBuilding: (buildingId) => this.toggleMove(buildingId),
      onCloseBuildingPanel: () => this.clearSelection(),
      onExpand: () => this.expand(),
      onFocusProblem: (kind) => this.focusProblem(kind),
      onToggleResearch: () => this.toggleResearch(),
      onStartResearch: (id) => this.beginResearch(id),
      onAdvanceEra: () => this.advance(),
      onShowEra: () => this.showTownHall(),
      onOpenMenu: () => this.exitToMenu(),
    });
    this.seenLevel = this.state.cityLevel;
    this.seenResearchCount = this.state.research.completed.length;
    // A resumed city earns resources for the time it was closed.
    const save = this.options.save;
    const offline = save ? applyOfflineProgress(this.state, (Date.now() - save.savedAt) / 1000) : null;
    this.recomputeReport();
    this.updateProblems(false);
    this.refreshUI();
    if (offline && offline.awaySeconds >= OFFLINE.minReportSeconds) this.ui.showOfflineReport(offline);
    // Claim the slot right away and keep it current.
    void this.save();
    this.autosaveTimer = window.setInterval(() => void this.save(), SAVE.autosaveSeconds * 1000);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pagehide', this.onPageHide);

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
    this.clearLongPress();
    window.clearInterval(this.autosaveTimer);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    this.rig.dispose();
    this.markers.dispose();
    this.ground.dispose();
    this.buildings.dispose();
    this.decor.dispose();
    this.smoke.dispose();
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
      this.report = tickSimulation(this.state, SIMULATION.tickSeconds);
      this.accumulator -= SIMULATION.tickSeconds;
      ticked = true;
    }
    if (ticked) {
      this.citizens.sync(this.state.citizens);
      this.updateProblems(true);
      this.announceProgress();
      // Gold changes over time, so a preview can flip between valid and invalid.
      this.updatePreview();
      this.refreshUI();
    }

    const seconds = now / 1000;
    this.updateTransition(seconds);
    this.citizens.render(this.accumulator / SIMULATION.tickSeconds, seconds);
    this.buildings.animate(seconds);
    this.smoke.animate(seconds);
    this.rig.update();
    this.stage.render();
  };

  // --- Saving and time away ----------------------------------------------------------------

  /** Queues a save of the current state to this city's slot. */
  private save(): Promise<void> {
    this.saving = this.saving
      .then(() => saveSlot(this.options.slot, this.state))
      .catch(() => {
        if (this.saveErrorShown) return;
        this.saveErrorShown = true;
        this.ui.showMessage('Could not save the game in this browser');
      });
    return this.saving;
  }

  private exitToMenu(): void {
    void this.save().finally(() => this.handlers.onExit());
  }

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) {
      this.hiddenAt = Date.now();
      void this.save();
      return;
    }
    if (this.hiddenAt !== null) {
      const away = (Date.now() - this.hiddenAt) / 1000;
      this.hiddenAt = null;
      this.catchUp(away);
    }
  };

  private readonly onPageHide = (): void => {
    void this.save();
  };

  /**
   * Credits time the page was hidden (animation frames stop then). Short gaps are simulated
   * normally; longer ones count as time away: resources only, with a report.
   */
  private catchUp(seconds: number): void {
    if (seconds >= OFFLINE.minReportSeconds) {
      this.ui.showOfflineReport(applyOfflineProgress(this.state, seconds));
    } else {
      for (let t = 0; t + SIMULATION.tickSeconds <= seconds; t += SIMULATION.tickSeconds) {
        this.report = tickSimulation(this.state, SIMULATION.tickSeconds);
      }
    }
    this.accumulator = 0;
    this.lastFrame = performance.now();
    this.citizens.sync(this.state.citizens);
    this.recomputeReport();
    this.updateProblems(false);
    this.announceProgress();
    this.refreshUI();
  }

  // --- Input -------------------------------------------------------------------------------

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.activePointers.add(event.pointerId);
    if (this.activePointers.size > 1) {
      // A second finger means pinch/twist: never a tap, and it drops a building being dragged.
      this.abortPress();
      return;
    }
    if (event.button !== 0) {
      this.press = null;
      return;
    }

    const building =
      this.activeTool || this.movingBuildingId !== null
        ? null
        : this.picker.pickBuilding(event.clientX, event.clientY);
    const movable = building !== null && BUILDINGS[building.type].movable;
    this.press = {
      x: event.clientX,
      y: event.clientY,
      pointerType: event.pointerType,
      buildingId: movable ? building.id : null,
      cancelled: false,
      dragging: false,
      longPressTimer: undefined,
    };
    if (!movable) return;

    if (event.pointerType === 'mouse') {
      // A mouse drag that starts on a building moves the building instead of panning.
      this.rig.controls.enabled = false;
    } else {
      this.press.longPressTimer = window.setTimeout(() => this.beginDrag(), CAMERA.longPressMs);
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const press = this.press;
    if (press) {
      if (press.dragging) {
        this.hoverTile = this.picker.pick(event.clientX, event.clientY);
        this.updatePreview();
        return;
      }
      const travelled = Math.hypot(event.clientX - press.x, event.clientY - press.y);
      if (travelled <= CAMERA.dragThresholdPx || press.cancelled) return;
      if (press.buildingId !== null && press.pointerType === 'mouse') {
        this.beginDrag();
        this.hoverTile = this.picker.pick(event.clientX, event.clientY);
        this.updatePreview();
        return;
      }
      // Moved before a long press completed: it's a camera pan.
      press.cancelled = true;
      this.clearLongPress();
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
    if (!press) return;
    this.clearLongPress();
    this.press = null;
    this.rig.controls.enabled = true;

    const tile = this.picker.pick(event.clientX, event.clientY);
    if (press.dragging) this.commitMove(tile, false);
    else if (!press.cancelled) this.handleTap(tile);
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId);
    this.abortPress();
  };

  private readonly onPointerLeave = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse' || this.press) return;
    this.hoverTile = null;
    this.updatePreview();
  };

  private readonly onResize = (): void => {
    this.stage.resize();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    this.cancelTool();
    this.cancelMove();
  };

  /** Picks up the pressed building: the press now drags it to a new tile. */
  private beginDrag(): void {
    const press = this.press;
    if (!press || press.buildingId === null || press.cancelled) return;
    press.dragging = true;
    this.rig.controls.enabled = false;
    this.movingBuildingId = press.buildingId;
    if (press.pointerType !== 'mouse') {
      navigator.vibrate?.(15);
      this.hoverTile = this.picker.pick(press.x, press.y);
    }
    this.updatePreview();
    this.refreshUI();
  }

  private abortPress(): void {
    const press = this.press;
    if (!press) return;
    this.clearLongPress();
    press.cancelled = true;
    if (press.dragging) this.cancelMove();
    this.press = null;
    this.rig.controls.enabled = true;
  }

  private clearLongPress(): void {
    if (this.press?.longPressTimer !== undefined) {
      window.clearTimeout(this.press.longPressTimer);
      this.press.longPressTimer = undefined;
    }
  }

  // --- Actions -----------------------------------------------------------------------------

  private handleTap(tile: TileCoord | null): void {
    if (this.movingBuildingId !== null) {
      this.commitMove(tile, true);
      return;
    }

    if (this.activeTool) {
      if (!tile) return;
      const result = placeBuilding(this.state, this.activeTool, tile.col, tile.row);
      if (result.ok) {
        this.onCityChanged();
        this.popBuilding(getBuildingAt(this.state, tile.col, tile.row)?.id);
        audio.play('place');
      } else this.fail(ACTION_ERROR_MESSAGES[result.error]);
      this.hoverTile = tile;
      this.updatePreview();
      this.refreshUI();
      return;
    }

    this.select(tile);
  }

  private select(tile: TileCoord | null): void {
    this.selectedTile = tile;
    this.markers.setSelection(tile);
    // One card at a time: a selected building replaces the research panel.
    if (tile && getBuildingAt(this.state, tile.col, tile.row)) this.researchOpen = false;
    this.refreshUI();
  }

  /**
   * Moves the building being relocated to `tile`. In tap-to-move mode a rejected tile keeps the
   * mode active so the player can try another; a rejected drag simply drops the building.
   */
  private commitMove(tile: TileCoord | null, keepModeOnFailure: boolean): void {
    const buildingId = this.movingBuildingId;
    if (buildingId === null) return;
    if (!tile) {
      if (!keepModeOnFailure) this.cancelMove();
      return;
    }

    const result = moveBuilding(this.state, buildingId, tile.col, tile.row);
    if (result.ok) {
      this.movingBuildingId = null;
      this.selectedTile = tile;
      this.markers.setSelection(tile);
      this.onCityChanged();
      this.popBuilding(buildingId);
      audio.play('move');
    } else {
      this.fail(ACTION_ERROR_MESSAGES[result.error]);
      if (!keepModeOnFailure) this.movingBuildingId = null;
    }
    this.updatePreview();
    this.refreshUI();
  }

  /** A rejected action: say why, with the error sound. */
  private fail(message: string): void {
    audio.play('error');
    this.ui.showMessage(message);
  }

  /** Plays the "pop" on a building that just appeared or changed. */
  private popBuilding(buildingId: number | undefined): void {
    if (buildingId !== undefined) this.buildings.pop(buildingId, performance.now() / 1000);
  }

  /** After the player changes the city: redraw and re-evaluate effects immediately. */
  private onCityChanged(): void {
    this.syncBuildings();
    this.recomputeReport();
    this.updateProblems(true);
    this.announceProgress();
  }

  private recomputeReport(): void {
    this.report = computeCityReport(this.state);
    this.state.resources.power = this.report.powerSupply - this.report.powerDemand;
  }

  private updateProblems(announce: boolean): void {
    this.problems = detectProblems(this.state, this.report);
    const kinds = new Set(this.problems.map((problem) => problem.kind));
    if (announce) {
      const fresh = this.problems.find((problem) => !this.announcedProblems.has(problem.kind));
      if (fresh) this.ui.showMessage(problemText(fresh));
    }
    this.announcedProblems = kinds;
  }

  /** Announces level-ups (highlighting what they unlock) and finished research. */
  private announceProgress(): void {
    const completed = this.state.research.completed;
    if (completed.length > this.seenResearchCount) {
      const latest = completed[completed.length - 1];
      this.seenResearchCount = completed.length;
      this.ui.showMessage(`Research complete: ${RESEARCH[latest].name}`);
      audio.play('research');
      // Its bonuses apply now, not on the next tick.
      this.recomputeReport();
    }

    if (this.state.cityLevel > this.seenLevel) {
      const unlocked: BuildingType[] = [];
      for (let level = this.seenLevel + 1; level <= this.state.cityLevel; level++) {
        unlocked.push(...unlocksAtLevel(level).filter((type) => getUnlockState(type, this.state) === 'available'));
      }
      this.seenLevel = this.state.cityLevel;
      audio.play('levelUp');
      const names = unlocked.map((type) => buildingName(type, this.state.era));
      this.ui.showMessage(
        `City level ${this.state.cityLevel}!${names.length ? ` New: ${names.join(', ')}` : ''}`,
      );
      if (unlocked.length) {
        this.newUnlocks = new Set(unlocked);
        this.newUnlocksUntil = performance.now() + NEW_UNLOCK_HIGHLIGHT_MS;
      }
    }

    const progress = getEraProgress(this.state);
    if (progress?.ready && !this.announcedEraReady) {
      this.announcedEraReady = true;
      this.ui.showMessage(
        `Ready for the ${ERA_SETTINGS[progress.next].name} Era! Visit the ${buildingName('townHall', this.state.era)}.`,
      );
    }
  }

  /** The player's decision to enter the next era: starts the transformation sequence. */
  private advance(): void {
    const from = this.state.era;
    const result = advanceEra(this.state);
    if (!result.ok) {
      this.fail(ERA_ERROR_MESSAGES[result.error]);
      return;
    }
    audio.play('era');
    audio.playMusic(result.era);
    this.announcedEraReady = false;
    this.seenLevel = this.state.cityLevel;
    this.selectedTile = null;
    this.activeTool = null;
    this.movingBuildingId = null;
    this.researchOpen = false;
    this.markers.setSelection(null);
    this.updatePreview();

    // Every building keeps its old look until its turn, outward from the Town Hall.
    const hall = this.state.buildings.find((b) => b.type === 'townHall');
    const order = [...this.state.buildings]
      .sort((a, b) => distance(a, hall) - distance(b, hall))
      .map((building) => building.id);
    for (const id of order) this.eraOverrides.set(id, from);
    this.transition = {
      startSeconds: performance.now() / 1000,
      environmentDone: false,
      order,
      next: 0,
      staggerSeconds: Math.min(
        ERA_TRANSITION.staggerSeconds,
        ERA_TRANSITION.maxSpreadSeconds / Math.max(1, order.length - 1),
      ),
    };
    this.rig.focusArea(getUnlockedArea(this.state.expansionLevel));
    this.ui.playEraTransition(`${ERA_SETTINGS[result.era].name} Era`, ERA_TAGLINES[result.era]);
    this.onCityChanged();
    this.refreshUI();
  }

  /** Steps the era change sequence; runs every frame. */
  private updateTransition(seconds: number): void {
    const transition = this.transition;
    if (!transition) return;
    const elapsed = seconds - transition.startSeconds;
    if (!transition.environmentDone && elapsed >= ERA_TRANSITION.environmentAtSeconds) {
      transition.environmentDone = true;
      this.applyEnvironment(this.state.era);
    }
    let changed = false;
    while (
      transition.next < transition.order.length &&
      elapsed >= ERA_TRANSITION.buildingsStartSeconds + transition.next * transition.staggerSeconds
    ) {
      const id = transition.order[transition.next++];
      this.eraOverrides.delete(id);
      this.buildings.pop(id, seconds);
      changed = true;
    }
    if (changed) this.syncBuildings();
    if (transition.environmentDone && transition.next >= transition.order.length) {
      this.transition = null;
      this.eraOverrides.clear();
    }
  }

  /** Sky, light, ground, scenery and clothing for an era. */
  private applyEnvironment(era: EraId): void {
    this.displayEra = era;
    this.stage.applyEra(era);
    this.ground.sync(this.state, era);
    this.decor.sync(this.state, era);
    this.citizens.setEra(era);
  }

  private syncBuildings(): void {
    this.buildings.sync(this.state.buildings, this.eraOf);
    this.smoke.sync(this.state.buildings, this.eraOf);
  }

  private showTownHall(): void {
    const hall = this.state.buildings.find((b) => b.type === 'townHall');
    if (!hall) return;
    this.rig.focusTile(hall.col, hall.row);
    this.select({ col: hall.col, row: hall.row });
  }

  /** Auto focus: show where a city problem is. */
  private focusProblem(kind: ProblemKind): void {
    const focus = this.problems.find((problem) => problem.kind === kind)?.focus;
    if (!focus) return;
    this.rig.focusTile(focus.col, focus.row);
    this.select(focus);
  }

  private toggleResearch(): void {
    this.researchOpen = !this.researchOpen;
    if (this.researchOpen) {
      this.selectedTile = null;
      this.markers.setSelection(null);
    }
    this.refreshUI();
  }

  private beginResearch(id: ResearchId): void {
    const result = startResearch(this.state, id);
    if (result.ok) audio.play('select');
    else this.fail(RESEARCH_ERROR_MESSAGES[result.error]);
    this.refreshUI();
  }

  private updatePreview(): void {
    const tile = this.hoverTile;
    if (tile && this.activeTool) {
      const valid = validatePlacement(this.state, this.activeTool, tile.col, tile.row) === null;
      this.markers.showPreview(this.activeTool, 1, this.state.era, tile, valid);
      return;
    }
    const moving = this.movingBuilding();
    if (tile && moving) {
      const valid = validateMove(this.state, moving.id, tile.col, tile.row) === null;
      this.markers.showPreview(moving.type, moving.level, this.state.era, tile, valid);
      return;
    }
    this.markers.hidePreview();
  }

  private movingBuilding(): Building | undefined {
    return this.movingBuildingId === null
      ? undefined
      : this.state.buildings.find((b) => b.id === this.movingBuildingId);
  }

  private selectTool(type: BuildingType): void {
    this.activeTool = this.activeTool === type ? null : type;
    this.movingBuildingId = null;
    this.selectedTile = null;
    this.markers.setSelection(null);
    this.newUnlocks.delete(type);
    this.updatePreview();
    this.refreshUI();
  }

  private cancelTool(): void {
    this.activeTool = null;
    this.updatePreview();
    this.refreshUI();
  }

  /** Panel "Move" button: enter tap-to-move mode for the building, or leave it. */
  private toggleMove(buildingId: number): void {
    this.activeTool = null;
    this.movingBuildingId = this.movingBuildingId === buildingId ? null : buildingId;
    this.updatePreview();
    this.refreshUI();
  }

  private cancelMove(): void {
    this.movingBuildingId = null;
    this.updatePreview();
    this.refreshUI();
  }

  private upgrade(buildingId: number): void {
    const result = upgradeBuilding(this.state, buildingId);
    if (result.ok) {
      this.onCityChanged();
      this.popBuilding(buildingId);
      audio.play('upgrade');
    } else this.fail(ACTION_ERROR_MESSAGES[result.error]);
    this.refreshUI();
  }

  private expand(): void {
    const result = expandTerritory(this.state);
    if (result.ok) {
      this.ground.sync(this.state, this.displayEra);
      this.decor.sync(this.state, this.displayEra);
      audio.play('expand');
      // Auto focus: frame the newly unlocked territory.
      this.rig.focusArea(getUnlockedArea(this.state.expansionLevel));
      this.announceProgress();
    } else {
      this.fail(ACTION_ERROR_MESSAGES[result.error]);
    }
    this.refreshUI();
  }

  private clearSelection(): void {
    this.selectedTile = null;
    this.movingBuildingId = null;
    this.markers.setSelection(null);
    this.updatePreview();
    this.refreshUI();
  }

  // --- View --------------------------------------------------------------------------------

  private buildOptions(): BuildOption[] {
    if (performance.now() > this.newUnlocksUntil) this.newUnlocks.clear();
    return BUILDABLE_TYPES.map((type) => ({
      type,
      name: buildingName(type, this.state.era),
      cost: getBuildCost(type, this.state.era),
      unlock: getUnlockState(type, this.state),
      requiredLevel: BUILDINGS[type].cityLevel,
      isNew: this.newUnlocks.has(type),
    }));
  }

  private cityInfo(progress: EraProgress | null): CityInfo {
    const level = this.state.cityLevel;
    return {
      level,
      xp: this.state.cityXp,
      xpToNext: isMaxLevel(level) ? null : xpToNextLevel(level),
      nextUnlocks: unlocksAtLevel(level + 1)
        .filter((type) => getUnlockState(type, { ...this.state, cityLevel: level + 1 }) === 'available')
        .map((type) => buildingName(type, this.state.era)),
      era: this.eraInfo(progress),
    };
  }

  private eraInfo(progress: EraProgress | null): EraInfo {
    return {
      current: ERA_SETTINGS[this.state.era].name,
      next: progress ? ERA_SETTINGS[progress.next].name : null,
      requirements: (progress?.requirements ?? []).map((requirement) => ({
        met: requirement.met,
        text: eraRequirementText(requirement),
      })),
      ready: progress?.ready ?? false,
    };
  }

  private researchView(): ResearchPanelView {
    const state = this.state;
    const cards: ResearchCard[] = [];
    for (const id of RESEARCH_IDS) {
      const status = getResearchStatus(state, id);
      if (status === 'laterEra') continue;
      const definition = RESEARCH[id];
      cards.push({
        id,
        name: definition.name,
        description: definition.description,
        eraName: ERA_SETTINGS[definition.era].name,
        cost: definition.cost,
        status,
        progress: state.research.active?.id === id ? state.research.active.progress / definition.points : 0,
        missing: definition.requires
          .filter((required) => !state.research.completed.includes(required))
          .map((required) => RESEARCH[required].name),
      });
    }
    return {
      open: this.researchOpen,
      canResearch: hasResearchBuilding(state),
      buildingName: buildingName('researchCenter', state.era),
      pointsPerSecond: this.report.researchPerSecond,
      gold: state.resources.gold,
      busy: state.research.active !== null,
      cards,
    };
  }

  private hintText(): string | null {
    if (this.activeTool) {
      return `Tap a tile to place a ${buildingName(this.activeTool, this.state.era)}. Tap the button again to stop.`;
    }
    const moving = this.movingBuilding();
    if (moving) return `Tap a tile to move the ${buildingName(moving.type, this.state.era)}.`;
    return null;
  }

  private refreshUI(): void {
    const selectedBuilding = this.selectedTile
      ? (getBuildingAt(this.state, this.selectedTile.col, this.selectedTile.row) ?? null)
      : null;
    const active = this.state.research.active;
    const eraProgress = getEraProgress(this.state);
    this.ui.update({
      resources: this.state.resources,
      era: this.state.era,
      buildOptions: this.buildOptions(),
      activeTool: this.activeTool,
      selectedBuilding,
      selectedOccupancy: selectedBuilding ? getOccupancy(this.state, selectedBuilding) : null,
      selectedReport: selectedBuilding ? (this.report.buildings.get(selectedBuilding.id) ?? null) : null,
      city: selectedBuilding?.type === 'townHall' ? this.cityInfo(eraProgress) : null,
      movingBuildingId: this.movingBuildingId,
      problems: this.problems,
      research: this.researchView(),
      researchProgress: active ? active.progress / RESEARCH[active.id].points : null,
      eraReady: eraProgress?.ready ? ERA_SETTINGS[eraProgress.next].name : null,
      expansionCost: getExpansionCost(this.state.expansionLevel),
      hint: this.hintText(),
    });
  }
}

function distance(building: Building, from: Building | undefined): number {
  return from ? Math.hypot(building.col - from.col, building.row - from.row) : 0;
}
