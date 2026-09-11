import * as THREE from 'three';
import type { Building } from '../building/types';
import { tileToWorld } from './coords';
import { getBuildingGeometry } from './models';

const MIN_CAPACITY = 8;

/**
 * Draws buildings with one InstancedMesh per (type, level) model, so draw calls stay flat no
 * matter how many buildings the city has.
 */
export class BuildingView {
  private readonly material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.9,
    metalness: 0,
  });
  private readonly batches = new Map<string, THREE.InstancedMesh>();
  /** Buildings drawn by each batch, indexed by instance id (used for picking). */
  private readonly members = new Map<THREE.InstancedMesh, Building[]>();
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();

  constructor(private readonly scene: THREE.Scene) {}

  sync(buildings: readonly Building[]): void {
    const groups = new Map<string, Building[]>();
    for (const building of buildings) {
      const key = `${building.type}:${building.level}`;
      let group = groups.get(key);
      if (!group) groups.set(key, (group = []));
      group.push(building);
    }

    for (const key of new Set([...groups.keys(), ...this.batches.keys()])) {
      const group = groups.get(key) ?? [];
      let batch = this.batches.get(key);
      if (!batch && group.length === 0) continue;
      if (!batch || batch.instanceMatrix.count < group.length) {
        if (batch) this.removeBatch(batch);
        batch = this.createBatch(group[0], group.length);
        this.batches.set(key, batch);
      }
      group.forEach((building, i) => {
        tileToWorld(building.col, building.row, this.position);
        batch.setMatrixAt(i, this.matrix.makeTranslation(this.position));
      });
      batch.count = group.length;
      batch.instanceMatrix.needsUpdate = true;
      // Raycasting tests the batch's bounds first, so they must follow the instances.
      batch.computeBoundingSphere();
      this.members.set(batch, group);
    }
  }

  /** The building the ray hits first, if any. */
  pick(raycaster: THREE.Raycaster): Building | null {
    const hits = raycaster.intersectObjects([...this.batches.values()], false);
    for (const hit of hits) {
      const building = this.members.get(hit.object as THREE.InstancedMesh)?.[hit.instanceId ?? -1];
      if (building) return building;
    }
    return null;
  }

  dispose(): void {
    for (const batch of this.batches.values()) this.removeBatch(batch);
    this.batches.clear();
    this.material.dispose();
  }

  private createBatch(sample: Building, needed: number): THREE.InstancedMesh {
    let capacity = MIN_CAPACITY;
    while (capacity < needed) capacity *= 2;
    const batch = new THREE.InstancedMesh(getBuildingGeometry(sample.type, sample.level), this.material, capacity);
    batch.castShadow = true;
    batch.receiveShadow = true;
    // Instances span the whole map; skip per-mesh culling against the model's own bounds.
    batch.frustumCulled = false;
    this.scene.add(batch);
    return batch;
  }

  private removeBatch(batch: THREE.InstancedMesh): void {
    this.scene.remove(batch);
    this.members.delete(batch);
    // The geometry is a shared cached model, so only the instance buffers are released.
    batch.dispose();
  }
}
