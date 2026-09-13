import * as THREE from 'three';
import type { Building } from '../building/types';
import { isCitizenOutside } from '../citizen/behavior';
import type { Citizen } from '../citizen/types';
import { TRAFFIC } from '../config/gameConfig';
import { carsMayPass, crossingSignalAt, signalAt } from '../world/signals';
import { roadLaneWith } from '../world/roads';
import { tileToWorld } from './coords';
import { TRACK } from '../config/gameConfig';
import { box, cylinder, merge, part } from './modelParts';

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
  /** Where a train has been, so its carriages can follow the same rails. */
  trail?: TrailPoint[];
  /** How far the train has run in all, in tiles. */
  travelled: number;
}

/** One remembered point of a train's path. */
interface TrailPoint {
  x: number;
  z: number;
  angle: number;
  travelled: number;
}

/** What a tile asks of the traffic on it. */
type Control = 'junction' | 'crossing';

const key = (col: number, row: number): number => col * 1000 + row;


/** Height of the rail head, so the wheels sit on the track rather than in it. */
const RAIL_TOP = TRACK.bedHeight + TRACK.sleeperHeight + TRACK.railHeight;

/** The bogies and buffers every vehicle on the line shares. */
function runningGear(length: number): THREE.BufferGeometry[] {
  return [
    part(box(0.24, 0.035, length), 'iron', { y: RAIL_TOP + 0.018 }),
    // Wheels: a pair under each end, just inside the rails.
    ...[-length / 2 + 0.1, length / 2 - 0.1].flatMap((z) =>
      [-TRACK.gauge / 2, TRACK.gauge / 2].map((x) =>
        part(cylinder(0.035, 0.035, 0.02, 8).rotateZ(Math.PI / 2), 'roofDark', { x, y: RAIL_TOP - 0.01, z }),
      ),
    ),
  ];
}

/**
 * The locomotive, built along +Z because that is the way a vehicle faces: a boiler up front
 * with its chimney and dome, the cab behind it, and a buffer beam at the nose.
 */
function locomotiveParts(): THREE.BufferGeometry[] {
  const length = 0.5;
  const floor = RAIL_TOP + 0.035;
  return [
    ...runningGear(length),
    // Boiler: a barrel lying along the track, with a smokebox band at the front.
    part(cylinder(0.08, 0.08, 0.28, 10).rotateX(Math.PI / 2), 'trainBody', { y: floor + 0.08, z: 0.08 }),
    part(cylinder(0.085, 0.085, 0.035, 10).rotateX(Math.PI / 2), 'roofDark', { y: floor + 0.08, z: 0.22 }),
    part(box(0.17, 0.02, 0.26), 'trainTrim', { y: floor + 0.082, z: 0.08 }),
    // Cab: a green lower half, a window either side, and a dark roof capping it.
    part(box(0.19, 0.09, 0.18), 'trainBody', { y: floor + 0.045, z: -0.16 }),
    part(box(0.195, 0.055, 0.18), 'trainBody', { y: floor + 0.118, z: -0.16 }),
    part(box(0.2, 0.045, 0.1), 'glass', { y: floor + 0.118, z: -0.16 }),
    part(box(0.2, 0.028, 0.2), 'roofDark', { y: floor + 0.16, z: -0.16 }),
    // Chimney over the smokebox, steam dome over the boiler.
    part(cylinder(0.026, 0.034, 0.075, 8), 'roofDark', { y: floor + 0.195, z: 0.18 }),
    part(cylinder(0.032, 0.032, 0.035, 8), 'trainTrim', { y: floor + 0.175, z: 0.04 }),
    // Buffer beam and lamp at the nose.
    part(box(0.23, 0.05, 0.03), 'clothRed', { y: RAIL_TOP + 0.05, z: length / 2 }),
    part(box(0.04, 0.04, 0.03), 'gold', { y: RAIL_TOP + 0.1, z: length / 2 }),
  ];
}

/** A passenger carriage: a body on the same running gear, with a band of windows. */
function carriageParts(): THREE.BufferGeometry[] {
  const length = 0.34;
  const floor = RAIL_TOP + 0.035;
  return [
    ...runningGear(length),
    part(box(0.19, 0.085, length), 'trainBody', { y: floor + 0.043 }),
    // A cream band with the windows set into it, so a carriage reads as one at a glance.
    part(box(0.195, 0.055, length), 'trainTrim', { y: floor + 0.115 }),
    part(box(0.2, 0.036, length - 0.09), 'glass', { y: floor + 0.115 }),
    part(box(0.2, 0.028, length), 'roofDark', { y: floor + 0.157 }),
  ];
}

