import * as Phaser from 'phaser';
import type { BuildingType } from '../building/types';
import { COLORS, DEPTH, LEVEL_PIPS, TEXTURE_KEYS, WORLD } from '../config/gameConfig';
import type { GameState } from '../simulation/gameState';
import { isUnlocked } from '../world/territory';

const BUILDING_TEXTURES: Record<BuildingType, string> = {
  townHall: TEXTURE_KEYS.townHall,
  house: TEXTURE_KEYS.house,
  shop: TEXTURE_KEYS.shop,
  park: TEXTURE_KEYS.park,
};

export interface TileCoord {
  col: number;
  row: number;
}

/** Draws the game state (tiles, buildings, selection, placement preview). Holds no game logic. */
export class WorldView {
  private readonly tiles: Phaser.GameObjects.Image[] = [];
  private readonly buildingSprites = new Map<number, Phaser.GameObjects.Image>();
  private readonly levelPips = new Map<number, Phaser.GameObjects.Graphics>();
  private readonly selectionFrame: Phaser.GameObjects.Rectangle;
  private readonly previewSprite: Phaser.GameObjects.Image;
  private readonly previewFrame: Phaser.GameObjects.Rectangle;

  constructor(private readonly scene: Phaser.Scene) {
    const size = WORLD.tileSize;
    for (let row = 0; row < WORLD.rows; row++) {
      for (let col = 0; col < WORLD.cols; col++) {
        this.tiles.push(
          scene.add
            .image(col * size, row * size, TEXTURE_KEYS.tileGround)
            .setOrigin(0)
            .setDepth(DEPTH.tiles),
        );
      }
    }

    this.selectionFrame = scene.add
      .rectangle(0, 0, size, size)
      .setOrigin(0)
      .setStrokeStyle(2, COLORS.selection)
      .setDepth(DEPTH.selection)
      .setVisible(false);

    this.previewSprite = scene.add
      .image(0, 0, TEXTURE_KEYS.house)
      .setOrigin(0)
      .setAlpha(0.6)
      .setDepth(DEPTH.preview)
      .setVisible(false);
    this.previewFrame = scene.add
      .rectangle(0, 0, size, size)
      .setOrigin(0)
      .setDepth(DEPTH.preview)
      .setVisible(false);
  }

  static get worldWidth(): number {
    return WORLD.cols * WORLD.tileSize;
  }

  static get worldHeight(): number {
    return WORLD.rows * WORLD.tileSize;
  }

  worldToTile(x: number, y: number): TileCoord {
    return { col: Math.floor(x / WORLD.tileSize), row: Math.floor(y / WORLD.tileSize) };
  }

  syncTerritory(state: GameState): void {
    for (const tile of this.tiles) {
      const { col, row } = this.worldToTile(tile.x, tile.y);
      tile.setTexture(isUnlocked(state, col, row) ? TEXTURE_KEYS.tileGround : TEXTURE_KEYS.tileLocked);
    }
  }

  syncBuildings(state: GameState): void {
    const size = WORLD.tileSize;
    const alive = new Set<number>();

    for (const building of state.buildings) {
      alive.add(building.id);
      const x = building.col * size;
      const y = building.row * size;

      let sprite = this.buildingSprites.get(building.id);
      if (!sprite) {
        sprite = this.scene.add
          .image(0, 0, BUILDING_TEXTURES[building.type])
          .setOrigin(0)
          .setDepth(DEPTH.buildings);
        this.buildingSprites.set(building.id, sprite);
      }
      sprite.setPosition(x, y);

      this.syncLevelPips(building.id, building.level, x, y);
    }

    for (const [id, sprite] of this.buildingSprites) {
      if (!alive.has(id)) {
        sprite.destroy();
        this.buildingSprites.delete(id);
        this.levelPips.get(id)?.destroy();
        this.levelPips.delete(id);
      }
    }
  }

  /** One gold pixel pip per level along the tile's bottom-left edge, shown from level 2 upward. */
  private syncLevelPips(buildingId: number, level: number, tileX: number, tileY: number): void {
    let pips = this.levelPips.get(buildingId);
    if (level <= 1) {
      pips?.destroy();
      this.levelPips.delete(buildingId);
      return;
    }
    if (!pips) {
      pips = this.scene.add.graphics().setDepth(DEPTH.levelPips);
      this.levelPips.set(buildingId, pips);
    }

    const { size, gap, margin } = LEVEL_PIPS;
    const y = tileY + WORLD.tileSize - margin - size;
    pips.clear();
    for (let i = 0; i < level; i++) {
      const x = tileX + margin + i * (size + gap);
      pips.fillStyle(COLORS.levelPipOutline).fillRect(x, y, size, size);
      pips.fillStyle(COLORS.levelPip).fillRect(x + 1, y + 1, size - 2, size - 2);
    }
  }

  setSelection(tile: TileCoord | null): void {
    if (!tile) {
      this.selectionFrame.setVisible(false);
      return;
    }
    this.selectionFrame
      .setPosition(tile.col * WORLD.tileSize, tile.row * WORLD.tileSize)
      .setVisible(true);
  }

  showPreview(type: BuildingType, tile: TileCoord, valid: boolean): void {
    const x = tile.col * WORLD.tileSize;
    const y = tile.row * WORLD.tileSize;
    this.previewSprite.setTexture(BUILDING_TEXTURES[type]).setPosition(x, y).setVisible(true);
    this.previewFrame
      .setPosition(x, y)
      .setStrokeStyle(2, valid ? COLORS.previewValid : COLORS.previewInvalid)
      .setVisible(true);
  }

  hidePreview(): void {
    this.previewSprite.setVisible(false);
    this.previewFrame.setVisible(false);
  }
}
