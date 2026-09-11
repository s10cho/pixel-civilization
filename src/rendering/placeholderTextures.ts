import type * as Phaser from 'phaser';
import { CITIZEN_VIEW, COLORS, TEXTURE_KEYS, WORLD } from '../config/gameConfig';

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

  g.clear();
  g.fillStyle(COLORS.parkGrass);
  g.fillRect(2, 2, size - 4, size - 4);
  g.fillStyle(COLORS.parkTreeTrunk);
  g.fillRect(half - 1, half + 2, 3, 7);
  g.fillStyle(COLORS.parkTreeLeaves);
  g.fillCircle(half, half, 8);
  g.fillStyle(COLORS.parkFlower);
  g.fillRect(6, size - 9, 2, 2);
  g.fillRect(size - 9, size - 7, 2, 2);
  g.fillRect(size - 8, 7, 2, 2);
  g.generateTexture(TEXTURE_KEYS.park, size, size);

  const mood = CITIZEN_VIEW.moodIconSize;
  g.clear();
  g.fillStyle(COLORS.moodHappy);
  g.fillRect(0, 0, mood, mood);
  g.generateTexture(TEXTURE_KEYS.moodHappy, mood, mood);
  g.clear();
  g.fillStyle(COLORS.moodUnhappy);
  g.fillRect(0, 0, mood, mood);
  g.generateTexture(TEXTURE_KEYS.moodUnhappy, mood, mood);

  const { width: cw, height: ch } = CITIZEN_VIEW;
  g.clear();
  g.fillStyle(COLORS.citizenSkin);
  g.fillRect(1, 0, cw - 2, 3);
  g.fillStyle(COLORS.citizenShirt);
  g.fillRect(0, 3, cw, 4);
  g.fillStyle(COLORS.citizenLegs);
  g.fillRect(1, 7, 1, ch - 7);
  g.fillRect(cw - 2, 7, 1, ch - 7);
  g.generateTexture(TEXTURE_KEYS.citizen, cw, ch);

  g.destroy();
}
