import { audio } from '../audio/AudioEngine';
import { BUILDABLE_TYPES, getBuildCost, getUnlockState } from '../building/rules';
import type { Building, BuildingType } from '../building/types';
import { clearRoutes } from '../citizen/behavior';
import { getOccupancy } from '../citizen/occupancy';
import {
  AUTO_GROW,
  AUTO_LEVELS,
  BUILDINGS,
  GROWTH_PACE,
  OFFLINE,
  PROJECTS,
  type AutoLevel,
  type ProjectKind,
} from '../config/balance';
import { AUTO_QUALITY, CAMERA, ERA_TRANSITION, QUALITY, SAVE, SIMULATION, type QualityLevel } from '../config/gameConfig';
import { RESEARCH, RESEARCH_IDS, type ResearchId } from '../config/research';
import { getAdvice } from '../consulting/advice';
import { applyProposal, getProposals, type Proposal } from '../consulting/proposals';
import { computeCityReport, type CityReport } from '../economy/cityReport';
import { t, tKey } from '../i18n';
import { buildingName, eraName, eraTagline, researchDescription, researchName } from '../i18n/names';
import { detectProblems, type CityProblem, type ProblemKind } from '../economy/problems';
import type { EraId } from '../progression/era';
import { checkAchievements, getAchievements, type AchievementUnlock } from '../progression/achievements';
import { getCityHistory } from '../progression/cityHistory';
import { advanceEra, getEraProgress, type EraProgress } from '../progression/eraProgress';
import { isMaxLevel, unlocksAtLevel, xpToNextLevel } from '../progression/level';
import { getResearchStatus, hasResearchBuilding, startResearch } from '../progression/research';
import { BuildingView } from '../render3d/BuildingView';
import { CameraRig } from '../render3d/CameraRig';
import { CitizenView } from '../render3d/CitizenView';
import type { TileCoord } from '../render3d/coords';
import { ConstructionView } from '../render3d/ConstructionView';
import { DecorView } from '../render3d/DecorView';
import { NightLightsView } from '../render3d/NightLightsView';
import { TrafficLightsView } from '../render3d/TrafficLightsView';
import { TrafficView } from '../render3d/TrafficView';
import { GroundView } from '../render3d/GroundView';
import { FrameRateMonitor, lowerQuality, resolveQualityLevel } from '../render3d/quality';
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
import { planAutoAction, type AutoAction } from '../simulation/autoGrow';
import { maybeTriggerEvent, type CityEvent } from '../simulation/events';
import {
  advanceProjects,
  isProjectUnlocked,
  planProject,
  startProject,
  type Project,
} from '../simulation/projects';
import { applyOfflineProgress } from '../simulation/offline';
import { tickSimulation } from '../simulation/tick';
import { saveSlot, type LoadedSave } from '../storage/saveStore';
import type { BuildOption } from '../ui/BuildBar';
import { formatAmount } from '../ui/format';
import type { CityInfo, EraInfo } from '../ui/BuildingPanel';
import { CityUI } from '../ui/CityUI';
import { actionErrorText, eraErrorText, eraRequirementText, problemText, researchErrorText } from '../ui/messages';
import { Modal } from '../ui/Modal';
import type { ResearchCard, ResearchPanelView } from '../ui/ResearchPanel';
import { openAchievements } from '../ui/AchievementsDialog';
import { openHelp } from '../ui/HelpDialog';
import { openConsulting } from '../ui/ConsultingDialog';
import { openExpand } from '../ui/ExpandDialog';
import { openHistory } from '../ui/HistoryDialog';
import { openSettings } from '../ui/SettingsDialog';
import type { TutorialView } from '../ui/TutorialCard';
import { loadPreferences, savePreferences, type Preferences } from '../storage/preferences';
import { Tutorial, TUTORIAL_STEPS, type TutorialEvent } from '../tutorial/tutorial';
import { getBuildingAt } from '../world/placement';
import { packRoadVariant, roadLane } from '../world/roads';
import { isMountain } from '../world/terrain';
import {
  canExpand,
  expansionOptions,
  getExpansionCost,
  getUnlockedArea,
  type Direction,
  type TileRect,
} from '../world/territory';
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

