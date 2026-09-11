import * as Phaser from 'phaser';
import { SCENE_KEYS } from '../config/gameConfig';
import { createPlaceholderTextures } from '../rendering/placeholderTextures';

/** Prepares shared resources, then hands off to the main menu. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  create(): void {
    createPlaceholderTextures(this);
    this.scene.start(SCENE_KEYS.menu);
  }
}
