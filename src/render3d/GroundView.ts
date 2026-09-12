import * as THREE from 'three';
import { ERA_LOOK, WORLD } from '../config/gameConfig';
import type { EraId } from '../progression/era';
import type { GameState } from '../simulation/gameState';
import { isMountain } from '../world/terrain';
import { isUnlocked } from '../world/territory';
import { tileToWorld } from './coords';
import { PALETTE } from './models';

/** The map: one instanced tile per grid cell (tinted by territory and era) on a soil slab. */
export class GroundView {
  private readonly tiles: THREE.InstancedMesh;
  private readonly base: THREE.Mesh;
  private readonly color = new THREE.Color();

  constructor(private readonly scene: THREE.Scene) {
    this.base = new THREE.Mesh(
      new THREE.BoxGeometry(WORLD.cols + 0.4, 0.6, WORLD.rows + 0.4),
      new THREE.MeshStandardMaterial({ color: PALETTE.soil, flatShading: true, roughness: 1 }),
    );
    this.base.position.y = -0.4;
    this.base.receiveShadow = true;
    scene.add(this.base);

    // Tile tops sit at SCENE_3D.tileTop (box height 0.2 centred on y = 0).
    this.tiles = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.96, 0.2, 0.96),
      new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1 }),
      WORLD.cols * WORLD.rows,
    );
    this.tiles.receiveShadow = true;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    for (let row = 0; row < WORLD.rows; row++) {
      for (let col = 0; col < WORLD.cols; col++) {
        tileToWorld(col, row, position);
        this.tiles.setMatrixAt(row * WORLD.cols + col, matrix.makeTranslation(position.x, 0, position.z));
      }
    }
    scene.add(this.tiles);
  }

  sync(state: GameState, era: EraId): void {
    const look = ERA_LOOK[era];
    for (let row = 0; row < WORLD.rows; row++) {
      for (let col = 0; col < WORLD.cols; col++) {
        const checker = (col + row) % 2 === 0;
        const hex = isMountain(state, col, row)
          ? checker
            ? look.mountain
            : look.locked
          : isUnlocked(state, col, row)
            ? checker
              ? look.grass
              : look.grassAlt
            : checker
              ? look.locked
              : look.lockedAlt;
        this.tiles.setColorAt(row * WORLD.cols + col, this.color.setHex(hex));
      }
    }
    this.tiles.instanceColor!.needsUpdate = true;
  }

  dispose(): void {
    for (const mesh of [this.tiles, this.base]) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.tiles.dispose();
  }
}
