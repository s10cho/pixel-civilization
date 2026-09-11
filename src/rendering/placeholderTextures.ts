import type * as Phaser from 'phaser';
import { COLORS, TEXTURE_KEYS, WORLD } from '../config/gameConfig';

/**
 * Generates procedural placeholder textures so early milestones need no asset files.
 * Will be replaced by real pixel-art sprites during asset polish.
 */
export function createPlaceholderTextures(scene: Phaser.Scene): void {
  const size = WORLD.tileSize;
  const half = size / 2;
  const g = scene.add.graphics();

  const tile = (key: string, edge: number, fill: number): void => {
    g.clear();
    g.fillStyle(edge);
    g.fillRect(0, 0, size, size);
    g.fillStyle(fill);
    g.fillRect(1, 1, size - 2, size - 2);
    g.generateTexture(key, size, size);
  };
  tile(TEXTURE_KEYS.tileGround, COLORS.tileGroundEdge, COLORS.tileGround);
  tile(TEXTURE_KEYS.tileLocked, COLORS.tileLockedEdge, COLORS.tileLocked);

  g.clear();
  g.fillStyle(COLORS.townHall);
  g.fillRect(4, half, size - 8, half - 2);
  g.fillStyle(COLORS.townHallRoof);
  g.fillTriangle(2, half, half, 4, size - 2, half);
  g.generateTexture(TEXTURE_KEYS.townHall, size, size);

  g.clear();
  g.fillStyle(COLORS.houseWall);
  g.fillRect(8, half, size - 16, half - 4);
  g.fillStyle(COLORS.houseRoof);
  g.fillTriangle(5, half, half, 8, size - 5, half);
  g.generateTexture(TEXTURE_KEYS.house, size, size);

  g.clear();
  g.fillStyle(COLORS.shopWall);
  g.fillRect(6, 12, size - 12, size - 16);
  g.fillStyle(COLORS.shopAwning);
  g.fillRect(4, 10, size - 8, 5);
  g.generateTexture(TEXTURE_KEYS.shop, size, size);

  g.destroy();
}
