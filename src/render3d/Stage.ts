import * as THREE from 'three';
import { CAMERA, SCENE_3D, WORLD, type QualityPreset } from '../config/gameConfig';

/** Owns the WebGL renderer, scene, lights and orthographic camera of the city view. */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);

  constructor(
    private readonly container: HTMLElement,
    private readonly quality: QualityPreset,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: quality.antialias });
    this.renderer.shadowMap.enabled = quality.shadowMapSize > 0;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.append(this.renderer.domElement);

    this.scene.background = new THREE.Color(SCENE_3D.background);
    this.addLights();
    this.resize();
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /** Matches the canvas to its container; the camera keeps CAMERA.pixelsPerTile at zoom 1. */
  resize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality.maxPixelRatio));
    this.renderer.setSize(width, height);

    const halfWidth = width / 2 / CAMERA.pixelsPerTile;
    const halfHeight = height / 2 / CAMERA.pixelsPerTile;
    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x55663a, 1.2));

    const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
    sun.position.set(-10, 18, 8);
    sun.castShadow = this.quality.shadowMapSize > 0;
    sun.shadow.mapSize.set(this.quality.shadowMapSize, this.quality.shadowMapSize);
    const extent = Math.max(WORLD.cols, WORLD.rows) / 2 + 4;
    const shadowCamera = sun.shadow.camera;
    shadowCamera.left = -extent;
    shadowCamera.right = extent;
    shadowCamera.top = extent;
    shadowCamera.bottom = -extent;
    shadowCamera.near = 1;
    shadowCamera.far = 60;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
  }
}
