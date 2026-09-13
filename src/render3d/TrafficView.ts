import * as THREE from 'three';
import type { Building } from '../building/types';
import { isCitizenOutside } from '../citizen/behavior';
import type { Citizen } from '../citizen/types';
import { TRAFFIC } from '../config/gameConfig';
import { carsMayPass, signalAt } from '../world/signals';
import { roadLaneWith } from '../world/roads';
import { tileToWorld } from './coords';
import { box, merge, part } from './modelParts';

interface Vehicle {
  /** The tile it came from, the one it is crossing, and the one it is heading for. */
  fromCol: number;
  fromRow: number;
  col: number;
  row: number;
  nextCol: number;
  nextRow: number;
  /** Progress across the current tile, 0..1. */
  t: number;
  speed: number;
  rail: boolean;
  colour: THREE.Color;
}

/** What a tile asks of the traffic on it. */
type Control = 'junction' | 'crossing';

const key = (col: number, row: number): number => col * 1000 + row;

/**
 * Cars on the roads and a train on the rails. Vehicles curve through their tile rather than
 * cutting corners, keep to the right-hand lane, stop at red lights and give way to anyone on
 * a zebra crossing.
 */
export class TrafficView {
  private readonly material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 });
  private readonly cars: THREE.InstancedMesh;
  private readonly trains: THREE.InstancedMesh;
  private vehicles: Vehicle[] = [];
  /** Road and rail tiles: true for rail. */
  private network = new Map<number, boolean>();
  /** Tiles where the traffic has to watch out. */
  private controls = new Map<number, Control>();
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly tangent = new THREE.Vector3();
  private readonly entry = new THREE.Vector3();
  private readonly exit = new THREE.Vector3();
  private readonly centre = new THREE.Vector3();
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

  /** Rebuilds the network, the places traffic must watch, and the number of vehicles. */
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

    const isRoadAt = (col: number, row: number): boolean => this.network.get(key(col, row)) === false;
    this.controls = new Map();
    for (const [tile, rail] of this.network) {
      if (rail) continue;
      const col = Math.floor(tile / 1000);
      const row = tile % 1000;
      const lane = roadLaneWith(isRoadAt, col, row);
      if (lane.axis === 'junction') this.controls.set(tile, 'junction');
      else if (lane.crossing) this.controls.set(tile, 'crossing');
    }

    this.vehicles = this.vehicles.filter((vehicle) => this.network.get(key(vehicle.col, vehicle.row)) === vehicle.rail);
    this.fill(false, Math.min(this.limit, Math.floor(roads / TRAFFIC.tilesPerCar)));
    this.fill(true, rails >= TRAFFIC.tilesPerTrain ? 1 : 0);
  }

  /** Moves every vehicle along its tile and draws them. */
  animate(dtSeconds: number, timeOfDay: number, citizens: readonly Citizen[]): void {
    const step = Math.min(dtSeconds, 0.25);
    const onCrossings = new Set<number>();
    for (const citizen of citizens) {
      if (isCitizenOutside(citizen)) onCrossings.add(key(Math.floor(citizen.x), Math.floor(citizen.y)));
    }

    let cars = 0;
    let trains = 0;
    for (const vehicle of this.vehicles) {
      vehicle.t += step * vehicle.speed;
      if (vehicle.t >= 1) {
        if (this.mayEnter(vehicle, timeOfDay, onCrossings)) {
          vehicle.t -= 1;
          vehicle.fromCol = vehicle.col;
          vehicle.fromRow = vehicle.row;
          vehicle.col = vehicle.nextCol;
          vehicle.row = vehicle.nextRow;
          const next = this.pickNext(vehicle);
          vehicle.nextCol = next.col;
          vehicle.nextRow = next.row;
        } else {
          // Hold at the stop line until the way is clear.
          vehicle.t = TRAFFIC.stopLine;
        }
      }

      // A curve through the tile: in at one edge, out at the next, bending round the middle.
      tileToWorld(vehicle.col, vehicle.row, this.centre);
      this.entry.copy(tileToWorld(vehicle.fromCol, vehicle.fromRow)).add(this.centre).multiplyScalar(0.5);
      this.exit.copy(tileToWorld(vehicle.nextCol, vehicle.nextRow)).add(this.centre).multiplyScalar(0.5);
      const t = vehicle.t;
      this.position
        .copy(this.entry)
        .multiplyScalar((1 - t) * (1 - t))
        .addScaledVector(this.centre, 2 * (1 - t) * t)
        .addScaledVector(this.exit, t * t);
      this.tangent
        .copy(this.centre)
        .sub(this.entry)
        .multiplyScalar(2 * (1 - t))
        .addScaledVector(this.exit.clone().sub(this.centre), 2 * t);

      if (this.tangent.lengthSq() > 1e-6) {
        this.tangent.normalize();
        // Cars keep right of the centre line; trains run down the middle of their rails.
        if (!vehicle.rail) {
          this.position.x += -this.tangent.z * TRAFFIC.laneOffset;
          this.position.z += this.tangent.x * TRAFFIC.laneOffset;
        }
        this.rotation.setFromAxisAngle(this.up, Math.atan2(this.tangent.x, this.tangent.z));
      }
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

  /** Red lights stop traffic at junctions; at a zebra crossing, people come first. */
  private mayEnter(vehicle: Vehicle, timeOfDay: number, pedestrians: Set<number>): boolean {
    if (vehicle.rail) return true;
    const tile = key(vehicle.nextCol, vehicle.nextRow);
    const control = this.controls.get(tile);
    if (!control) return true;
    if (control === 'crossing') return !pedestrians.has(tile);
    const axis = vehicle.nextCol === vehicle.col ? 'z' : 'x';
    return carsMayPass(signalAt(timeOfDay, vehicle.nextCol, vehicle.nextRow), axis);
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
        fromCol: col,
        fromRow: row,
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
      const next = this.pickNext(vehicle);
      vehicle.nextCol = next.col;
      vehicle.nextRow = next.row;
      // Come in along the same line, so the first tile is not a strange swerve.
      vehicle.fromCol = col - (next.col - col);
      vehicle.fromRow = row - (next.row - row);
      this.vehicles.push(vehicle);
    }
  }

  /** The next tile to drive to: anywhere connected, preferring not to turn straight back. */
  private pickNext(vehicle: Vehicle): { col: number; row: number } {
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
    const onwards = options.filter((option) => option.col !== vehicle.fromCol || option.row !== vehicle.fromRow);
    const choices = onwards.length > 0 ? onwards : options;
    return choices[Math.floor(Math.random() * choices.length)];
  }

  private commit(mesh: THREE.InstancedMesh, count: number): void {
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}
