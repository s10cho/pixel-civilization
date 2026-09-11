import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { BuildingType } from '../building/types';
import { SIMULATION, WORLD } from '../config/gameConfig';
import { computeProduction } from '../economy/production';
import { expandTerritory, placeBuilding } from '../simulation/actions';
import { createInitialState, type GameState } from '../simulation/gameState';
import { nextRandom } from '../simulation/random';
import { tickSimulation } from '../simulation/tick';
import { CityRenderer, tileFromPoint, type TileCoord } from './cityRenderer';
import { Materials } from './models';
import { STYLES, type SpikeStyle } from './styles';

/**
 * Throwaway 3D rendering spike: runs the real (Phaser-free) simulation and renders it with
 * Three.js in two candidate styles, to compare look and cost before committing to 3D.
 */

/** Demo city: [type, col, row, level] inside the 16x16 territory (two expansions). */
const LAYOUT: readonly [BuildingType, number, number, number][] = [
  ['house', 9, 9, 2],
  ['house', 10, 9, 1],
  ['house', 9, 10, 3],
  ['house', 14, 9, 1],
  ['house', 15, 9, 2],
  ['house', 15, 10, 1],
  ['house', 9, 14, 1],
  ['house', 10, 15, 2],
  ['house', 14, 15, 1],
  ['house', 15, 14, 3],
  ['house', 11, 7, 1],
  ['house', 13, 17, 2],
  ['shop', 12, 9, 2],
  ['shop', 10, 12, 1],
  ['shop', 14, 12, 1],
  ['shop', 12, 15, 3],
  ['park', 11, 11, 2],
  ['park', 13, 13, 1],
  ['park', 7, 12, 1],
  ['park', 17, 12, 3],
];

function createSpikeState(stress: boolean): GameState {
  const state = createInitialState(12345);
  state.resources.gold = 1e9;
  for (let i = 0; i < (stress ? 4 : 2); i++) expandTerritory(state);

  const place = (type: BuildingType, col: number, row: number, level: number) => {
    if (placeBuilding(state, type, col, row).ok) state.buildings[state.buildings.length - 1].level = level;
  };
  for (const [type, col, row, level] of LAYOUT) place(type, col, row, level);

  if (stress) {
    const types: BuildingType[] = ['house', 'house', 'shop', 'park'];
    for (let row = 0; row < WORLD.rows; row++) {
      for (let col = 0; col < WORLD.cols; col++) {
        if (nextRandom(state) < 0.3) continue;
        place(types[Math.floor(nextRandom(state) * types.length)], col, row, 1 + Math.floor(nextRandom(state) * 3));
      }
    }
  }

  // Skip the slow population ramp-up so citizens are already walking around.
  state.resources.population = computeProduction(state).populationCapacity;
  for (let i = 0; i < 40; i++) tickSimulation(state, SIMULATION.tickSeconds);
  return state;
}

interface Context {
  style: SpikeStyle;
  renderer: THREE.WebGLRenderer;
  camera: THREE.OrthographicCamera;
  controls: OrbitControls;
  city: CityRenderer;
  materials: Materials;
}

const view = document.getElementById('view')!;
const statsElement = document.getElementById('stats')!;
const tilePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.1);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const hit = new THREE.Vector3();

let state = createSpikeState(false);
let stress = false;
let accumulator = 0;
let lastFrame = performance.now();
let framesSinceStats = 0;
let statsAt = lastFrame;
let ctx = createContext(new URLSearchParams(location.search).get('style') === 'pixel' ? 'pixel' : 'lowpoly');
resize();
refreshStyleButtons();

function createContext(style: SpikeStyle, previous?: Context): Context {
  const config = STYLES[style];
  const renderer = new THREE.WebGLRenderer({ antialias: config.antialias });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  view.replaceChildren(renderer.domElement);
  view.classList.toggle('pixelated', config.pixelScale > 1);

  const materials = new Materials(config.toon);
  const city = new CityRenderer(materials, config);
  city.syncAll(state);

  // Isometric-style orthographic camera; pitch is locked, yaw can rotate.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  if (previous) {
    camera.position.copy(previous.camera.position);
    camera.zoom = previous.camera.zoom;
    controls.target.copy(previous.controls.target);
  } else {
    camera.position.set(14, 15, 14);
  }
  const offset = camera.position.clone().sub(controls.target);
  const polar = Math.atan2(Math.hypot(offset.x, offset.z), offset.y);
  controls.enableDamping = true;
  controls.screenSpacePanning = false;
  controls.minPolarAngle = polar;
  controls.maxPolarAngle = polar;
  controls.minZoom = 0.6;
  controls.maxZoom = 5;
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
  controls.update();

  bindPointer(renderer.domElement);
  renderer.setAnimationLoop(frame);
  return { style, renderer, camera, controls, city, materials };
}

