import type { EraId } from '../progression/era';

/**
 * Central place for tunable presentation/engine constants. Gameplay balance numbers live in
 * `balance.ts`. Code must read values from here instead of hard-coding magic numbers.
 */

/** World grid dimensions in tiles. In the 3D view one tile is one world unit. */
export const WORLD = {
  cols: 36,
  rows: 36,
} as const;

export const SIMULATION = {
  /** Fixed simulation step, in seconds. */
  tickSeconds: 0.25,
  /**
   * Longest frame gap that is simulated in real time. Longer gaps (e.g. a background tab) are
   * dropped here; offline production handles them separately.
   */
  maxCatchUpSeconds: 1,
} as const;

export const CAMERA = {
  /** Angle between the view direction and straight down; atan(√2) is classic isometric. */
  polarAngle: Math.atan(Math.SQRT2),
  /** Initial compass angle of the camera around the city. */
  azimuth: Math.PI / 4,
  /** Camera distance from its target (orthographic, so this only affects clipping). */
  distance: 40,
  /** Screen pixels per world unit (one tile) at zoom 1. */
  pixelsPerTile: 48,
  minZoom: 0.4,
  maxZoom: 4,
  /** Share of the viewport the territory fills when the camera auto-focuses on it. */
  fitRatio: 0.8,
  /** Tighter fit in portrait, where the narrow width limits how much of the city shows. */
  fitRatioPortrait: 0.95,
  /** Height (world units) assumed for buildings when fitting the camera to an area. */
  fitHeight: 1.2,
  /** Pointer travel (screen px) before a press counts as a camera drag rather than a tap. */
  dragThresholdPx: 8,
  /** World units panned per wheel/trackpad pixel at zoom 1. */
  wheelPanPerPixel: 1,
  /** Zoom change per pinch (ctrl+wheel) pixel. */
  pinchZoomPerPixel: 0.01,
  /** Touch: holding a building this long picks it up for moving. */
  longPressMs: 450,
} as const;

export const SCENE_3D = {
  /** Height of the tile surface that buildings and citizens stand on. */
  tileTop: 0.1,
} as const;

/** Sky, light and ground colours per era (design brief §12: eras transform the whole city). */
export interface EraLook {
  sky: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  sunColor: number;
  sunIntensity: number;
  grass: number;
  grassAlt: number;
  locked: number;
  lockedAlt: number;
  /** Rocky ridges (see world/terrain.ts). */
  mountain: number;
  /** Citizen clothing. */
  shirts: readonly number[];
  /** Share of locked tiles with a tree or rock. */
  decorDensity: number;
}

export const ERA_LOOK: Record<EraId, EraLook> = {
  ancient: {
    sky: 0xa8d8ea,
    hemiSky: 0xeaf6ff,
    hemiGround: 0x55663a,
    hemiIntensity: 1.2,
    sunColor: 0xfff0d8,
    sunIntensity: 2.4,
    grass: 0x7cb85a,
    grassAlt: 0x74b052,
    locked: 0x3e4a3a,
    lockedAlt: 0x39443a,
    mountain: 0x6b655c,
    shirts: [0x9b6b3f, 0xb58a52, 0x7a8a4a, 0xc9a26b, 0x8a5a3a],
    decorDensity: 0.55,
  },
  medieval: {
    sky: 0xb4d4e8,
    hemiSky: 0xf0f4ff,
    hemiGround: 0x5a5f45,
    hemiIntensity: 1.15,
    sunColor: 0xffe9c9,
    sunIntensity: 2.3,
    grass: 0x86b865,
    grassAlt: 0x7eaf5d,
    locked: 0x4a4d3c,
    lockedAlt: 0x44473a,
    mountain: 0x6f6a60,
    shirts: [0x3a6fb0, 0xb04a3a, 0x5a8a4a, 0x8a5aa0, 0xd9b43a],
    decorDensity: 0.4,
  },
  modern: {
    sky: 0x9fd4ef,
    hemiSky: 0xf4fbff,
    hemiGround: 0x5b6b5a,
    hemiIntensity: 1.25,
    sunColor: 0xfff6e8,
    sunIntensity: 2.5,
    grass: 0x7fb96b,
    grassAlt: 0x77b163,
    locked: 0x46503f,
    lockedAlt: 0x414a3c,
    mountain: 0x6d6a64,
    shirts: [0x2f6fd0, 0xe0533f, 0x2fa46a, 0x7a52c8, 0xf0a72a],
    decorDensity: 0.35,
  },
  industrial: {
    sky: 0xc9c3b6,
    hemiSky: 0xf3ead8,
    hemiGround: 0x5c5446,
    hemiIntensity: 1.1,
    sunColor: 0xffd9a8,
    sunIntensity: 2.2,
    grass: 0x8fa86a,
    grassAlt: 0x86a063,
    locked: 0x514c42,
    lockedAlt: 0x4b463d,
    mountain: 0x6a6459,
    shirts: [0x3b3f4a, 0x5a4a3a, 0x2f4a6a, 0x6a6a6a, 0x8a3a3a],
    decorDensity: 0.25,
  },
};

/**
 * The era change sequence (design brief §12): flash, the environment turns, then buildings
 * transform one after another outward from the Town Hall, under a new-era banner.
 */
