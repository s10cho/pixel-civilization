import * as THREE from 'three';
import { isCitizenOutside } from '../citizen/behavior';
import type { Citizen } from '../citizen/types';
import { CITIZENS } from '../config/balance';
import { CITIZEN_3D, ERA_LOOK, SCENE_3D } from '../config/gameConfig';
import { getMood, type Mood } from '../economy/happiness';
import type { EraId } from '../progression/era';
import { simToWorld } from './coords';
import { getCitizenGeometries } from './models';

interface Track {
  /** World position at the previous and latest simulation tick. */
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  heading: number;
  visible: boolean;
  mood: Mood;
  phase: number;
  id: number;
}

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Draws citizens who are outside as instanced meshes (body, shirt, mood marker: three draw
 * calls). The simulation ticks at a fixed rate, so positions are interpolated between the last
 * two ticks for smooth movement at any frame rate.
 */
export class CitizenView {
  private readonly body: THREE.InstancedMesh;
  private readonly shirts: THREE.InstancedMesh;
  private readonly moods: THREE.InstancedMesh;
  private readonly tracks = new Map<number, Track>();
  private shirtColors: THREE.Color[] = ERA_LOOK.ancient.shirts.map((hex) => new THREE.Color(hex));
  private readonly moodColors: Record<Exclude<Mood, 'neutral'>, THREE.Color> = {
    happy: new THREE.Color(CITIZEN_3D.moodHappy),
    unhappy: new THREE.Color(CITIZEN_3D.moodUnhappy),
  };
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3(1, 1, 1);

  constructor(
    private readonly scene: THREE.Scene,
    private readonly capacity: number = CITIZENS.maxSimulated,
  ) {
    const { body, shirt } = getCitizenGeometries();
    this.body = this.createMesh(body, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true }));
    this.shirts = this.createMesh(shirt, new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true }));
    this.moods = this.createMesh(
      new THREE.OctahedronGeometry(CITIZEN_3D.moodMarkerSize),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    this.moods.castShadow = false;
  }

  /** Citizens dress for the era. */
  setEra(era: EraId): void {
    this.shirtColors = ERA_LOOK[era].shirts.map((hex) => new THREE.Color(hex));
  }

  /** Call after each simulation tick. */
  sync(citizens: readonly Citizen[]): void {
    const alive = new Set<number>();
    for (const citizen of citizens) {
      alive.add(citizen.id);
      const { x, z } = simToWorld(citizen.x, citizen.y, this.position);
      const visible = isCitizenOutside(citizen);
      let track = this.tracks.get(citizen.id);
      if (!track) {
        track = {
          fromX: x,
          fromZ: z,
          toX: x,
          toZ: z,
          heading: 0,
          visible,
          mood: 'neutral',
          phase: citizen.id * 1.7,
          id: citizen.id,
        };
        this.tracks.set(citizen.id, track);
      } else if (visible && !track.visible) {
        // Just stepped outside: start here instead of sliding from where they went in.
        track.fromX = x;
        track.fromZ = z;
      } else {
        track.fromX = track.toX;
        track.fromZ = track.toZ;
      }
      track.toX = x;
      track.toZ = z;
      track.visible = visible;
      track.mood = getMood(citizen.happiness);
    }
    for (const id of this.tracks.keys()) {
      if (!alive.has(id)) this.tracks.delete(id);
    }
  }

  /** `alpha` is the progress (0..1) from the previous tick towards the next one. */
  render(alpha: number, timeSeconds: number): void {
    // Interpolate only; never extrapolate past either tick.
    alpha = THREE.MathUtils.clamp(alpha, 0, 1);
    let drawn = 0;
    let marked = 0;
    for (const track of this.tracks.values()) {
      if (!track.visible || drawn >= this.capacity) continue;
      const dx = track.toX - track.fromX;
      const dz = track.toZ - track.fromZ;
      const moving = Math.hypot(dx, dz) > 1e-4;
      if (moving) track.heading = Math.atan2(dx, dz);
      const bob = moving
        ? Math.abs(Math.sin(timeSeconds * CITIZEN_3D.bobSpeed + track.phase)) * CITIZEN_3D.bobHeight
        : 0;

      this.position.set(track.fromX + dx * alpha, SCENE_3D.tileTop + bob, track.fromZ + dz * alpha);
      this.rotation.setFromAxisAngle(UP, track.heading);
      this.matrix.compose(this.position, this.rotation, this.scale);
      this.body.setMatrixAt(drawn, this.matrix);
      this.shirts.setMatrixAt(drawn, this.matrix);
      this.shirts.setColorAt(drawn, this.shirtColors[track.id % this.shirtColors.length]);
      drawn++;

      if (track.mood !== 'neutral') {
        this.position.y += CITIZEN_3D.moodMarkerHeight;
        this.rotation.setFromAxisAngle(UP, timeSeconds * CITIZEN_3D.moodSpinSpeed + track.phase);
        this.matrix.compose(this.position, this.rotation, this.scale);
        this.moods.setMatrixAt(marked, this.matrix);
        this.moods.setColorAt(marked, this.moodColors[track.mood]);
        marked++;
      }
    }

    this.commit(this.body, drawn);
    this.commit(this.shirts, drawn);
    this.commit(this.moods, marked);
  }

  dispose(): void {
    for (const mesh of [this.body, this.shirts, this.moods]) {
      this.scene.remove(mesh);
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    }
    // Body and shirt geometries are shared cached models; the marker geometry is ours.
    this.moods.geometry.dispose();
  }

  private createMesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
    mesh.count = 0;
    mesh.castShadow = true;
    // Citizens roam the whole map; skip culling against a single model's bounds.
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    return mesh;
  }

  private commit(mesh: THREE.InstancedMesh, count: number): void {
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}