/** The point on a train's trail a given distance behind its head, or null if it is not there yet. */
function sampleTrail(trail: TrailPoint[], travelled: number): TrailPoint | null {
  if (trail.length < 2 || trail[0].travelled > travelled) return null;
  for (let i = trail.length - 1; i > 0; i--) {
    const ahead = trail[i];
    const behind = trail[i - 1];
    if (behind.travelled > travelled) continue;
    const span = ahead.travelled - behind.travelled;
    const along = span > 1e-6 ? (travelled - behind.travelled) / span : 0;
    // Angles wrap, so turn towards the next one the short way round.
    let turn = ahead.angle - behind.angle;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    return {
      x: behind.x + (ahead.x - behind.x) * along,
      z: behind.z + (ahead.z - behind.z) * along,
      angle: behind.angle + turn * along,
      travelled,
    };
  }
  return null;
}

/**
 * Cars on the roads and a train on the rails. Vehicles curve through their tile rather than
 * cutting corners, keep to the right-hand lane, stop at red lights and give way to anyone on
 * a zebra crossing.
 */
export class TrafficView {
  private readonly material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 });
  private readonly cars: THREE.InstancedMesh;
  private readonly trains: THREE.InstancedMesh;
  private readonly carriages: THREE.InstancedMesh;
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
    this.trains = this.createMesh(merge(locomotiveParts()));
    this.carriages = this.createMesh(merge(carriageParts()));
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
    let carriages = 0;
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

      if (!vehicle.rail) {
        const index = cars++;
        this.cars.setMatrixAt(index, this.matrix);
        this.cars.setColorAt(index, vehicle.colour);
        continue;
      }

      const index = trains++;
      this.trains.setMatrixAt(index, this.matrix);
      this.trains.setColorAt(index, vehicle.colour);
      carriages = this.drawCarriages(vehicle, carriages);
    }
    this.commit(this.cars, cars);
    this.commit(this.trains, trains);
    this.commit(this.carriages, carriages);
  }

  /**
   * Remembers where the locomotive has been and puts the carriages on that same line, so a
   * train bends round a curve instead of sliding through it sideways.
   */
  private drawCarriages(vehicle: Vehicle, from: number): number {
    const angle = Math.atan2(this.tangent.x, this.tangent.z);
    const trail = (vehicle.trail ??= []);
    const last = trail[trail.length - 1];
    const moved = last ? Math.hypot(this.position.x - last.x, this.position.z - last.z) : 0;
    if (!last || moved > 1e-4) {
      vehicle.travelled += moved;
      trail.push({ x: this.position.x, z: this.position.z, angle, travelled: vehicle.travelled });
    }
    // Only the stretch the carriages still stand on is worth keeping.
    const keep = TRAFFIC.couplingToFirst + TRAFFIC.carriageSpacing * TRAFFIC.trainCarriages;
    while (trail.length > 2 && trail[1].travelled < vehicle.travelled - keep) trail.shift();

    let count = from;
    for (let i = 1; i <= TRAFFIC.trainCarriages; i++) {
      const back = TRAFFIC.couplingToFirst + (i - 1) * TRAFFIC.carriageSpacing;
      const point = sampleTrail(trail, vehicle.travelled - back);
      if (!point) break;
      this.position.set(point.x, this.position.y, point.z);
      this.rotation.setFromAxisAngle(this.up, point.angle);
      this.matrix.compose(this.position, this.rotation, this.scale);
      this.carriages.setMatrixAt(count, this.matrix);
      this.carriages.setColorAt(count, vehicle.colour);
      count++;
    }
    return count;
  }

  /** Vehicles drawn at most; lower quality settings keep the streets quieter. */
  setLimit(limit: number): void {
    this.limit = limit;
    if (this.vehicles.length > limit) this.vehicles.length = limit;
  }

  dispose(): void {
    for (const mesh of [this.cars, this.trains, this.carriages]) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.dispose();
    }
    this.material.dispose();
  }

  /** Red lights stop traffic at junctions and crossings, and anyone still on the road comes first. */
  private mayEnter(vehicle: Vehicle, timeOfDay: number, pedestrians: Set<number>): boolean {
    if (vehicle.rail) return true;
    const tile = key(vehicle.nextCol, vehicle.nextRow);
    const control = this.controls.get(tile);
    if (!control) return true;
    if (pedestrians.has(tile)) return false;
    const axis = vehicle.nextCol === vehicle.col ? 'z' : 'x';
    if (control === 'crossing') {
      return crossingSignalAt(timeOfDay, vehicle.nextCol, vehicle.nextRow, axis) === 'cars';
    }
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
        travelled: 0,
        // Cars are painted per instance; the train carries its livery in its own geometry.
        colour: new THREE.Color(
          rail ? 0xffffff : TRAFFIC.carColors[Math.floor(Math.random() * TRAFFIC.carColors.length)],
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
