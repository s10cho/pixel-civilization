import type * as Phaser from 'phaser';
import { isCitizenOutside } from '../citizen/behavior';
import type { Citizen } from '../citizen/types';
import { CITIZEN_VIEW, DEPTH, TEXTURE_KEYS, WORLD } from '../config/gameConfig';
import { getMood } from '../economy/happiness';

interface CitizenSprite {
  sprite: Phaser.GameObjects.Image;
  /** Small icon above the head for happy / unhappy citizens; hidden when neutral. */
  mood: Phaser.GameObjects.Image;
  /** Position (tile units) at the previous simulation tick. */
  fromX: number;
  fromY: number;
  /** Position (tile units) at the latest simulation tick. */
  toX: number;
  toY: number;
}

/**
 * Draws citizens who are outside. Simulation ticks at a fixed rate, so sprites are interpolated
 * between the last two ticked positions for smooth movement at any frame rate.
 */
export class CitizenView {
  private readonly entries = new Map<number, CitizenSprite>();

  constructor(private readonly scene: Phaser.Scene) {}

  /** Call after each simulation tick. */
  sync(citizens: readonly Citizen[]): void {
    const alive = new Set<number>();

    for (const citizen of citizens) {
      alive.add(citizen.id);
      const visible = isCitizenOutside(citizen);
      let entry = this.entries.get(citizen.id);
      if (!entry) {
        entry = {
          sprite: this.scene.add
            .image(0, 0, TEXTURE_KEYS.citizen)
            .setOrigin(0.5, 1)
            .setDepth(DEPTH.citizens),
          mood: this.scene.add
            .image(0, 0, TEXTURE_KEYS.moodHappy)
            .setOrigin(0.5, 1)
            .setDepth(DEPTH.citizens),
          fromX: citizen.x,
          fromY: citizen.y,
          toX: citizen.x,
          toY: citizen.y,
        };
        this.entries.set(citizen.id, entry);
      } else if (visible && !entry.sprite.visible) {
        // Just stepped outside: start from the current position instead of sliding from an old one.
        entry.fromX = citizen.x;
        entry.fromY = citizen.y;
      } else {
        entry.fromX = entry.toX;
        entry.fromY = entry.toY;
      }
      entry.toX = citizen.x;
      entry.toY = citizen.y;
      entry.sprite.setVisible(visible);

      const mood = getMood(citizen.happiness);
      entry.mood.setVisible(visible && mood !== 'neutral');
      if (mood !== 'neutral') {
        entry.mood.setTexture(mood === 'happy' ? TEXTURE_KEYS.moodHappy : TEXTURE_KEYS.moodUnhappy);
      }
    }

    for (const [id, entry] of this.entries) {
      if (!alive.has(id)) {
        entry.sprite.destroy();
        entry.mood.destroy();
        this.entries.delete(id);
      }
    }
  }

  /** `alpha` is the progress (0..1) from the previous tick towards the next one. */
  render(alpha: number): void {
    const size = WORLD.tileSize;
    for (const entry of this.entries.values()) {
      if (!entry.sprite.visible) continue;
      const x = Math.round((entry.fromX + (entry.toX - entry.fromX) * alpha) * size);
      const y = Math.round((entry.fromY + (entry.toY - entry.fromY) * alpha) * size) + CITIZEN_VIEW.footOffsetPx;
      entry.sprite.setPosition(x, y);
      entry.mood.setPosition(x, y - CITIZEN_VIEW.height - CITIZEN_VIEW.moodGapPx);
    }
  }
}
