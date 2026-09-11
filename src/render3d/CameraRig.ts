import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMERA, WORLD } from '../config/gameConfig';
import type { TileRect } from '../world/territory';
import { tileToWorld } from './coords';

/**
 * Isometric-style camera control: pan, zoom and yaw rotation with the pitch locked.
 * Mouse: left drag pans, right drag rotates, wheel zooms. Touch: one finger pans, two fingers
 * pinch-zoom and twist.
 */
export class CameraRig {
  readonly controls: OrbitControls;

  constructor(
    private readonly camera: THREE.OrthographicCamera,
    domElement: HTMLElement,
  ) {
    const controls = new OrbitControls(camera, domElement);
    controls.enableDamping = true;
    controls.screenSpacePanning = false;
    controls.zoomToCursor = true;
    controls.minPolarAngle = CAMERA.polarAngle;
    controls.maxPolarAngle = CAMERA.polarAngle;
    controls.minZoom = CAMERA.minZoom;
    controls.maxZoom = CAMERA.maxZoom;
    controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    controls.addEventListener('change', this.keepTargetInWorld);
    this.controls = controls;

    this.placeCamera(new THREE.Vector3(), CAMERA.azimuth);
  }

  update(): void {
    this.controls.update();
  }

  /** Centres on the area and zooms so it fills CAMERA.fitRatio of the view. Keeps the yaw. */
  focusArea(area: TileRect): void {
    const min = tileToWorld(area.minCol, area.minRow);
    const max = tileToWorld(area.maxCol, area.maxRow);
    const x0 = min.x - 0.5;
    const x1 = max.x + 0.5;
    const z0 = min.z - 0.5;
    const z1 = max.z + 0.5;

    const offset = this.camera.position.clone().sub(this.controls.target);
    this.placeCamera(new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2), Math.atan2(offset.x, offset.z));

    // Measure the area's footprint (including building height) in view space.
    this.camera.updateMatrixWorld(true);
    const bounds = new THREE.Box3();
    const corner = new THREE.Vector3();
    for (const x of [x0, x1]) {
      for (const z of [z0, z1]) {
        for (const y of [0, CAMERA.fitHeight]) {
          bounds.expandByPoint(corner.set(x, y, z).applyMatrix4(this.camera.matrixWorldInverse));
        }
      }
    }
    const size = bounds.getSize(corner);
    const viewWidth = this.camera.right - this.camera.left;
    const viewHeight = this.camera.top - this.camera.bottom;
    const zoom = Math.min((viewWidth * CAMERA.fitRatio) / size.x, (viewHeight * CAMERA.fitRatio) / size.y);
    this.camera.zoom = THREE.MathUtils.clamp(zoom, CAMERA.minZoom, CAMERA.maxZoom);
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  /** Pans so the tile is at the centre of the view, keeping zoom and yaw. */
  focusTile(col: number, row: number): void {
    const offset = this.camera.position.clone().sub(this.controls.target);
    this.placeCamera(tileToWorld(col, row).setY(0), Math.atan2(offset.x, offset.z));
  }

  dispose(): void {
    this.controls.removeEventListener('change', this.keepTargetInWorld);
    this.controls.dispose();
  }

  private placeCamera(target: THREE.Vector3, azimuth: number): void {
    const r = CAMERA.distance;
    const flat = Math.sin(CAMERA.polarAngle) * r;
    this.controls.target.copy(target);
    this.camera.position.set(
      target.x + flat * Math.sin(azimuth),
      target.y + Math.cos(CAMERA.polarAngle) * r,
      target.z + flat * Math.cos(azimuth),
    );
    this.controls.update();
  }

  /** Panning may not move the view centre off the map. */
  private readonly keepTargetInWorld = (): void => {
    const target = this.controls.target;
    const x = THREE.MathUtils.clamp(target.x, -WORLD.cols / 2, WORLD.cols / 2);
    const z = THREE.MathUtils.clamp(target.z, -WORLD.rows / 2, WORLD.rows / 2);
    if (x === target.x && z === target.z) return;
    this.camera.position.x += x - target.x;
    this.camera.position.z += z - target.z;
    target.x = x;
    target.z = z;
  };
}
