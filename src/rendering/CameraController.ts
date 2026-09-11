import * as Phaser from 'phaser';
import { CAMERA } from '../config/gameConfig';

/** Pan/zoom for the city camera. Keeps the view centered inside the world bounds. */
export class CameraController {
  private readonly center = new Phaser.Math.Vector2();

  constructor(
    private readonly camera: Phaser.Cameras.Scene2D.Camera,
    private readonly worldWidth: number,
    private readonly worldHeight: number,
  ) {}

  /** Centers on a world rectangle, choosing an integer zoom (crisp pixels) that fits it on screen. */
  fitRect(x: number, y: number, width: number, height: number): void {
    const fit = Math.min(this.camera.width / width, this.camera.height / height) * CAMERA.initialFitRatio;
    const zoom = fit >= 1 ? Math.floor(fit) : fit;
    this.camera.setZoom(Phaser.Math.Clamp(zoom, CAMERA.minZoom, CAMERA.maxZoom));
    this.center.set(x + width / 2, y + height / 2);
    this.apply();
  }

  panByScreen(dx: number, dy: number): void {
    this.center.x -= dx / this.camera.zoom;
    this.center.y -= dy / this.camera.zoom;
    this.apply();
  }

  /** Zooms by `factor`, keeping the world point under (screenX, screenY) fixed on screen. */
  zoomAt(screenX: number, screenY: number, factor: number): void {
    const anchor = this.camera.getWorldPoint(screenX, screenY);
    const zoom = Phaser.Math.Clamp(this.camera.zoom * factor, CAMERA.minZoom, CAMERA.maxZoom);
    this.camera.setZoom(zoom);
    this.center.set(
      anchor.x - (screenX - this.camera.width / 2) / zoom,
      anchor.y - (screenY - this.camera.height / 2) / zoom,
    );
    this.apply();
  }

  /** Re-applies the current view, e.g. after the canvas was resized. */
  refresh(): void {
    this.apply();
  }

  private apply(): void {
    this.center.x = Phaser.Math.Clamp(this.center.x, 0, this.worldWidth);
    this.center.y = Phaser.Math.Clamp(this.center.y, 0, this.worldHeight);
    this.camera.centerOn(this.center.x, this.center.y);
  }
}
