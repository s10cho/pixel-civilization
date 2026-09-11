import * as Phaser from 'phaser';
import { COLORS, UI } from '../config/gameConfig';

export interface TextButtonOptions {
  label: string;
  width?: number;
  height?: number;
  enabled?: boolean;
  onClick?: () => void;
}

/** Minimal placeholder button: a filled rectangle with a centered label. */
export class TextButton extends Phaser.GameObjects.Container {
  private readonly background: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, x: number, y: number, options: TextButtonOptions) {
    super(scene, x, y);

    const width = options.width ?? UI.buttonWidth;
    const height = options.height ?? UI.buttonHeight;
    const enabled = options.enabled ?? true;

    this.background = scene.add
      .rectangle(0, 0, width, height, enabled ? COLORS.buttonFill : COLORS.buttonFillDisabled)
      .setStrokeStyle(2, COLORS.buttonStroke, enabled ? 1 : 0.3);

    const text = scene.add
      .text(0, 0, options.label, {
        fontFamily: UI.fontFamily,
        fontSize: `${UI.bodyFontSize}px`,
        color: enabled ? COLORS.textPrimary : COLORS.textMuted,
      })
      .setOrigin(0.5);

    this.add([this.background, text]);
    this.setSize(width, height);

    if (enabled && options.onClick) {
      const onClick = options.onClick;
      this.background
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.background.setFillStyle(COLORS.buttonFillHover))
        .on('pointerout', () => this.background.setFillStyle(COLORS.buttonFill))
        .on('pointerup', onClick);
    }

    scene.add.existing(this);
  }

  /**
   * Always applies the scroll factor to children too. Input hit-testing uses each child's own
   * scroll factor, and Phaser's `updateChildren` flag skips children whose scroll factor is still
   * inherited from the prototype, leaving screen-fixed buttons unclickable once the camera scrolls.
   */
  override setScrollFactor(x: number, y: number = x): this {
    super.setScrollFactor(x, y);
    for (const child of this.list) {
      (child as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor(x, y);
    }
    return this;
  }
}
