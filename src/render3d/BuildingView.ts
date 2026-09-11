import * as THREE from 'three';
import type { Building } from '../building/types';
import { tileToWorld } from './coords';
import { getBuildingGeometry, getRotor, type Rotor } from './models';

const MIN_CAPACITY = 8;

interface RotorBatch {
  mesh: THREE.InstancedMesh;
  members: { building: Building; rotor: Rotor }[];
}

/**
 * Draws buildings with one InstancedMesh per (type, level) model, so draw calls stay flat no
 * matter how many buildings the city has. Moving parts (rotors) get their own instanced meshes
 * and are animated every frame.
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
  private readonly rotors = new Map<string, RotorBatch>();
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private readonly zAxis = new THREE.Vector3(0, 0, 1);

  constructor(private readonly scene: THREE.Scene) {}

  sync(buildings: readonly Building[]): void {
    const groups = new Map<string, Building[]>();
    const rotorGroups = new Map<string, { building: Building; rotor: Rotor }[]>();
    for (const building of buildings) {
      push(groups, `${building.type}:${building.level}`, building);
      const rotor = getRotor(building.type, building.level);
      if (rotor) push(rotorGroups, rotor.key, { building, rotor });
    }

    for (const key of new Set([...groups.keys(), ...this.batches.keys()])) {
      const group = groups.get(key) ?? [];
      let batch = this.batches.get(key);
      if (!batch && group.length === 0) continue;
      if (!batch || batch.instanceMatrix.count < group.length) {
        if (batch) this.removeMesh(batch);
        batch = this.createMesh(getBuildingGeometry(group[0].type, group[0].level), group.length);
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

  /** Turns every rotor to its angle at `timeSeconds`. */
  animate(timeSeconds: number): void {
    for (const batch of this.rotors.values()) {
      batch.members.forEach(({ building, rotor }, i) => {
        tileToWorld(building.col, building.row, this.position).add(rotor.pivot);
        this.rotation.setFromAxisAngle(this.zAxis, timeSeconds * rotor.speed + building.id);
        batch.mesh.setMatrixAt(i, this.matrix.compose(this.position, this.rotation, this.scale));
      });
      batch.mesh.instanceMatrix.needsUpdate = true;
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

function push<T>(map: Map<string, T[]>, key: string, value: T): void {
  let list = map.get(key);
  if (!list) map.set(key, (list = []));
  list.push(value);
}
