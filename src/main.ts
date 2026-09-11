import * as Phaser from 'phaser';
import { createPhaserConfig } from './config/phaserConfig';
import './ui/city-ui.css';

const game = new Phaser.Game(createPhaserConfig('game'));

// Expose the game instance in development for browser-side debugging and verification.
if (import.meta.env.DEV) {
  (window as unknown as { __PIXEL_CIV__: Phaser.Game }).__PIXEL_CIV__ = game;
}
