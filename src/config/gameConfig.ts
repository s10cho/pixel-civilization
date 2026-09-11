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
  park: 'placeholder-park',
  citizen: 'placeholder-citizen',
  moodHappy: 'placeholder-mood-happy',
  moodUnhappy: 'placeholder-mood-unhappy',
} as const;

export const CITIZEN_VIEW = {
  width: 6,
  height: 10,
  /** Feet are drawn this many pixels below the tile position so citizens stand on the ground. */
  footOffsetPx: 8,
  moodIconSize: 3,
  /** Gap between the top of the head and the mood icon. */
  moodGapPx: 2,
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
  citizens: 12,
  levelPips: 15,
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
  citizenSkin: 0xf2c9a0,
  citizenShirt: 0x3a6fb0,
  citizenLegs: 0x3b3340,
  parkGrass: 0x7fb24a,
  parkTreeLeaves: 0x2f6b2f,
  parkTreeTrunk: 0x6b4a2a,
  parkFlower: 0xf2d35b,
  moodHappy: 0x6fd36f,
  moodUnhappy: 0xe0524a,
  previewValid: 0x7cff7c,
  previewInvalid: 0xff5a5a,
  selection: 0xffe27a,
  levelPip: 0xf7d51d,
  levelPipOutline: 0x1b1f2a,
} as const;

/** Building level indicator: a row of small square pips (world pixels). */
export const LEVEL_PIPS = {
  size: 4,
  gap: 1,
  margin: 2,
} as const;

export const UI = {
  toastDurationMs: 1800,
} as const;
