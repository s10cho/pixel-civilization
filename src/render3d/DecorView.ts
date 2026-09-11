import * as THREE from 'three';
import { ERA_LOOK, WORLD } from '../config/gameConfig';
import type { EraId } from '../progression/era';
import type { GameState } from '../simulation/gameState';
import { isUnlocked } from '../world/territory';
import { tileToWorld } from './coords';
import { getDecorGeometry, type DecorKind } from './models';

/** Which scenery grows outside the territory in each era (weights per kind). */
const MIX: Record<EraId, [DecorKind, number][]> = {
  ancient: [
    ['pine', 0.7],
    ['rock', 0.3],
  ],
  medieval: [
    ['broadleaf', 0.6],
    ['pine', 0.2],
    ['rock', 0.2],
  ],
  industrial: [
    ['rock', 0.4],
    ['stump', 0.3],
    ['broadleaf', 0.3],
  ],
};

const KINDS: DecorKind[] = ['pine', 'broadleaf', 'rock', 'stump'];

/** Stable pseudo-random number in [0, 1) for a tile and a salt. */
function hash(col: number, row: number, salt: number): number {
  const s = Math.sin(col * 127.1 + row * 311.7 + salt * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Trees and rocks on land outside the territory, so the map reads as wild country the city
 * grows into. Expanding clears them; eras change what grows.
 */
export class DecorView {
  private readonly material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
  private readonly meshes = new Map<DecorKind, THREE.InstancedMesh>();
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(private readonly scene: THREE.Scene) {
    for (const kind of KINDS) {
      const mesh = new THREE.InstancedMesh(getDecorGeometry(kind), this.material, WORLD.cols * WORLD.rows);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.count = 0;
      scene.add(mesh);
      this.meshes.set(kind, mesh);
    }
  }

  sync(state: GameState, era: EraId): void {
    const counts = new Map<DecorKind, number>(KINDS.map((kind) => [kind, 0]));
    const density = ERA_LOOK[era].decorDensity;
    for (let row = 0; row < WORLD.rows; row++) {
      for (let col = 0; col < WORLD.cols; col++) {
        if (isUnlocked(state, col, row) || hash(col, row, 1) >= density) continue;
        const kind = pick(MIX[era], hash(col, row, 2));
        const mesh = this.meshes.get(kind)!;
        const index = counts.get(kind)!;
        tileToWorld(col, row, this.position);
        this.position.x += (hash(col, row, 3) - 0.5) * 0.5;
        this.position.z += (hash(col, row, 4) - 0.5) * 0.5;
        this.rotation.setFromAxisAngle(this.up, hash(col, row, 5) * Math.PI * 2);
        const size = 0.8 + hash(col, row, 6) * 0.5;
        this.scale.set(size, size, size);
        mesh.setMatrixAt(index, this.matrix.compose(this.position, this.rotation, this.scale));
        counts.set(kind, index + 1);
      }
    }
    for (const [kind, mesh] of this.meshes) {
      mesh.count = counts.get(kind)!;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const mesh of this.meshes.values()) {
      this.scene.remove(mesh);
      mesh.dispose();
    }
    this.material.dispose();
  }
}

function pick(mix: [DecorKind, number][], roll: number): DecorKind {
  let total = 0;
  for (const [kind, weight] of mix) {
    total += weight;
    if (roll < total) return kind;
  }
  return mix[mix.length - 1][0];
}
