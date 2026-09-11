/**
 * Central place for tunable presentation/engine constants. Gameplay balance numbers live in
 * `balance.ts`. Code must read values from here instead of hard-coding magic numbers.
 */

export const SCENE_KEYS = {
  boot: 'BootScene',
  menu: 'MenuScene',
  city: 'CityScene',
} as const;

export const TEXTURE_KEYS = {
  tileGround: 'placeholder-tile-ground',
  tileLocked: 'placeholder-tile-locked',
  townHall: 'placeholder-town-hall',
  house: 'placeholder-house',
  shop: 'placeholder-shop',
} as const;

/** World grid dimensions (in tiles) and tile size (in pixels). */
export const WORLD = {
  tileSize: 32,
  cols: 24,
  rows: 24,
} as const;

export const CAMERA = {
  minZoom: 0.5,
  maxZoom: 4,
  /** Zoom multiplier per wheel delta unit: zoom *= exp(-deltaY * factor). */
  wheelZoomFactor: 0.0015,
  /** Pointer travel (screen px) before a press becomes a camera drag instead of a tap. */
  dragThresholdPx: 8,
  /** Fraction of the screen the unlocked territory should fill when the city opens. */
  initialFitRatio: 0.9,
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

/** Render order of world layers. */
export const DEPTH = {
  tiles: 0,
  buildings: 10,
  buildingLabels: 15,
  selection: 20,
  preview: 30,
} as const;

export const COLORS = {
  background: '#1b1f2a',
  tileGround: 0x5a8f3c,
  tileGroundEdge: 0x4a7a31,
  tileLocked: 0x2c3528,
  tileLockedEdge: 0x252d22,
  townHall: 0xc98b4a,
  townHallRoof: 0x8a4b2a,
  houseWall: 0xd9c7a0,
  houseRoof: 0x4a78b5,
  shopWall: 0xe0b85a,
  shopAwning: 0xb5484a,
  previewValid: 0x7cff7c,
  previewInvalid: 0xff5a5a,
  selection: 0xffe27a,
  buttonFill: 0x2e3648,
  buttonFillHover: 0x3d4760,
  buttonFillDisabled: 0x23293a,
  buttonStroke: 0xe8d8a8,
  textPrimary: '#f4ecd0',
  textMuted: '#8a8fa0',
} as const;

export const UI = {
  fontFamily: 'monospace',
  titleFontSize: 40,
  bodyFontSize: 16,
  buttonWidth: 200,
  buttonHeight: 44,
  buttonGap: 14,
  hudMargin: 12,
  toastDurationMs: 1800,
} as const;
