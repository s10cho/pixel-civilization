import * as THREE from 'three';
import type { Building } from '../building/types';
import { SIGNAL_LIGHTS } from '../config/gameConfig';
import { roadLaneWith } from '../world/roads';
import { carsMayPass, crossingSignalAt, signalAt } from '../world/signals';
import { tileToWorld } from './coords';
import { box, cylinder, merge, part } from './modelParts';

interface Light {
  col: number;
  row: number;
  /** A junction lamp speaks for one direction of traffic; a crossing lamp speaks for people. */
  kind: 'junction' | 'crossing';
  axis: 'x' | 'z';
  x: number;
  z: number;
}

const key = (col: number, row: number): number => col * 1000 + row;

/** Traffic lights at the junctions: one lamp per direction, so the phase is readable. */
export class TrafficLightsView {
  private readonly poleMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
  // Plain white: the colour of each lamp comes from its instance.
  private readonly lampMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  private readonly poles: THREE.InstancedMesh;
  private readonly lamps: THREE.InstancedMesh;
  private lights: Light[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly colour = new THREE.Color();
  private readonly green = new THREE.Color(SIGNAL_LIGHTS.green);
  private readonly red = new THREE.Color(SIGNAL_LIGHTS.red);

  constructor(
    private readonly scene: THREE.Scene,
    capacity = 260,
  ) {
    const pole = merge([
      part(cylinder(0.018, 0.022, SIGNAL_LIGHTS.poleHeight, 6), 'iron', { y: SIGNAL_LIGHTS.poleHeight / 2 }),
      part(box(0.07, 0.13, 0.06), 'roofDark', { y: SIGNAL_LIGHTS.poleHeight + 0.06 }),
    ]);
    this.poles = new THREE.InstancedMesh(pole, this.poleMaterial, capacity);
    this.poles.castShadow = true;
    this.poles.frustumCulled = false;
    this.poles.count = 0;
    scene.add(this.poles);

    this.lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.06, 0.03), this.lampMaterial, capacity);
    this.lamps.frustumCulled = false;
    this.lamps.count = 0;
    scene.add(this.lamps);
  }

  /** Puts a pair of lights on every junction, and a pedestrian light beside every crossing. */
  sync(buildings: readonly Building[]): void {
    const roads = new Set<number>();
    for (const building of buildings) {
      if (building.type === 'road') roads.add(key(building.col, building.row));
    }
    const isRoadAt = (col: number, row: number): boolean => roads.has(key(col, row));

    this.lights = [];
    for (const tile of roads) {
      const col = Math.floor(tile / 1000);
      const row = tile % 1000;
      const lane = roadLaneWith(isRoadAt, col, row);
      if (this.lights.length + 2 > this.poles.instanceMatrix.count) break;
      if (lane.axis === 'junction') {
        // One lamp faces the east-west traffic, the other the north-south.
        this.lights.push({ col, row, kind: 'junction', axis: 'x', x: -SIGNAL_LIGHTS.cornerOffset, z: -SIGNAL_LIGHTS.cornerOffset });
        this.lights.push({ col, row, kind: 'junction', axis: 'z', x: SIGNAL_LIGHTS.cornerOffset, z: SIGNAL_LIGHTS.cornerOffset });
        continue;
      }
      // A zebra crossing gets a pedestrian light on each kerb, so both sides can read it.
      // On a wide road only the outermost tiles carry one, or the poles would stand in traffic.
      if (!lane.crossing) continue;
      const axis = lane.axis;
      const alongX = axis === 'x';
      const edge = SIGNAL_LIGHTS.kerbOffset;
      const along = -SIGNAL_LIGHTS.cornerOffset;
      if (lane.index === 0) {
        this.lights.push({ col, row, kind: 'crossing', axis, x: alongX ? along : -edge, z: alongX ? -edge : along });
      }
      if (lane.index === lane.width - 1) {
        this.lights.push({ col, row, kind: 'crossing', axis, x: alongX ? along : edge, z: alongX ? edge : along });
      }
    }

    this.lights.forEach((light, index) => {
      tileToWorld(light.col, light.row, this.position);
      this.poles.setMatrixAt(
        index,
        this.matrix.makeTranslation(this.position.x + light.x, this.position.y, this.position.z + light.z),
      );
      this.lamps.setMatrixAt(
        index,
        this.matrix.makeTranslation(
          this.position.x + light.x,
          this.position.y + SIGNAL_LIGHTS.poleHeight + 0.06,
          this.position.z + light.z + 0.035,
        ),
      );
    });
    this.poles.count = this.lights.length;
    this.lamps.count = this.lights.length;
    this.poles.instanceMatrix.needsUpdate = true;
    this.lamps.instanceMatrix.needsUpdate = true;
  }

  /** Lights the lamps for the current phase. */
  animate(timeOfDay: number): void {
    this.lights.forEach((light, index) => {
      const go =
        light.kind === 'crossing'
          ? crossingSignalAt(timeOfDay, light.col, light.row, light.axis) === 'walk'
          : carsMayPass(signalAt(timeOfDay, light.col, light.row), light.axis);
      this.lamps.setColorAt(index, this.colour.copy(go ? this.green : this.red));
    });
    if (this.lamps.instanceColor) this.lamps.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    for (const mesh of [this.poles, this.lamps]) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.dispose();
    }
    this.poleMaterial.dispose();
    this.lampMaterial.dispose();
  }
}
