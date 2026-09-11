import * as THREE from 'three';
import type { BuildingType } from '../building/types';
import { isCitizenOutside } from '../citizen/behavior';
import type { Citizen } from '../citizen/types';
import { WORLD } from '../config/gameConfig';
import type { GameState } from '../simulation/gameState';
import { isInsideWorld, isUnlocked } from '../world/territory';
import { createBuildingMesh, createCitizenMesh, PALETTE, type Materials } from './models';
import type { StyleConfig } from './styles';

/** Height of the tile surface that buildings and citizens stand on. */
const TILE_TOP = 0.1;

export interface TileCoord {
  col: number;
  row: number;
}

export function tileCenter(col: number, row: number): THREE.Vector3 {
  return new THREE.Vector3(col - WORLD.cols / 2 + 0.5, TILE_TOP, row - WORLD.rows / 2 + 0.5);
}

export function tileFromPoint(point: THREE.Vector3): TileCoord {
  return { col: Math.floor(point.x + WORLD.cols / 2), row: Math.floor(point.z + WORLD.rows / 2) };
}

interface BuildingEntry {
  group: THREE.Group;
  type: BuildingType;
  level: number;
}

interface CitizenEntry {
  group: THREE.Group;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  phase: number;
}

/** Three.js view of a GameState: ground, buildings and citizens, plus a hover highlight. */
export class CityRenderer {
  readonly scene = new THREE.Scene();
  private readonly ground: THREE.InstancedMesh;
  private readonly hover: THREE.Mesh;
  private readonly buildings = new Map<number, BuildingEntry>();
  private readonly citizens = new Map<number, CitizenEntry>();
  private readonly color = new THREE.Color();

  constructor(
    private readonly materials: Materials,
    style: StyleConfig,
  ) {
    this.scene.background = new THREE.Color(style.background);
    this.addLights(style);

    // A thick soil slab under the map gives the "diorama" look.
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(WORLD.cols + 0.4, 0.6, WORLD.rows + 0.4),
      materials.get('soil'),
    );
    base.position.y = -0.4;
    base.receiveShadow = true;
    this.scene.add(base);

    this.ground = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.96, 0.2, 0.96),
      materials.get('white'),
      WORLD.cols * WORLD.rows,
    );
    this.ground.receiveShadow = true;
    const matrix = new THREE.Matrix4();
    for (let row = 0; row < WORLD.rows; row++) {
      for (let col = 0; col < WORLD.cols; col++) {
        const p = tileCenter(col, row);
        this.ground.setMatrixAt(row * WORLD.cols + col, matrix.makeTranslation(p.x, 0, p.z));
      }
    }
    this.scene.add(this.ground);

    this.hover = new THREE.Mesh(
      new THREE.PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.hover.visible = false;
    this.scene.add(this.hover);
  }

  private addLights(style: StyleConfig): void {
    this.scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x55663a, 1.2));
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
    sun.position.set(-10, 18, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(style.shadowMapSize, style.shadowMapSize);
    const shadowCamera = sun.shadow.camera;
    shadowCamera.left = -16;
    shadowCamera.right = 16;
    shadowCamera.top = 16;
    shadowCamera.bottom = -16;
    shadowCamera.near = 1;
    shadowCamera.far = 60;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
  }

  syncAll(state: GameState): void {
    this.syncTerritory(state);
    this.syncBuildings(state);
    this.syncCitizens(state.citizens);
  }

  syncTerritory(state: GameState): void {
    for (let row = 0; row < WORLD.rows; row++) {
      for (let col = 0; col < WORLD.cols; col++) {
        const checker = (col + row) % 2 === 0;
        const hex = isUnlocked(state, col, row)
          ? checker
            ? PALETTE.grass
            : PALETTE.grassAlt
          : checker
            ? PALETTE.locked
            : PALETTE.lockedAlt;
        this.ground.setColorAt(row * WORLD.cols + col, this.color.setHex(hex));
      }
    }
    this.ground.instanceColor!.needsUpdate = true;
  }

  syncBuildings(state: GameState): void {
    const alive = new Set<number>();
    for (const building of state.buildings) {
      alive.add(building.id);
      const existing = this.buildings.get(building.id);
      if (existing && existing.type === building.type && existing.level === building.level) {
        existing.group.position.copy(tileCenter(building.col, building.row));
        continue;
      }
      if (existing) this.remove(existing.group);
      const group = createBuildingMesh(building.type, building.level, this.materials);
      group.position.copy(tileCenter(building.col, building.row));
      this.scene.add(group);
      this.buildings.set(building.id, { group, type: building.type, level: building.level });
    }
    for (const [id, entry] of this.buildings) {
      if (!alive.has(id)) {
        this.remove(entry.group);
        this.buildings.delete(id);
      }
    }
  }

  /** Call after each simulation tick. */
  syncCitizens(citizens: readonly Citizen[]): void {
    const alive = new Set<number>();
    for (const citizen of citizens) {
      alive.add(citizen.id);
      const x = citizen.x - WORLD.cols / 2;
      const z = citizen.y - WORLD.rows / 2;
      const visible = isCitizenOutside(citizen);
      let entry = this.citizens.get(citizen.id);
      if (!entry) {
        entry = {
          group: createCitizenMesh(this.materials, citizen.id),
          fromX: x,
          fromZ: z,
          toX: x,
          toZ: z,
          phase: citizen.id * 1.7,
        };
        this.scene.add(entry.group);
        this.citizens.set(citizen.id, entry);
      } else if (visible && !entry.group.visible) {
        entry.fromX = x;
        entry.fromZ = z;
      } else {
        entry.fromX = entry.toX;
        entry.fromZ = entry.toZ;
      }
      entry.toX = x;
      entry.toZ = z;
      entry.group.visible = visible;
    }
    for (const [id, entry] of this.citizens) {
      if (!alive.has(id)) {
        this.remove(entry.group);
        this.citizens.delete(id);
      }
    }
  }

  /** Interpolates citizens between ticks; walkers bob and face their direction of travel. */
  renderCitizens(alpha: number, timeSeconds: number): void {
    for (const entry of this.citizens.values()) {
      if (!entry.group.visible) continue;
      const dx = entry.toX - entry.fromX;
      const dz = entry.toZ - entry.fromZ;
      const moving = Math.hypot(dx, dz) > 1e-4;
      const bob = moving ? Math.abs(Math.sin(timeSeconds * 14 + entry.phase)) * 0.03 : 0;
      entry.group.position.set(entry.fromX + dx * alpha, TILE_TOP + bob, entry.fromZ + dz * alpha);
      if (moving) entry.group.rotation.y = Math.atan2(dx, dz);
    }
  }

  setHover(tile: TileCoord | null): void {
    if (!tile || !isInsideWorld(tile.col, tile.row)) {
      this.hover.visible = false;
      return;
    }
    this.hover.position.copy(tileCenter(tile.col, tile.row)).setY(TILE_TOP + 0.005);
    this.hover.visible = true;
  }

  dispose(): void {
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
    (this.hover.material as THREE.Material).dispose();
  }

  private remove(object: THREE.Object3D): void {
    this.scene.remove(object);
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    });
  }
}
