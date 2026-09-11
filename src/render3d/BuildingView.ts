import * as THREE from 'three';
import type { Building } from '../building/types';
import type { EraId } from '../progression/era';
import { tileToWorld } from './coords';
import { getBuildingGeometry, getRotor, type Rotor } from './models';

const MIN_CAPACITY = 8;

interface RotorBatch {
  mesh: THREE.InstancedMesh;
  members: { building: Building; rotor: Rotor }[];
}

/** Which era's model to show for a building (differs per building during an era transition). */
export type EraOf = (building: Building) => EraId;

/**
 * Draws buildings with one InstancedMesh per (type, level, era) model, so draw calls stay flat
 * no matter how many buildings the city has. Moving parts (rotors) get their own instanced
 * meshes and are animated every frame.
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
  /** Where each building is drawn, for per-building animation. */
  private readonly slots = new Map<number, { mesh: THREE.InstancedMesh; index: number }>();
  private readonly rotors = new Map<string, RotorBatch>();
  /** Buildings popping in (scale animation), keyed by id: start time in seconds. */
  private readonly pops = new Map<number, number>();
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private readonly axes = { x: new THREE.Vector3(1, 0, 0), z: new THREE.Vector3(0, 0, 1) };
  private lastBuildings: readonly Building[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  sync(buildings: readonly Building[], eraOf: EraOf): void {
    this.lastBuildings = buildings;
    const groups = new Map<string, Building[]>();
    const eras = new Map<number, EraId>();
    const rotorGroups = new Map<string, { building: Building; rotor: Rotor }[]>();
    for (const building of buildings) {
      const era = eraOf(building);
      eras.set(building.id, era);
      push(groups, `${building.type}:${building.level}:${era}`, building);
      const rotor = getRotor(building.type, building.level, era);
      if (rotor) push(rotorGroups, rotor.key, { building, rotor });
    }

    this.slots.clear();
    for (const key of new Set([...groups.keys(), ...this.batches.keys()])) {
      const group = groups.get(key) ?? [];
      let batch = this.batches.get(key);
      if (!batch && group.length === 0) continue;
      if (!batch || batch.instanceMatrix.count < group.length) {
        if (batch) this.removeMesh(batch);
        const sample = group[0];
        batch = this.createMesh(getBuildingGeometry(sample.type, sample.level, eras.get(sample.id)!), group.length);
        this.batches.set(key, batch);
      }
      group.forEach((building, index) => {
        this.slots.set(building.id, { mesh: batch, index });
        batch.setMatrixAt(index, this.buildingMatrix(building, 1));
      });
      batch.count = group.length;
      batch.instanceMatrix.needsUpdate = true;
      // Raycasting tests the batch's bounds first, so they must follow the instances.
      batch.computeBoundingSphere();
      this.members.set(batch, group);
    }

    for (const key of new Set([...rotorGroups.keys(), ...this.rotors.keys()])) {
      const members = rotorGroups.get(key) ?? [];
      let batch = this.rotors.get(key);
      if (!batch && members.length === 0) continue;
      if (!batch || batch.mesh.instanceMatrix.count < members.length) {
        if (batch) this.removeMesh(batch.mesh);
        batch = { mesh: this.createMesh(members[0].rotor.geometry, members.length), members };
        this.rotors.set(key, batch);
      }
      batch.members = members;
      batch.mesh.count = members.length;
    }
    this.animate(0);
  }

  /** Starts a short "pop" (squash and settle) on a building, e.g. when it changes model. */
  pop(buildingId: number, startSeconds: number): void {
    this.pops.set(buildingId, startSeconds);
  }

  /** Turns rotors and plays pop animations at `timeSeconds`. */
  animate(timeSeconds: number): void {
    for (const batch of this.rotors.values()) {
      batch.members.forEach(({ building, rotor }, i) => {
        tileToWorld(building.col, building.row, this.position).add(rotor.pivot);
        this.rotation.setFromAxisAngle(this.axes[rotor.axis], timeSeconds * rotor.speed + building.id);
        batch.mesh.setMatrixAt(i, this.matrix.compose(this.position, this.rotation, this.scale));
      });
      batch.mesh.instanceMatrix.needsUpdate = true;
    }

    for (const [id, start] of this.pops) {
      const slot = this.slots.get(id);
      const building = this.lastBuildings.find((b) => b.id === id);
      const t = (timeSeconds - start) / POP_SECONDS;
      if (!slot || !building || t >= 1) {
        this.pops.delete(id);
        if (slot && building) this.setInstance(slot, this.buildingMatrix(building, 1));
        continue;
      }
      if (t < 0) continue;
      // Quick overshoot: 0.6 -> 1.12 -> 1.
      const scale = t < 0.5 ? 0.6 + 1.04 * t : 1.12 - 0.24 * (t - 0.5);
      this.setInstance(slot, this.buildingMatrix(building, scale));
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
    for (const batch of this.batches.values()) this.removeMesh(batch);
    for (const batch of this.rotors.values()) this.removeMesh(batch.mesh);
    this.batches.clear();
    this.rotors.clear();
    this.material.dispose();
  }

  private buildingMatrix(building: Building, scale: number): THREE.Matrix4 {
    tileToWorld(building.col, building.row, this.position);
    this.scale.set(scale, scale, scale);
    this.matrix.compose(this.position, this.rotation.identity(), this.scale);
    this.scale.set(1, 1, 1);
    return this.matrix;
  }

  private setInstance(slot: { mesh: THREE.InstancedMesh; index: number }, matrix: THREE.Matrix4): void {
    slot.mesh.setMatrixAt(slot.index, matrix);
    slot.mesh.instanceMatrix.needsUpdate = true;
  }

  private createMesh(geometry: THREE.BufferGeometry, needed: number): THREE.InstancedMesh {
    let capacity = MIN_CAPACITY;
    while (capacity < needed) capacity *= 2;
    const mesh = new THREE.InstancedMesh(geometry, this.material, capacity);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // Instances span the whole map; skip per-mesh culling against the model's own bounds.
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    return mesh;
  }

  private removeMesh(mesh: THREE.InstancedMesh): void {
    this.scene.remove(mesh);
    this.members.delete(mesh);
    // Geometries are shared cached models, so only the instance buffers are released.
    mesh.dispose();
  }
}

const POP_SECONDS = 0.45;

function push<T>(map: Map<string, T[]>, key: string, value: T): void {
  let list = map.get(key);
  if (!list) map.set(key, (list = []));
  list.push(value);
}
