import * as THREE from 'three';
import type { Building } from '../building/types';
import { SMOKE } from '../config/gameConfig';
import type { EraOf } from './BuildingView';
import { tileToWorld } from './coords';
import { getSmokeEmitters } from './models';

/**
 * Chimney smoke for industrial buildings. Each chimney keeps a fixed number of puffs whose
 * position and size are derived from time alone, so there is no per-puff state to update.
 */
export class SmokeView {
  private readonly geometry = new THREE.IcosahedronGeometry(0.08, 0);
  private readonly material = new THREE.MeshStandardMaterial({
    color: SMOKE.color,
    transparent: true,
    opacity: SMOKE.opacity,
    depthWrite: false,
    flatShading: true,
  });
  private mesh: THREE.InstancedMesh | null = null;
  private emitters: THREE.Vector3[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    private puffsPerEmitter: number,
  ) {}

  /** Puffs per chimney; takes effect on the next sync. */
  setPuffs(puffs: number): void {
    this.puffsPerEmitter = puffs;
  }

  sync(buildings: readonly Building[], eraOf: EraOf): void {
    this.emitters = [];
    for (const building of buildings) {
      const base = tileToWorld(building.col, building.row);
      for (const offset of getSmokeEmitters(building.type, building.level, eraOf(building))) {
        this.emitters.push(base.clone().add(offset));
      }
    }
    const needed = this.emitters.length * this.puffsPerEmitter;
    if (!this.mesh || this.mesh.instanceMatrix.count < needed) {
      if (this.mesh) {
        this.scene.remove(this.mesh);
        this.mesh.dispose();
      }
      this.mesh = new THREE.InstancedMesh(this.geometry, this.material, Math.max(8, needed * 2));
      this.mesh.frustumCulled = false;
      this.scene.add(this.mesh);
    }
    this.mesh.count = needed;
  }

  animate(timeSeconds: number): void {
    if (!this.mesh || this.puffsPerEmitter === 0) return;
    const life = SMOKE.lifetimeSeconds;
    let index = 0;
    this.emitters.forEach((emitter, e) => {
      for (let k = 0; k < this.puffsPerEmitter; k++) {
        const age = (timeSeconds + (k * life) / this.puffsPerEmitter + e * 0.37) % life;
        const t = age / life;
        this.position.set(
          emitter.x + SMOKE.drift[0] * age,
          emitter.y + SMOKE.riseSpeed * age,
          emitter.z + SMOKE.drift[1] * age,
        );
        // Swell while rising, then shrink away near the end of life.
        const size = t < 0.7 ? SMOKE.startScale + (SMOKE.peakScale - SMOKE.startScale) * (t / 0.7) : SMOKE.peakScale * (1 - (t - 0.7) / 0.3);
        this.scale.setScalar(Math.max(0, size));
        this.mesh!.setMatrixAt(index++, this.matrix.compose(this.position, this.rotation, this.scale));
      }
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.dispose();
    }
    this.geometry.dispose();
    this.material.dispose();
  }
}
