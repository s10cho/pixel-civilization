/**
 * Central place for tunable presentation/engine constants. Gameplay balance numbers live in
 * `balance.ts`. Code must read values from here instead of hard-coding magic numbers.
 */

/** World grid dimensions in tiles. In the 3D view one tile is one world unit. */
export const WORLD = {
  cols: 24,
  rows: 24,
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
  /** Height (world units) assumed for buildings when fitting the camera to an area. */
  fitHeight: 1.2,
  /** Pointer travel (screen px) before a press counts as a camera drag rather than a tap. */
  dragThresholdPx: 8,
  /** Touch: holding a building this long picks it up for moving. */
  longPressMs: 450,
} as const;

export const SCENE_3D = {
  background: 0xa8d8ea,
  /** Height of the tile surface that buildings and citizens stand on. */
  tileTop: 0.1,
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
}

export const QUALITY: Record<QualityLevel, QualityPreset> = {
  high: { antialias: true, maxPixelRatio: 2, shadowMapSize: 2048, renderedCitizens: 50 },
  medium: { antialias: true, maxPixelRatio: 1.5, shadowMapSize: 1024, renderedCitizens: 35 },
  low: { antialias: false, maxPixelRatio: 1, shadowMapSize: 0, renderedCitizens: 20 },
};

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
  shirtColors: [0x3a6fb0, 0xd9743a, 0x5aa05a, 0xb04a8a, 0xd9b43a],
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
