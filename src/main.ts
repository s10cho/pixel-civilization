import * as Phaser from 'phaser';
import 'nes.css/css/nes-core.min.css';
import { createPhaserConfig } from './config/phaserConfig';
import { loadUiFonts } from './ui/fonts';
import './ui/ui.css';

// Fonts first, so Phaser canvas text and the DOM UI render with the pixel font from frame one.
await loadUiFonts();

const game = new Phaser.Game(createPhaserConfig('game'));

// Expose the game instance in development for browser-side debugging and verification.
if (import.meta.env.DEV) {
  (window as unknown as { __PIXEL_CIV__: Phaser.Game }).__PIXEL_CIV__ = game;
}
