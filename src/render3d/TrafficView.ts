import * as THREE from 'three';
import type { Building } from '../building/types';
import { TRAFFIC } from '../config/gameConfig';
import { tileToWorld } from './coords';
import { box, merge, part } from './modelParts';

interface Vehicle {
  col: number;
  row: number;
  nextCol: number;
  nextRow: number;
  /** Progress from the current tile to the next, 0..1. */
  t: number;
  speed: number;
  rail: boolean;
  colour: THREE.Color;
}

const key = (col: number, row: number): number => col * 1000 + row;

/**
 * Cars on the roads and a train on the rails: small, constant movement, so a city that is
 * merely being watched still looks alive (Phase 2 §1.2).
 */
export class TrafficView {
  private readonly material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 });
  private readonly cars: THREE.InstancedMesh;
  private readonly trains: THREE.InstancedMesh;
  private vehicles: Vehicle[] = [];
  /** Road and rail tiles, by tile key. */
  private network = new Map<number, boolean>();
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(
    private readonly scene: THREE.Scene,
    private limit: number = TRAFFIC.maxVehicles,
  ) {
    this.cars = this.createMesh(
      merge([
        part(box(0.16, 0.07, 0.26), 'white', { y: 0.055 }),
        part(box(0.13, 0.06, 0.12), 'glass', { y: 0.11, z: -0.02 }),
        part(box(0.17, 0.03, 0.06), 'iron', { y: 0.03, z: 0.1 }),
      ]),
    );
    this.trains = this.createMesh(
      merge([
        part(box(0.2, 0.12, 0.62), 'clothRed', { y: 0.11 }),
        part(box(0.22, 0.04, 0.64), 'iron', { y: 0.05 }),
        part(box(0.16, 0.07, 0.14), 'glass', { y: 0.19, z: -0.2 }),
      ]),
    );
  }

  /** Rebuilds the road network and keeps the right number of vehicles on it. */
  sync(buildings: readonly Building[]): void {
    this.network = new Map();
    let roads = 0;
    let rails = 0;
    for (const building of buildings) {
      if (building.type === 'road') {
        this.network.set(key(building.col, building.row), false);
        roads++;
      } else if (building.type === 'railway') {
        this.network.set(key(building.col, building.row), true);
        rails++;
      }
    }

    // Drop vehicles whose road was moved away, then top up to the wanted number.
    this.vehicles = this.vehicles.filter((vehicle) => this.network.get(key(vehicle.col, vehicle.row)) === vehicle.rail);
    const wantedCars = Math.min(this.limit, Math.floor(roads / TRAFFIC.tilesPerCar));
    const wantedTrains = rails >= TRAFFIC.tilesPerTrain ? 1 : 0;
    this.fill(false, wantedCars);
    this.fill(true, wantedTrains);
  }

  /** Moves every vehicle along and draws them. */
  animate(dtSeconds: number): void {
    const step = Math.min(dtSeconds, 0.25);
    let cars = 0;
    let trains = 0;
    for (const vehicle of this.vehicles) {
      vehicle.t += step * vehicle.speed;
      while (vehicle.t >= 1) {
        vehicle.t -= 1;
        const fromCol = vehicle.col;
        const fromRow = vehicle.row;
        vehicle.col = vehicle.nextCol;
        vehicle.row = vehicle.nextRow;
        const next = this.pickNext(vehicle, fromCol, fromRow);
        vehicle.nextCol = next.col;
        vehicle.nextRow = next.row;
      }

      const from = tileToWorld(vehicle.col, vehicle.row);
      const to = tileToWorld(vehicle.nextCol, vehicle.nextRow);
      this.position.lerpVectors(from, to, vehicle.t);
      const heading = Math.atan2(to.x - from.x, to.z - from.z);
      this.rotation.setFromAxisAngle(this.up, heading);
      this.matrix.compose(this.position, this.rotation, this.scale);

      const mesh = vehicle.rail ? this.trains : this.cars;
      const index = vehicle.rail ? trains++ : cars++;
      mesh.setMatrixAt(index, this.matrix);
      mesh.setColorAt(index, vehicle.colour);
    }
    this.commit(this.cars, cars);
    this.commit(this.trains, trains);
  }

  /** Vehicles drawn at most; lower quality settings keep the streets quieter. */
  setLimit(limit: number): void {
    this.limit = limit;
    if (this.vehicles.length > limit) this.vehicles.length = limit;
  }

  dispose(): void {
    for (const mesh of [this.cars, this.trains]) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.dispose();
    }
    this.material.dispose();
  }

  private createMesh(geometry: THREE.BufferGeometry): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, this.material, TRAFFIC.maxVehicles);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    mesh.count = 0;
    this.scene.add(mesh);
    return mesh;
  }

  private fill(rail: boolean, wanted: number): void {
    const mine = this.vehicles.filter((vehicle) => vehicle.rail === rail);
    if (mine.length > wanted) {
      const extra = new Set(mine.slice(wanted));
      this.vehicles = this.vehicles.filter((vehicle) => !extra.has(vehicle));
      return;
    }
    const tiles = [...this.network.entries()].filter(([, isRail]) => isRail === rail);
    for (let i = mine.length; i < wanted && tiles.length > 0; i++) {
      const [tileKey] = tiles[Math.floor(Math.random() * tiles.length)];
      const col = Math.floor(tileKey / 1000);
      const row = tileKey % 1000;
      const vehicle: Vehicle = {
        col,
        row,
        nextCol: col,
        nextRow: row,
        t: Math.random(),
        speed: rail
          ? TRAFFIC.trainSpeed
          : TRAFFIC.carSpeed[0] + Math.random() * (TRAFFIC.carSpeed[1] - TRAFFIC.carSpeed[0]),
        rail,
        colour: new THREE.Color(
          rail ? TRAFFIC.trainColor : TRAFFIC.carColors[Math.floor(Math.random() * TRAFFIC.carColors.length)],
        ),
      };
      const next = this.pickNext(vehicle, col, row);
      vehicle.nextCol = next.col;
      vehicle.nextRow = next.row;
      this.vehicles.push(vehicle);
    }
  }

  /** The next tile to drive to: anywhere connected, preferring not to turn straight back. */
  private pickNext(vehicle: Vehicle, fromCol: number, fromRow: number): { col: number; row: number } {
    const options: { col: number; row: number }[] = [];
    for (const [dCol, dRow] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const) {
      const col = vehicle.col + dCol;
      const row = vehicle.row + dRow;
      if (this.network.get(key(col, row)) === vehicle.rail) options.push({ col, row });
    }
    if (options.length === 0) return { col: vehicle.col, row: vehicle.row };
    const forward = options.filter((option) => option.col !== fromCol || option.row !== fromRow);
    const choices = forward.length > 0 ? forward : options;
    return choices[Math.floor(Math.random() * choices.length)];
  }

  private commit(mesh: THREE.InstancedMesh, count: number): void {
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}
