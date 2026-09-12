import * as THREE from 'three';
import type { Building } from '../building/types';
import { BUILDINGS } from '../config/balance';
import { DAY_NIGHT } from '../config/gameConfig';
import { tileToWorld } from './coords';

/**
 * Lit windows and street lamps after dark. A city that lights up at night is one of the
 * clearest signs it has grown (Phase 2 §1.1).
 */
export class NightLightsView {
  private readonly geometry = new THREE.BoxGeometry(0.1, 0.07, 0.04);
  private readonly material = new THREE.MeshBasicMaterial({
    color: DAY_NIGHT.lampColor,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  private readonly mesh: THREE.InstancedMesh;
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    capacity = 600,
  ) {
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  /** One light per building; roads and paths get a low lamp instead of a window. */
  sync(buildings: readonly Building[]): void {
    let index = 0;
    for (const building of buildings) {
      if (index >= this.mesh.instanceMatrix.count) break;
      const definition = BUILDINGS[building.type];
      // Fields, parks and bare ground have nothing to light up.
      const lit =
        definition.populationCapacity > 0 ||
        definition.jobs > 0 ||
        definition.goldPerSecond > 0 ||
        definition.research > 0 ||
        building.type === 'road' ||
        building.type === 'railway';
      if (!lit) continue;

      tileToWorld(building.col, building.row, this.position);
      const street = building.type === 'road' || building.type === 'railway';
      this.mesh.setMatrixAt(
        index++,
        this.matrix.makeTranslation(
          this.position.x + (street ? 0.3 : 0),
          this.position.y + (street ? 0.26 : 0.24),
          this.position.z + (street ? 0.3 : 0.29),
        ),
      );
    }
    this.mesh.count = index;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Fades the lights in as it gets dark. */
  setDarkness(darkness: number): void {
    this.material.opacity = darkness * DAY_NIGHT.lampOpacity;
    this.mesh.visible = darkness > 0.02 && this.mesh.count > 0;
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