/** Gap between achievement messages when several land at once, in ms. */
const ACHIEVEMENT_TOAST_GAP_MS = 2200;

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
  private construction!: ConstructionView;
  private lights!: NightLightsView;
  private traffic!: TrafficView;
  private signals!: TrafficLightsView;
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
  private readonly eraOf = (building: Building): EraId =>
    // Mid-transition every building shows its old self; afterwards, kept quarters stay old.
    this.eraOverrides.get(building.id) ??
    (building.heritage ? (building.builtEra ?? this.state.era) : this.state.era);
  /** Roads take their shape and lanes from the roads around them. */
  private readonly variantOf = (building: Building): number =>
    building.type === 'road' ? packRoadVariant(roadLane(this.state, building.col, building.row)) : 0;

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
  /** The simulation stands still while the pause menu is open. */
  private paused = false;
  private pauseModal: Modal | null = null;
  private settingsModal: Modal | null = null;
  private qualityLevel: QualityLevel = 'high';
  private autoQuality = false;
  private readonly frameRate = new FrameRateMonitor();
  /** First-time guidance for a new city, while it runs. */
  private tutorial: Tutorial | null = null;
  private helpModal: Modal | null = null;
  private achievementsModal: Modal | null = null;
  private historyModal: Modal | null = null;
  private consultingModal: Modal | null = null;
  private expandModal: Modal | null = null;
  /** Seconds since the advisor's last action. */
  private autoGrowSeconds = 0;
  /** The level the top-bar button switches back to. */
  private lastAutoLevel: AutoLevel = 'medium';

  constructor(
    private readonly viewRoot: HTMLElement,
    private readonly uiRoot: HTMLElement,
    private readonly handlers: CityScreenHandlers,
    private readonly options: CityScreenOptions,
  ) {
    this.state = options.save?.state ?? createInitialState();
    this.displayEra = this.state.era;
    if (!options.save && !loadPreferences().tutorialDone) this.tutorial = new Tutorial();
  }

  mount(): void {
    const { level, auto } = resolveQualityLevel();
    this.qualityLevel = level;
    this.autoQuality = auto;
    const quality = QUALITY[level];
    this.stage = new Stage(this.viewRoot, quality);
    this.ground = new GroundView(this.stage.scene);
    this.buildings = new BuildingView(this.stage.scene);
    this.decor = new DecorView(this.stage.scene);
    this.smoke = new SmokeView(this.stage.scene, quality.smokePuffs);
    this.construction = new ConstructionView(this.stage.scene);
    this.lights = new NightLightsView(this.stage.scene);
    this.traffic = new TrafficView(this.stage.scene, quality.vehicles);
    this.signals = new TrafficLightsView(this.stage.scene);
    this.citizens = new CitizenView(this.stage.scene, quality.renderedCitizens);
    this.markers = new TileMarkers(this.stage.scene);
    this.applyEnvironment(this.state.era);
    this.syncBuildings();
    this.construction.sync(this.state.projects);
    this.citizens.sync(this.state.citizens);
    audio.playMusic(this.state.era);

    this.rig = new CameraRig(this.stage.camera, this.stage.canvas);
    this.rig.focusArea(getUnlockedArea(this.state));
    this.picker = new TilePicker(this.stage.camera, this.stage.canvas, this.buildings);

    this.ui = this.createUI();
    this.applyPacePreferences();
    this.seenLevel = this.state.cityLevel;
    this.seenResearchCount = this.state.research.completed.length;
    // A resumed city earns resources for the time it was closed.
    const save = this.options.save;
    const seenBuildings = this.state.lastSeen?.buildings ?? null;
    const offline = save ? applyOfflineProgress(this.state, (Date.now() - save.savedAt) / 1000) : null;
    this.recomputeReport();
    this.updateProblems(false);
    this.refreshUI();
    if (offline && offline.awaySeconds >= OFFLINE.minReportSeconds) {
      const actions = this.runOfflineAutoGrow(offline.creditedSeconds);
      const built = seenBuildings === null ? 0 : this.state.buildings.length - seenBuildings;
      this.ui.showOfflineReport(offline, actions, built);
    }
    // A first-time player sees the controls before anything else.
    if (!loadPreferences().helpSeen) {
      this.helpModal = openHelp(this.uiRoot, () => {
        savePreferences({ helpSeen: true });
        this.helpModal = null;
      });
    }
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
    this.settingsModal?.close();
    this.pauseModal?.close();
    this.helpModal?.close();
    this.achievementsModal?.close();
    this.historyModal?.close();
    this.consultingModal?.close();
    this.expandModal?.close();
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
    this.construction.dispose();
    this.lights.dispose();
    this.traffic.dispose();
    this.signals.dispose();
    this.citizens.dispose();
    this.ui.destroy();
    // Removing the canvas also drops its pointer listeners.
    this.stage.dispose();
  }
  private readonly frame = (now: number): void => {
    // rAF timestamps can precede the performance.now() taken at mount, so never step backwards.
    const frameSeconds = Math.max(0, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    if (!this.paused) {
      const step = Math.min(frameSeconds, SIMULATION.maxCatchUpSeconds);
      this.accumulator += step;
      if (this.state.autoLevel !== 'off') this.autoGrowSeconds += step;
    }
    if (this.autoQuality) this.adaptQuality(frameSeconds);
    let ticked = false;
    while (this.accumulator >= SIMULATION.tickSeconds) {
      this.report = tickSimulation(this.state, SIMULATION.tickSeconds);
      const event = maybeTriggerEvent(this.state, this.report, SIMULATION.tickSeconds);
      if (event) this.announceEvent(event);
      const finished = advanceProjects(this.state, SIMULATION.tickSeconds);
      if (finished.length > 0) this.completeProjects(finished);
      this.accumulator -= SIMULATION.tickSeconds;
      ticked = true;
    }
    const advisorInterval = this.advisorIntervalSeconds();
    while (this.state.autoLevel !== 'off' && this.autoGrowSeconds >= advisorInterval) {
      this.autoGrowSeconds -= advisorInterval;
      this.runAutoAction(true);
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
    // The hour of the day: the sky dims and the city lights up.
    this.stage.applyTimeOfDay(this.state.timeOfDay);
    this.lights.setDarkness(Stage.darknessAt(this.state.timeOfDay));
    this.traffic.animate(frameSeconds, this.state.timeOfDay, this.state.citizens);
    this.signals.animate(this.state.timeOfDay);
    this.updateTransition(seconds);
    this.citizens.render(this.accumulator / SIMULATION.tickSeconds, seconds);
    this.buildings.animate(seconds);
    this.smoke.animate(seconds);
    this.rig.update();
    this.stage.render();
  };

  private createUI(): CityUI {
      return new CityUI(this.uiRoot, {
        onSelectTool: (type) => this.selectTool(type),
        onUpgrade: (buildingId) => this.upgrade(buildingId),
        onMoveBuilding: (buildingId) => this.toggleMove(buildingId),
        onToggleHeritage: (buildingId) => this.toggleHeritage(buildingId),
        onCloseBuildingPanel: () => this.clearSelection(),
        onExpand: () => this.expand(),
        onFocusProblem: (kind) => this.focusProblem(kind),
        onToggleResearch: () => this.toggleResearch(),
        onStartResearch: (id) => this.beginResearch(id),
        onAdvanceEra: () => this.advance(),
        onShowEra: () => this.showTownHall(),
        onOpenMenu: () => this.openPause(),
        onTutorialNext: () => this.advanceTutorial(),
        onTutorialSkip: () => this.finishTutorial(),
        onToggleAutoGrow: () => this.toggleAutoGrow(),
        onOpenAchievements: () => this.openAchievementsDialog(),
        onOpenConsulting: () => this.openConsultingDialog(),
      });
  }

  /** Rebuilds the DOM UI (e.g. after a language change), keeping the city untouched. */
  rebuildUI(): void {
    this.ui.destroy();
    this.ui = this.createUI();
    this.refreshUI();
  }

  // --- Saving and time away ----------------------------------------------------------------

  /** Queues a save of the current state to this city's slot. */
  private save(): Promise<void> {
    // Snapshot for the welcome-back summary next time.
    this.state.lastSeen = {
      at: Date.now(),
      population: Math.floor(this.state.resources.population),
      buildings: this.state.buildings.length,
      gold: Math.floor(this.state.resources.gold),
    };
    this.saving = this.saving
      .then(() => saveSlot(this.options.slot, this.state))
      .catch(() => {
        if (this.saveErrorShown) return;
        this.saveErrorShown = true;
  this.ui.showMessage(t('toast.saveFailed'));
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
      const offline = applyOfflineProgress(this.state, seconds);
      this.ui.showOfflineReport(offline, this.runOfflineAutoGrow(offline.creditedSeconds));
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
        this.notifyTutorial({ kind: 'placed', type: this.activeTool });
      } else this.fail(actionErrorText(result.error));
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
    const building = tile ? getBuildingAt(this.state, tile.col, tile.row) : undefined;
    if (building) {
      this.researchOpen = false;
      audio.play('select');
      this.notifyTutorial({ kind: 'selected', type: building.type });
    }
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
      this.fail(actionErrorText(result.error));
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
    // The streets may have moved: let everyone find their way again.
    clearRoutes(this.state);
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

  /** Announces level-ups (highlighting what they unlock), finished research and milestones. */
  private announceProgress(): void {
    const unlocked = checkAchievements(this.state);
    if (unlocked.length > 0) this.announceAchievements(unlocked);
    const completed = this.state.research.completed;
    if (completed.length > this.seenResearchCount) {
      const latest = completed[completed.length - 1];
      this.seenResearchCount = completed.length;
      this.ui.showMessage(t('toast.researchComplete', { name: researchName(latest) }));
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
        names.length
          ? t('toast.levelUpNew', { level: this.state.cityLevel, names: names.join(', ') })
          : t('toast.levelUp', { level: this.state.cityLevel }),
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
        t('toast.eraReady', {
          era: eraName(progress.next),
          building: buildingName('townHall', this.state.era),
        }),
      );
    }
  }

  /** Milestones the city just passed, announced one after another. */
  private announceAchievements(unlocked: readonly AchievementUnlock[]): void {
    audio.play('levelUp');
    unlocked.forEach((achievement, index) => {
      const name = tKey(`achievement.${achievement.id}.name`);
      const text = achievement.rewardGold
        ? t('toast.achievementReward', { name, gold: formatAmount(achievement.rewardGold) })
        : t('toast.achievement', { name });
      // Space them out so each one is readable.
      if (index === 0) this.ui.showMessage(text);
      else window.setTimeout(() => this.ui.showMessage(text), index * ACHIEVEMENT_TOAST_GAP_MS);
    });
  }

  /** AI consulting: what the city looks like from outside, and a few plans to choose from. */
  private openConsultingDialog(): void {
    if (this.consultingModal?.isOpen) return;
    audio.play('select');
    this.consultingModal = openConsulting(
      this.uiRoot,
      {
        advice: getAdvice(this.state, this.report),
        proposals: getProposals(this.state, this.report),
        projects: this.projectOffers(),
        building: this.state.projects.map((project) => ({
          kind: project.kind,
          progress: Math.min(1, project.progress / project.work),
        })),
        era: this.state.era,
        gold: this.state.resources.gold,
      },
      {
        onShow: (focus) => {
          this.consultingModal?.close();
    this.expandModal?.close();
          this.rig.focusTile(focus.col, focus.row);
          this.select(focus);
        },
        onApply: (proposal) => this.acceptProposal(proposal),
        onStartProject: (kind) => this.commissionProject(kind),
      },
    );
  }

  /** Large works the city could commission right now. */
  private projectOffers(): { kind: ProjectKind; tiles: number; cost: number }[] {
    const offers: { kind: ProjectKind; tiles: number; cost: number }[] = [];
    for (const kind of Object.keys(PROJECTS) as ProjectKind[]) {
      if (!isProjectUnlocked(this.state, kind)) continue;
      if (this.state.projects.some((project) => project.kind === kind)) continue;
      const plan = planProject(this.state, kind);
      if (plan) offers.push({ kind, tiles: plan.tiles.length, cost: plan.cost });
    }
    return offers;
  }

  private commissionProject(kind: ProjectKind): void {
    this.consultingModal?.close();
    const plan = planProject(this.state, kind);
    if (!plan || !startProject(this.state, plan)) {
      this.fail(t('consult.tooExpensive'));
      return;
    }
    audio.play('expand');
    this.construction.sync(this.state.projects);
    this.ui.showMessage(t('consult.started', { name: tKey(`project.${kind}.name`) }));
    this.rig.focusTile(plan.tiles[0].col, plan.tiles[0].row);
    this.refreshUI();
  }

  /** A project has finished: the city gets its railway, tunnel or park. */
  private completeProjects(finished: readonly Project[]): void {
    this.onCityChanged();
    this.ground.sync(this.state, this.displayEra);
    this.decor.sync(this.state, this.displayEra);
    this.construction.sync(this.state.projects);
    audio.play('levelUp');
    for (const project of finished) {
      this.ui.showMessage(t('consult.finished', { name: tKey(`project.${project.kind}.name`) }));
      for (const tile of project.tiles) this.popBuilding(getBuildingAt(this.state, tile.col, tile.row)?.id);
    }
    this.refreshUI();
  }

  /** Carries out a plan the player accepted. */
  private acceptProposal(proposal: Proposal): void {
    this.consultingModal?.close();
    this.expandModal?.close();
    if (this.state.resources.gold < proposal.cost) {
      this.fail(t('consult.tooExpensive'));
      return;
    }
    const result = applyProposal(this.state, proposal);
    if (result.expanded) {
      this.onTerritoryChanged();
      this.ui.showMessage(t('consult.expanded'));
    }
    if (result.built > 0) {
      this.onCityChanged();
      for (const step of proposal.steps) {
        this.popBuilding(getBuildingAt(this.state, step.col, step.row)?.id);
      }
      audio.play('place');
      this.ui.showMessage(t('consult.done', { count: result.built }));
      if (proposal.anchor) this.rig.focusTile(proposal.anchor.col, proposal.anchor.row);
    }
    this.refreshUI();
  }

  private openHistoryDialog(): void {
    if (this.historyModal?.isOpen) return;
    audio.play('select');
    this.historyModal = openHistory(this.uiRoot, getCityHistory(this.state));
  }

  private openAchievementsDialog(): void {
    if (this.achievementsModal?.isOpen) return;
    audio.play('select');
    this.achievementsModal = openAchievements(this.uiRoot, getAchievements(this.state));
  }

  /** A small gift from the world: a merchant, a harvest, a festival, a passing scholar. */
  private announceEvent(event: CityEvent): void {
    audio.play('levelUp');
    this.ui.showMessage(
      tKey(`event.${event.id}`, {
        gold: formatAmount(event.gold ?? 0),
        count: event.citizens ?? 0,
        points: event.research ?? 0,
      }),
    );
  }

  /** The player's decision to enter the next era: starts the transformation sequence. */
  private advance(): void {
    const from = this.state.era;
    const result = advanceEra(this.state);
    if (!result.ok) {
      this.fail(eraErrorText(result.error));
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
    this.rig.focusArea(getUnlockedArea(this.state));
    this.ui.playEraTransition(eraName(result.era), eraTagline(result.era));
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
    this.buildings.sync(this.state.buildings, this.eraOf, this.variantOf);
    this.smoke.sync(this.state.buildings, this.eraOf);
    this.lights.sync(this.state.buildings);
    this.traffic.sync(this.state.buildings);
    this.signals.sync(this.state.buildings);
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
    else this.fail(researchErrorText(result.error));
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
    if (this.activeTool === type) this.notifyTutorial({ kind: 'toolSelected', type });
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

  /** Keeps a building in its own era, or lets it modernise with the rest of the city. */
  private toggleHeritage(buildingId: number): void {
    const building = this.state.buildings.find((candidate) => candidate.id === buildingId);
    if (!building) return;
    building.heritage = !building.heritage;
    building.builtEra ??= this.state.era;
    this.syncBuildings();
    this.popBuilding(buildingId);
    audio.play('select');
    this.ui.showMessage(t(building.heritage ? 'toast.heritageOn' : 'toast.heritageOff'));
    this.refreshUI();
  }

  private upgrade(buildingId: number): void {
    const result = upgradeBuilding(this.state, buildingId);
    if (result.ok) {
      this.onCityChanged();
      this.popBuilding(buildingId);
      audio.play('upgrade');
    } else this.fail(actionErrorText(result.error));
    this.refreshUI();
  }

  /** Expanding asks which way to grow: the shape of the city is the player's decision. */
  private expand(): void {
    if (this.expandModal?.isOpen) return;
    const options = expansionOptions(this.state);
    if (options.length === 0) {
      this.fail(actionErrorText('maxExpansion'));
      return;
    }
    const sides = [...options]
      .sort((a, b) => b.tiles - a.tiles)
      .map((option, index) => ({
        direction: option.direction,
        tiles: option.tiles,
        buildable: buildableTiles(this.state, option.band),
        recommended: index === 0,
      }));
    audio.play('select');
    this.expandModal = openExpand(
      this.uiRoot,
      { cost: getExpansionCost(this.state.expansionLevel), gold: this.state.resources.gold, sides },
      (direction) => {
        this.expandModal?.close();
        this.growTowards(direction);
      },
    );
  }

  private growTowards(direction: Direction): void {
    const result = expandTerritory(this.state, direction);
    if (result.ok) {
      this.onTerritoryChanged();
      this.ui.showMessage(t('expand.done', { where: tKey(`where.${direction}`) }));
    } else {
      this.fail(actionErrorText(result.error));
    }
    this.refreshUI();
  }

  /** Redraws the map after the territory grew and frames the new land. */
  private onTerritoryChanged(): void {
    this.ground.sync(this.state, this.displayEra);
    this.decor.sync(this.state, this.displayEra);
    audio.play('expand');
    // Auto focus: frame the newly unlocked territory.
    this.rig.focusArea(getUnlockedArea(this.state));
    this.announceProgress();
  }

  private clearSelection(): void {
    this.selectedTile = null;
    this.movingBuildingId = null;
    this.markers.setSelection(null);
    this.updatePreview();
    this.refreshUI();
  }

  // --- Auto-grow ---------------------------------------------------------------------------

  /** How long the advisor waits between actions, given the pace and automation level. */
  private advisorIntervalSeconds(): number {
    return (
      AUTO_GROW.intervalSeconds *
      GROWTH_PACE[this.state.growthPace].advisorInterval *
      AUTO_LEVELS[this.state.autoLevel].intervalMultiplier
    );
  }

  /**
   * The top-bar button switches the advisor off and back on at its chosen level; the level
   * itself is picked in Settings, and both places save the same preference.
   */
  private toggleAutoGrow(): void {
    if (this.state.autoLevel !== 'off') this.lastAutoLevel = this.state.autoLevel;
    this.state.autoLevel = this.state.autoLevel === 'off' ? this.lastAutoLevel : 'off';
    savePreferences({ autoLevel: this.state.autoLevel });
    this.autoGrowSeconds = 0;
    audio.play('select');
    this.ui.showMessage(t(this.state.autoLevel === 'off' ? 'auto.disabled' : 'auto.enabled'));
    this.refreshUI();
  }

  /**
   * Applies the growth pace and automation level from Settings to this city. Callers refresh
   * the UI themselves, since this also runs during mount before the first report exists.
   */
  private applyPacePreferences(): void {
    const preferences = loadPreferences();
    this.state.growthPace = preferences.growthPace;
    this.state.autoLevel = preferences.autoLevel;
    if (preferences.autoLevel !== 'off') this.lastAutoLevel = preferences.autoLevel;
    this.autoGrowSeconds = 0;
  }

  /** Carries out one advisor action, if it has something worth doing. */
  private runAutoAction(announce: boolean): boolean {
    const action = planAutoAction(this.state, this.report);
    if (!action) return false;
    const done = this.applyAutoAction(action, announce);
    if (done && announce) this.refreshUI();
    return done;
  }

  private applyAutoAction(action: AutoAction, announce: boolean): boolean {
    const era = this.state.era;
    switch (action.kind) {
      case 'build': {
        if (!placeBuilding(this.state, action.type, action.col, action.row).ok) return false;
        this.onCityChanged();
        if (announce) {
          this.popBuilding(getBuildingAt(this.state, action.col, action.row)?.id);
          audio.play('place');
          this.ui.showMessage(t('auto.built', { building: buildingName(action.type, era) }));
        }
        return true;
      }
      case 'upgrade': {
        const type = this.state.buildings.find((b) => b.id === action.buildingId)?.type;
        if (!upgradeBuilding(this.state, action.buildingId).ok || !type) return false;
        this.onCityChanged();
        if (announce) {
          this.popBuilding(action.buildingId);
          audio.play('upgrade');
          this.ui.showMessage(t('auto.upgraded', { building: buildingName(type, era) }));
        }
        return true;
      }
      case 'expand': {
        if (!expandTerritory(this.state, action.direction).ok) return false;
        if (announce) {
          this.onTerritoryChanged();
          this.ui.showMessage(t('auto.expanded'));
        }
        return true;
      }
      case 'research': {
        if (!startResearch(this.state, action.id).ok) return false;
        if (announce) {
          audio.play('select');
          this.ui.showMessage(t('auto.research', { name: researchName(action.id) }));
        }
        return true;
      }
    }
  }

  /** A few advisor actions for the time the player was away, silently. */
  private runOfflineAutoGrow(creditedSeconds: number): number {
    if (this.state.autoLevel === 'off') return 0;
    const allowed = Math.min(
      AUTO_GROW.maxOfflineActions,
      Math.floor(creditedSeconds / this.advisorIntervalSeconds()),
    );
    let done = 0;
    for (let i = 0; i < allowed; i++) {
      this.recomputeReport();
      if (!this.runAutoAction(false)) break;
      done++;
    }
    if (done > 0) {
      this.onCityChanged();
      this.ground.sync(this.state, this.displayEra);
      this.decor.sync(this.state, this.displayEra);
    }
    return done;
  }

  private openHelpDialog(): void {
    if (this.helpModal?.isOpen) return;
    this.helpModal = openHelp(this.uiRoot, () => {
      savePreferences({ helpSeen: true });
      this.helpModal = null;
    });
  }

  // --- Pause, settings, quality, tutorial --------------------------------------------------

  private openPause(): void {
    if (this.pauseModal?.isOpen) return;
    this.paused = true;
    this.cancelTool();
    this.cancelMove();
    this.pauseModal = new Modal(this.uiRoot, {
      title: t('pause.title'),
      icon: 'pause',
      body: t('pause.body'),
      actions: [
        { label: t('history.title'), icon: 'clock', keepOpen: true, onClick: () => this.openHistoryDialog() },
        { label: t('menu.help'), icon: 'info', keepOpen: true, onClick: () => this.openHelpDialog() },
        { label: t('pause.settings'), icon: 'settings', keepOpen: true, onClick: () => this.openSettingsDialog() },
        { label: t('pause.saveExit'), icon: 'arrowLeft', variant: 'warning', onClick: () => this.exitToMenu() },
        { label: t('pause.resume'), icon: 'play', variant: 'primary' },
      ],
      onClose: () => {
        this.paused = false;
        this.pauseModal = null;
      },
    });
  }

  private openSettingsDialog(): void {
    if (this.settingsModal?.isOpen) return;
    this.settingsModal = openSettings(this.uiRoot, {
      onQualityChange: (quality) => this.setQualityPreference(quality),
      onPaceChange: () => {
        this.applyPacePreferences();
        this.refreshUI();
      },
      onClose: () => {
        this.settingsModal = null;
      },
    });
  }

  private setQualityPreference(quality: Preferences['quality']): void {
    this.autoQuality = quality === 'auto';
    if (quality !== 'auto') this.applyQuality(quality);
  }

  private applyQuality(level: QualityLevel): void {
    this.qualityLevel = level;
    const preset = QUALITY[level];
    this.stage.setQuality(preset);
    this.citizens.setLimit(preset.renderedCitizens);
    this.smoke.setPuffs(preset.smokePuffs);
    this.traffic.setLimit(preset.vehicles);
    this.syncBuildings();
  }

  /** "Auto" quality: step down while the frame rate stays below the target. */
  private adaptQuality(frameSeconds: number): void {
    const fps = this.frameRate.sample(frameSeconds);
    if (fps === null || fps >= AUTO_QUALITY.downgradeBelowFps) return;
    const lower = lowerQuality(this.qualityLevel);
    if (lower) this.applyQuality(lower);
  }

  private notifyTutorial(event: TutorialEvent): void {
    if (!this.tutorial?.notify(event)) return;
    audio.play('select');
    this.refreshUI();
  }

  private advanceTutorial(): void {
    this.tutorial?.next();
    if (this.tutorial?.finished) this.finishTutorial();
    else this.refreshUI();
  }

  private finishTutorial(): void {
    this.tutorial = null;
    savePreferences({ tutorialDone: true });
    this.refreshUI();
  }

  private tutorialView(): TutorialView | null {
    const step = this.tutorial?.step;
    if (!this.tutorial || !step) return null;
    const names = {
      house: buildingName('house', this.state.era),
      shop: buildingName('shop', this.state.era),
      townHall: buildingName('townHall', this.state.era),
    };
    return {
      step: this.tutorial.stepNumber,
      total: TUTORIAL_STEPS.length,
      title: tKey(step.titleKey, names),
      text: tKey(step.textKey, names),
      canContinue: !step.completes,
    };
  }

  // --- View --------------------------------------------------------------------------------

  private buildOptions(): BuildOption[] {
    if (performance.now() > this.newUnlocksUntil) this.newUnlocks.clear();
    return BUILDABLE_TYPES.map((type) => ({
      type,
      category: BUILDINGS[type].category,
      era: this.state.era,
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
      current: this.state.era,
      next: progress?.next ?? null,
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
        name: researchName(id),
        description: researchDescription(id),
        eraName: eraName(definition.era),
        cost: definition.cost,
        status,
        progress: state.research.active?.id === id ? state.research.active.progress / definition.points : 0,
        missing: definition.requires
          .filter((required) => !state.research.completed.includes(required))
          .map((required) => researchName(required)),
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
      return t('hint.place', { building: buildingName(this.activeTool, this.state.era) });
    }
    const moving = this.movingBuilding();
    if (moving) return t('hint.move', { building: buildingName(moving.type, this.state.era) });
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
      eraReady: eraProgress?.ready ? eraProgress.next : null,
      expansionCost: canExpand(this.state) ? getExpansionCost(this.state.expansionLevel) : null,
      hint: this.hintText(),
      tutorial: this.tutorialView(),
      autoLevel: this.state.autoLevel,
      adviceCount: getAdvice(this.state, this.report).length,
    });
  }
}

/** Tiles in a band that are not rocky ground. */
function buildableTiles(state: GameState, band: TileRect): number {
  let total = 0;
  for (let row = band.minRow; row <= band.maxRow; row++) {
    for (let col = band.minCol; col <= band.maxCol; col++) {
      if (!isMountain(state, col, row)) total++;
    }
  }
  return total;
}

function distance(building: Building, from: Building | undefined): number {
  return from ? Math.hypot(building.col - from.col, building.row - from.row) : 0;
}
