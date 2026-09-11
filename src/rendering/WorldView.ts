import * as Phaser from 'phaser';
import type { BuildingType } from '../building/types';
import { CAMERA, COLORS, DEPTH, TEXTURE_KEYS, UI, WORLD } from '../config/gameConfig';
import type { GameState } from '../simulation/gameState';
import { isUnlocked } from '../world/territory';

const BUILDING_TEXTURES: Record<BuildingType, string> = {
  townHall: TEXTURE_KEYS.townHall,
  house: TEXTURE_KEYS.house,
  shop: TEXTURE_KEYS.shop,
};

export interface TileCoord {
  col: number;
  row: number;
}

/** Draws the game state (tiles, buildings, selection, placement preview). Holds no game logic. */
export class WorldView {
  private readonly tiles: Phaser.GameObjects.Image[] = [];
  private readonly buildingSprites = new Map<number, Phaser.GameObjects.Image>();
  private readonly levelLabels = new Map<number, Phaser.GameObjects.Text>();
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

      this.syncLevelLabel(building.id, building.level, x + size - 1, y + 1);
    }

    for (const [id, sprite] of this.buildingSprites) {
      if (!alive.has(id)) {
        sprite.destroy();
        this.buildingSprites.delete(id);
        this.levelLabels.get(id)?.destroy();
        this.levelLabels.delete(id);
      }
    }
  }

  /** Small level badge in the tile's top-right corner, shown from level 2 upward. */
  private syncLevelLabel(buildingId: number, level: number, x: number, y: number): void {
    let label = this.levelLabels.get(buildingId);
    if (level <= 1) {
      label?.destroy();
      this.levelLabels.delete(buildingId);
      return;
    }
    if (!label) {
      label = this.scene.add
        .text(0, 0, '', {
          fontFamily: UI.fontFamily,
          fontSize: '9px',
          color: COLORS.textPrimary,
          backgroundColor: COLORS.background,
          padding: { x: 1, y: 0 },
        })
        .setOrigin(1, 0)
        .setResolution(CAMERA.maxZoom)
        .setDepth(DEPTH.buildingLabels);
      this.levelLabels.set(buildingId, label);
    }
    label.setText(String(level)).setPosition(x, y);
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
