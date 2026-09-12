import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMERA, WORLD } from '../config/gameConfig';
import type { TileRect } from '../world/territory';
import { tileToWorld } from './coords';

/**
 * Isometric-style camera control: panning and zooming, with the angle fixed so buildings are
 * always seen from their front. Mouse: any drag pans. Trackpad: two-finger swipe pans, pinch
 * zooms. Touch: one finger pans, two fingers pinch-zoom.
 *
 * Rotation is deliberately switched off for now — it will come back together with turning
 * individual buildings, so the two can be designed as one feature.
 */
export class CameraRig {
  readonly controls: OrbitControls;
  private readonly domElement: HTMLElement;

  constructor(
    private readonly camera: THREE.OrthographicCamera,
    domElement: HTMLElement,
  ) {
    const controls = new OrbitControls(camera, domElement);
    controls.enableDamping = true;
    controls.screenSpacePanning = false;
    controls.enableRotate = false;
    // The wheel is handled here instead, so a trackpad swipe pans and a pinch zooms.
    controls.enableZoom = false;
    controls.minPolarAngle = CAMERA.polarAngle;
    controls.maxPolarAngle = CAMERA.polarAngle;
    controls.minZoom = CAMERA.minZoom;
    controls.maxZoom = CAMERA.maxZoom;
    controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
    controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
    controls.addEventListener('change', this.keepTargetInWorld);
    this.controls = controls;
    this.domElement = domElement;
    domElement.addEventListener('wheel', this.onWheel, { passive: false });

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
    // In portrait the narrow width limits the fit, so use more of it.
    const ratio = viewWidth < viewHeight ? CAMERA.fitRatioPortrait : CAMERA.fitRatio;
    const zoom = Math.min((viewWidth * ratio) / size.x, (viewHeight * ratio) / size.y);
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
    this.domElement.removeEventListener('wheel', this.onWheel);
    this.controls.removeEventListener('change', this.keepTargetInWorld);
    this.controls.dispose();
  }

  /**
   * Trackpads send a two-finger swipe as a plain wheel event and a pinch as ctrl+wheel, so
   * the swipe pans the city and only the pinch (or ctrl+wheel on a mouse) zooms.
   */
  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      this.zoomBy(1 - event.deltaY * CAMERA.pinchZoomPerPixel);
    } else {
      this.panByPixels(event.deltaX, event.deltaY);
    }
  };

  /** Moves the view by a screen-space offset in pixels. */
  panByPixels(dx: number, dy: number): void {
    const perPixel = CAMERA.wheelPanPerPixel / (CAMERA.pixelsPerTile * this.camera.zoom);
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).setY(0).normalize();
    // "Up the screen" along the ground: away from the camera.
    const away = this.camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
    const offset = right.multiplyScalar(dx * perPixel).add(away.multiplyScalar(-dy * perPixel));
    this.controls.target.add(offset);
    this.camera.position.add(offset);
    this.controls.update();
  }

  /** Multiplies the zoom, keeping it inside the allowed range. */
  zoomBy(factor: number): void {
    this.camera.zoom = THREE.MathUtils.clamp(this.camera.zoom * factor, CAMERA.minZoom, CAMERA.maxZoom);
    this.camera.updateProjectionMatrix();
    this.controls.update();
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
