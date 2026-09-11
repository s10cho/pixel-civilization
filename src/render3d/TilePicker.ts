import * as THREE from 'three';
import { SCENE_3D } from '../config/gameConfig';
import { isInsideWorld } from '../world/territory';
import type { BuildingView } from './BuildingView';
import { worldToTile, type TileCoord } from './coords';

/**
 * Turns a pointer position into a grid tile. Buildings are tested first, so clicking the roof
 * of a tall building selects that building rather than the tile behind it.
 */
export class TilePicker {
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -SCENE_3D.tileTop);
  private readonly hit = new THREE.Vector3();

  constructor(
    private readonly camera: THREE.Camera,
    private readonly canvas: HTMLCanvasElement,
    private readonly buildings: BuildingView,
  ) {}

  pick(clientX: number, clientY: number): TileCoord | null {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);

    const building = this.buildings.pick(this.raycaster);
    if (building) return { col: building.col, row: building.row };

    if (!this.raycaster.ray.intersectPlane(this.ground, this.hit)) return null;
    const tile = worldToTile(this.hit.x, this.hit.z);
    return isInsideWorld(tile.col, tile.row) ? tile : null;
  }
}
