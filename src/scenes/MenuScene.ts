import * as Phaser from 'phaser';
import { COLORS, SCENE_KEYS, UI } from '../config/gameConfig';
import { TextButton } from '../ui/TextButton';

/** Main menu. Only "New Game" is wired up in Milestone 0; the rest are placeholders. */
export class MenuScene extends Phaser.Scene {
  private content!: Phaser.GameObjects.Container;

  constructor() {
    super(SCENE_KEYS.menu);
  }

  create(): void {
    const title = this.add
      .text(0, -150, 'Pixel Civilization', {
        fontFamily: UI.fontFamily,
        fontSize: `${UI.titleFontSize}px`,
        color: COLORS.textPrimary,
      })
      .setOrigin(0.5);

    const step = UI.buttonHeight + UI.buttonGap;
    const buttons = [
      new TextButton(this, 0, -40, { label: 'Continue', enabled: false }),
      new TextButton(this, 0, -40 + step, {
        label: 'New Game',
        onClick: () => this.scene.start(SCENE_KEYS.city),
      }),
      new TextButton(this, 0, -40 + step * 2, { label: 'Settings', enabled: false }),
      new TextButton(this, 0, -40 + step * 3, { label: 'Credits', enabled: false }),
    ];

    this.content = this.add.container(0, 0, [title, ...buttons]);

    this.layout(this.scale.gameSize);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
  }

  private layout(gameSize: Phaser.Structs.Size): void {
    // Shrink the menu on narrow (portrait mobile) screens so the title never overflows.
    const naturalWidth = this.content.getBounds().width / this.content.scaleX;
    const scale = Math.min(1, (gameSize.width - UI.hudMargin * 2) / naturalWidth);
    this.content.setScale(scale);
    this.content.setPosition(Math.round(gameSize.width / 2), Math.round(gameSize.height / 2));
  }
}
