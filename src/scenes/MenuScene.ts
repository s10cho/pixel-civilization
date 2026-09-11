import * as Phaser from 'phaser';
import { SCENE_KEYS, TEXTURE_KEYS } from '../config/gameConfig';
import { getUiRoot } from '../ui/dom';
import { MainMenuUI } from '../ui/MainMenuUI';

/** Title screen: a dimmed ground pattern behind the DOM menu. */
export class MenuScene extends Phaser.Scene {
  private background!: Phaser.GameObjects.TileSprite;
  private ui!: MainMenuUI;

  constructor() {
    super(SCENE_KEYS.menu);
  }

  create(): void {
    const { width, height } = this.scale.gameSize;
    this.background = this.add
      .tileSprite(0, 0, width, height, TEXTURE_KEYS.tileGround)
      .setOrigin(0)
      .setAlpha(0.18);

    this.ui = new MainMenuUI(getUiRoot(), {
      onNewGame: () => this.scene.start(SCENE_KEYS.city),
    });

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.ui.destroy();
    });
  }

  private onResize(gameSize: Phaser.Structs.Size): void {
    this.background.setSize(gameSize.width, gameSize.height);
  }
}
