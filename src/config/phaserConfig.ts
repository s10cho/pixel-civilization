import * as Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { MenuScene } from '../scenes/MenuScene';
import { CityScene } from '../scenes/CityScene';
import { COLORS } from './gameConfig';

export function createPhaserConfig(parent: string): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: COLORS.background,
    pixelArt: true,
    roundPixels: true,
    scale: {
      // Canvas always fills the parent element; scenes re-layout on the resize event.
      mode: Phaser.Scale.RESIZE,
      width: '100%',
      height: '100%',
    },
    scene: [BootScene, MenuScene, CityScene],
  };
}