export const ERA_TRANSITION = {
  /** When the sky, ground and scenery switch (hidden by the flash). */
  environmentAtSeconds: 0.45,
  /** When the first building transforms. */
  buildingsStartSeconds: 0.9,
  /** Delay between consecutive buildings... */
  staggerSeconds: 0.12,
  /** ...compressed so that a big city still finishes within this spread. */
  maxSpreadSeconds: 2.4,
  flashMs: 900,
  bannerMs: 3600,
} as const;

/** Save games (IndexedDB). */
export const SAVE = {
  slots: 3,
  autosaveSeconds: 30,
  dbName: 'pixel-civilization',
  dbVersion: 1,
  storeName: 'saves',
} as const;

/** Generative WebAudio music and synthesized sound effects. */
export const AUDIO = {
  defaultMusicVolume: 0.5,
  defaultSfxVolume: 0.7,
  /** Mix levels applied on top of the player's volumes. */
  musicMix: 0.32,
  sfxMix: 0.8,
  /** Music is scheduled this far ahead of the audio clock, by a timer running this often. */
  lookaheadSeconds: 0.3,
  schedulerIntervalMs: 60,
  /** Fade out/in when the music changes (e.g. a new era). */
  crossfadeSeconds: 1.2,
  /** The same sound effect is not retriggered faster than this. */
  sfxMinIntervalSeconds: 0.04,
} as const;

/**
 * The city's own clock. Nights are part of watching it grow: windows light up and the streets
 * pick up lamps (Phase 2 §1.1).
 */
export const DAY_NIGHT = {
  /** Seconds for one full day. */
  daySeconds: 300,
  /** Time of day (0..1) when the lights come on and go off again. */
  duskAt: 0.7,
  dawnAt: 0.22,
  /** How long dusk and dawn take, as a share of the day. */
  twilight: 0.06,
  /** Share of daylight left at the darkest point. */
  nightLight: 0.3,
  nightSky: 0x1b2740,
  /** Warm colour of lit windows and street lamps. */
  lampColor: 0xffd79a,
  /** Brightest the lamps get. */
  lampOpacity: 0.9,
} as const;

/** Cars and trains that keep the streets moving (see render3d/TrafficView.ts). */
export const TRAFFIC = {
  maxVehicles: 40,
  /** Road tiles needed per car, and rail tiles before a train appears. */
  tilesPerCar: 3,
  tilesPerTrain: 4,
  /** Tiles per second. */
  carSpeed: [0.5, 0.9] as const,
  trainSpeed: 1.4,
  carColors: [0xf2f2f2, 0x4a6fa5, 0xc8553d, 0x3f7f5a, 0x6a6a72, 0xe0b23a] as const,
  trainColor: 0xb0472f,
} as const;

/** Chimney smoke: puffs rise, drift with the wind, swell and fade. */
export const SMOKE = {
  lifetimeSeconds: 3.2,
  riseSpeed: 0.32,
  drift: [0.12, -0.05] as const,
  startScale: 0.5,
  peakScale: 1.6,
  color: 0xd9d6d0,
  opacity: 0.55,
} as const;

export type QualityLevel = 'high' | 'medium' | 'low';

/** Presentation-only settings per quality level; the simulation is identical at every level. */
export interface QualityPreset {
  antialias: boolean;
  /** Upper bound for the device pixel ratio used when rendering. */
  maxPixelRatio: number;
  /** Shadow map resolution; 0 disables shadows. */
  shadowMapSize: number;
  /** Simulated citizens drawn on screen (the simulation always runs CITIZENS.maxSimulated). */
  renderedCitizens: number;
  /** Smoke puffs alive per chimney. */
  smokePuffs: number;
  /** Vehicles on the streets at once. */
  vehicles: number;
}

export const QUALITY: Record<QualityLevel, QualityPreset> = {
  high: { antialias: true, maxPixelRatio: 2, shadowMapSize: 2048, renderedCitizens: 50, smokePuffs: 6, vehicles: 40 },
  medium: { antialias: true, maxPixelRatio: 1.5, shadowMapSize: 1024, renderedCitizens: 35, smokePuffs: 4, vehicles: 24 },
  low: { antialias: false, maxPixelRatio: 1, shadowMapSize: 0, renderedCitizens: 20, smokePuffs: 2, vehicles: 10 },
};

/** Adaptive quality ("Auto"): step down a preset when the frame rate stays low. */
export const AUTO_QUALITY = {
  /** Average the frame rate over windows of this length. */
  sampleSeconds: 4,
  downgradeBelowFps: 40,
  /** Longer gaps (a hidden tab, a hitch) are not frames worth measuring. */
  maxFrameGapSeconds: 0.25,
  /** Windows ignored at the start, while shaders compile. */
  warmupSamples: 1,
} as const;

/** Selection frame and placement preview drawn on tiles. */
export const MARKERS = {
  selection: 0xffe27a,
  frameThickness: 0.05,
  frameHeight: 0.03,
  previewValid: 0x7cff7c,
  previewInvalid: 0xff5a5a,
  previewOpacity: 0.45,
  ghostOpacity: 0.6,
} as const;

export const CITIZEN_3D = {
  /** Walking bob: height in world units and speed in radians per second. */
  bobHeight: 0.03,
  bobSpeed: 14,
  /** Mood marker (a small spinning diamond) above the head of happy / unhappy citizens. */
  moodMarkerHeight: 0.34,
  moodMarkerSize: 0.035,
  moodSpinSpeed: 2,
  moodHappy: 0x6fd36f,
  moodUnhappy: 0xe0524a,
} as const;

export const UI = {
  toastDurationMs: 1800,
} as const;