function setStyle(style: SpikeStyle): void {
  if (style === ctx.style) return;
  const previous = ctx;
  previous.renderer.setAnimationLoop(null);
  const next = createContext(style, previous);
  previous.controls.dispose();
  previous.city.dispose();
  previous.materials.dispose();
  previous.renderer.dispose();
  ctx = next;
  resize();
  refreshStyleButtons();
}

function resize(): void {
  const config = STYLES[ctx.style];
  const width = view.clientWidth;
  const height = view.clientHeight;
  ctx.renderer.setPixelRatio(config.pixelScale > 1 ? 1 : Math.min(devicePixelRatio, 2));
  ctx.renderer.setSize(Math.round(width / config.pixelScale), Math.round(height / config.pixelScale), false);

  // Keep roughly 24 tiles across on any aspect ratio.
  const aspect = width / height;
  const halfWidth = Math.max(12, 8 * aspect);
  ctx.camera.left = -halfWidth;
  ctx.camera.right = halfWidth;
  ctx.camera.top = halfWidth / aspect;
  ctx.camera.bottom = -halfWidth / aspect;
  ctx.camera.updateProjectionMatrix();
}

function frame(now: number): void {
  const dt = Math.min((now - lastFrame) / 1000, SIMULATION.maxCatchUpSeconds);
  lastFrame = now;
  accumulator += dt;
  let ticked = false;
  while (accumulator >= SIMULATION.tickSeconds) {
    tickSimulation(state, SIMULATION.tickSeconds);
    accumulator -= SIMULATION.tickSeconds;
    ticked = true;
  }
  if (ticked) ctx.city.syncCitizens(state.citizens);
  ctx.city.renderCitizens(accumulator / SIMULATION.tickSeconds, now / 1000);
  ctx.controls.update();
  ctx.renderer.render(ctx.city.scene, ctx.camera);

  framesSinceStats++;
  if (now - statsAt > 500) {
    updateStats(framesSinceStats / ((now - statsAt) / 1000));
    framesSinceStats = 0;
    statsAt = now;
  }
}

function updateStats(fps: number): void {
  const info = ctx.renderer.info.render;
  statsElement.textContent = [
    `style      ${ctx.style}`,
    `fps        ${fps.toFixed(0)}`,
    `draw calls ${info.calls}`,
    `triangles  ${info.triangles}`,
    `buildings  ${state.buildings.length}`,
    `citizens   ${state.citizens.length}`,
  ].join('\n');
}

function pickTile(event: PointerEvent): TileCoord | null {
  const rect = ctx.renderer.domElement.getBoundingClientRect();
  pointer.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, ctx.camera);
  return raycaster.ray.intersectPlane(tilePlane, hit) ? tileFromPoint(hit) : null;
}

/** Hover highlights a tile; a click without dragging places a House there. */
function bindPointer(canvas: HTMLCanvasElement): void {
  let down: { x: number; y: number } | null = null;
  canvas.addEventListener('pointerdown', (event) => {
    down = event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
  });
  canvas.addEventListener('pointermove', (event) => ctx.city.setHover(pickTile(event)));
  canvas.addEventListener('pointerleave', () => ctx.city.setHover(null));
  canvas.addEventListener('pointerup', (event) => {
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) < 6) {
      const tile = pickTile(event);
      if (tile && placeBuilding(state, 'house', tile.col, tile.row).ok) ctx.city.syncBuildings(state);
    }
    down = null;
  });
}

function rotateView(angle: number): void {
  const offset = ctx.camera.position.clone().sub(ctx.controls.target);
  offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
  ctx.camera.position.copy(ctx.controls.target).add(offset);
  ctx.controls.update();
}

function refreshStyleButtons(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-style]')) {
    button.classList.toggle('active', button.dataset.style === ctx.style);
  }
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-style]')) {
  button.addEventListener('click', () => setStyle(button.dataset.style as SpikeStyle));
}
document.getElementById('stress')!.addEventListener('click', (event) => {
  stress = !stress;
  state = createSpikeState(stress);
  ctx.city.syncAll(state);
  (event.currentTarget as HTMLButtonElement).textContent = `Stress: ${stress ? 'on' : 'off'}`;
});
document.getElementById('rotate')!.addEventListener('click', () => rotateView(Math.PI / 2));
window.addEventListener('resize', resize);

/** Average CPU+GPU time per frame (ms) over `frames` synchronous renders. For benchmarking. */
function measure(frames = 60): number {
  const gl = ctx.renderer.getContext();
  const start = performance.now();
  for (let i = 0; i < frames; i++) ctx.renderer.render(ctx.city.scene, ctx.camera);
  gl.finish();
  return (performance.now() - start) / frames;
}

(window as unknown as { __spike: object }).__spike = {
  get state() {
    return state;
  },
  get ctx() {
    return ctx;
  },
  setStyle,
  measure,
};
