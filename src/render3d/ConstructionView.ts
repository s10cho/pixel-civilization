import * as THREE from 'three';
import type { Project } from '../simulation/projects';
import { tileToWorld } from './coords';
import { box, cylinder, merge, part } from './modelParts';

/**
 * Scaffolding on the tiles of a project under construction, so work in progress is something
 * the player can see happening (Phase 2 §1.2).
 */
export class ConstructionView {
  private readonly material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
  private readonly geometry = merge([
    ...[
      [-0.3, -0.3],
      [0.3, -0.3],
      [-0.3, 0.3],
      [0.3, 0.3],
    ].map(([x, z]) => part(cylinder(0.022, 0.026, 0.34, 5), 'wood', { x, y: 0.17, z })),
    part(box(0.68, 0.035, 0.1), 'woodDark', { y: 0.3, z: -0.28 }),
    part(box(0.1, 0.035, 0.68), 'woodDark', { x: 0.28, y: 0.24 }),
    part(box(0.5, 0.04, 0.5), 'sidewalk', { y: 0.02 }),
  ]);
  private readonly mesh: THREE.InstancedMesh;
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    capacity = 96,
  ) {
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, capacity);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
  }

  sync(projects: readonly Project[]): void {
    let index = 0;
    for (const project of projects) {
      for (const tile of project.tiles) {
        if (index >= this.mesh.instanceMatrix.count) break;
        tileToWorld(tile.col, tile.row, this.position);
        this.mesh.setMatrixAt(index++, this.matrix.makeTranslation(this.position.x, this.position.y, this.position.z));
      }
    }
    this.mesh.count = index;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
