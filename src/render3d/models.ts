import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { BuildingType } from '../building/types';
import type { EraId } from '../progression/era';

/**
 * Procedural low-poly models (1 world unit = 1 tile, origin on the tile surface). Each building
 * has a model per era, so the city visibly evolves. Models are merged into single
 * vertex-coloured geometries so each can be drawn with one InstancedMesh.
 */

export const PALETTE = {
  grass: 0x7cb85a,
  soil: 0x8a6a45,
  houseWall: 0xf1e3c6,
  houseRoof: 0x4f7fc2,
  shopWall: 0xf2c65e,
  shopAwning: 0xd9534f,
  hallWall: 0xe9d3a8,
  hallRoof: 0xa0522d,
  door: 0x6b4a2a,
  window: 0x9fd3f0,
  parkGrass: 0x8fcf6a,
  trunk: 0x7a5230,
  leaves: 0x3f8f3f,
  leavesAlt: 0x57a846,
  flower: 0xffd84d,
  flag: 0xe63946,
  skin: 0xf2c9a0,
  pants: 0x3b3340,
  white: 0xffffff,
  millWall: 0xd8cfc0,
  sail: 0xf4efe6,
  brick: 0xb5523b,
  brickDark: 0x7a3526,
  roofDark: 0x4a4f5a,
  stone: 0xbfb8aa,
  gold: 0xf2c14e,
  parchment: 0xe8dfc0,
  crop: 0x9ac34a,
  cropRipe: 0xd9b24a,
  hay: 0xe0c069,
  forge: 0xff7a3c,
  glass: 0xbfe3f5,
  thatch: 0xc9a24a,
  mud: 0xcfb38a,
  wood: 0x9b6b3f,
  woodDark: 0x6e4a2b,
  cloth: 0xe8d9b5,
  clothRed: 0xc8553d,
  tileRoof: 0xb0472f,
  plaster: 0xefe6d2,
  slate: 0x56606e,
  concrete: 0xc9c6bf,
  dome: 0x7aa6c2,
  water: 0x5aa0c8,
  iron: 0x5a5f66,
  hedge: 0x3f7f3a,
  path: 0xd8c9a0,
} as const;

type ColorKey = keyof typeof PALETTE;

interface Placement {
  x?: number;
  y?: number;
  z?: number;
  rotX?: number;
  scale?: number;
}

const paint = new THREE.Color();

/** Transforms a primitive and colours every vertex, ready to be merged with other parts. */
function part(geometry: THREE.BufferGeometry, color: ColorKey, at: Placement = {}): THREE.BufferGeometry {
  if (at.scale) geometry.scale(at.scale, at.scale, at.scale);
  if (at.rotX) geometry.rotateX(at.rotX);
  geometry.translate(at.x ?? 0, at.y ?? 0, at.z ?? 0);

  paint.setHex(PALETTE[color]);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = paint.r;
    colors[i * 3 + 1] = paint.g;
    colors[i * 3 + 2] = paint.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cylinder = (top: number, bottom: number, height: number, segments = 8) =>
  new THREE.CylinderGeometry(top, bottom, height, segments);
/** Four-sided pyramid roof whose base lines up with boxes. */
const pyramid = (radius: number, height: number) =>
  new THREE.ConeGeometry(radius, height, 4).rotateY(Math.PI / 4);
const dome = (radius: number) => new THREE.SphereGeometry(radius, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // Boxes and cylinders are indexed but polyhedra are not; mergeGeometries needs one kind.
  const uniform = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  const merged = mergeGeometries(uniform);
  for (const p of [...parts, ...uniform]) p.dispose();
  if (!merged) throw new Error('Failed to merge model parts');
  return merged;
}

const buildingCache = new Map<string, THREE.BufferGeometry>();

/** Shared geometry for a building type at a level in an era. */
export function getBuildingGeometry(type: BuildingType, level: number, era: EraId): THREE.BufferGeometry {
  const key = `${type}:${level}:${era}`;
  let geometry = buildingCache.get(key);
  if (!geometry) {
    geometry = merge(buildingParts(type, level, era));
    buildingCache.set(key, geometry);
  }
  return geometry;
}

function buildingParts(type: BuildingType, level: number, era: EraId): THREE.BufferGeometry[] {
  const byEra = (ancient: () => THREE.BufferGeometry[], medieval: () => THREE.BufferGeometry[], industrial: () => THREE.BufferGeometry[]) =>
    (era === 'ancient' ? ancient : era === 'medieval' ? medieval : industrial)();

  switch (type) {
    case 'house':
      return byEra(
        () => hut(level),
        () => cottage(level),
        () => rowHouse(level),
      );
    case 'shop':
      return byEra(
        () => marketStall(level),
        () => market(level),
        () => store(level),
      );
    case 'townHall':
      return byEra(chiefsHall, townHall, cityHall);
    case 'park':
      return byEra(
        () => grove(level),
        () => garden(level),
        () => cityPark(level),
      );
    case 'powerPlant':
      return byEra(
        () => windmill(level),
        () => watermill(level),
        () => powerStation(level),
      );
    case 'researchCenter':
      return byEra(
        () => scholarsHut(level),
        () => library(level),
        () => laboratory(level),
      );
    case 'farm':
      return byEra(
        () => field(level),
        () => farmyard(level),
        () => plantation(level),
      );
    case 'workshop':
      return byEra(
        () => craftShed(level),
        () => smithy(level),
        () => machineShop(level),
      );
    case 'well':
      return byEra(
        () => well(level),
        () => waterTower(level),
        () => waterworks(level),
      );
    case 'inn':
      return byEra(
        () => tavern(level),
        () => inn(level),
        () => hotel(level),
      );
    case 'monument':
      return byEra(memorialStone, clockTower, observationDeck);
    case 'factory':
      return factory(level);
  }
}

// --- Houses ------------------------------------------------------------------------------

function hut(level: number): THREE.BufferGeometry[] {
  const wall = 0.26 + 0.05 * (level - 1);
  return [
    part(cylinder(0.25, 0.27, wall), 'mud', { y: wall / 2 }),
    part(new THREE.ConeGeometry(0.36, 0.34 + 0.04 * (level - 1), 8), 'thatch', { y: wall + 0.17 + 0.02 * (level - 1) }),
    part(box(0.1, 0.16, 0.04), 'woodDark', { y: 0.08, z: 0.25 }),
  ];
}

function cottage(level: number): THREE.BufferGeometry[] {
  const wall = 0.34 + 0.16 * (level - 1);
  return [
    part(box(0.56, wall, 0.48), 'plaster', { y: wall / 2 }),
    part(box(0.58, 0.04, 0.5), 'woodDark', { y: wall * 0.55 }),
    part(pyramid(0.46, 0.3), 'tileRoof', { y: wall + 0.15 }),
    part(box(0.08, 0.18, 0.08), 'stone', { x: 0.14, y: wall + 0.2, z: -0.08 }),
    part(box(0.12, 0.18, 0.02), 'door', { y: 0.09, z: 0.245 }),
    part(box(0.1, 0.1, 0.02), 'window', { x: -0.17, y: wall - 0.12, z: 0.245 }),
  ];
}

function rowHouse(level: number): THREE.BufferGeometry[] {
  const height = 0.46 + 0.14 * (level - 1);
  const parts = [
    part(box(0.6, height, 0.5), 'brick', { y: height / 2 }),
    part(box(0.64, 0.04, 0.54), 'slate', { y: height + 0.02 }),
    part(box(0.08, 0.14, 0.08), 'brickDark', { x: -0.2, y: height + 0.09, z: -0.12 }),
    part(box(0.08, 0.14, 0.08), 'brickDark', { x: 0.2, y: height + 0.09, z: -0.12 }),
    part(box(0.1, 0.16, 0.01), 'woodDark', { y: 0.08, z: 0.252 }),
  ];
  for (let y = 0.3; y < height - 0.05; y += 0.2) {
    parts.push(part(box(0.1, 0.1, 0.01), 'window', { x: -0.16, y, z: 0.252 }));
    parts.push(part(box(0.1, 0.1, 0.01), 'window', { x: 0.16, y, z: 0.252 }));
  }
  return parts;
}

// --- Shops -------------------------------------------------------------------------------

function marketStall(level: number): THREE.BufferGeometry[] {
  const post = 0.36 + 0.04 * (level - 1);
  const posts = [
    [-0.26, -0.2],
    [0.26, -0.2],
    [-0.26, 0.2],
    [0.26, 0.2],
  ].map(([x, z]) => part(box(0.04, post, 0.04), 'wood', { x, y: post / 2, z }));
  return [
    ...posts,
    part(box(0.64, 0.03, 0.5), 'cloth', { y: post + 0.01 }),
    part(box(0.64, 0.035, 0.16), 'clothRed', { y: post + 0.02 }),
    part(box(0.5, 0.14, 0.14), 'wood', { y: 0.07, z: 0.12 }),
    part(box(0.12, 0.1, 0.12), 'woodDark', { x: -0.18, y: 0.05, z: -0.12 }),
    part(box(0.1, 0.08, 0.1), 'thatch', { x: 0.16, y: 0.04, z: -0.14 }),
  ];
}

function market(level: number): THREE.BufferGeometry[] {
  const height = 0.32 + 0.1 * (level - 1);
  return [
    part(box(0.68, height, 0.56), 'shopWall', { y: height / 2 }),
    part(box(0.74, 0.05, 0.62), 'hallRoof', { y: height + 0.025 }),
    part(box(0.72, 0.04, 0.2), 'shopAwning', { y: height * 0.78, z: 0.34, rotX: 0.35 }),
    part(box(0.3, 0.1, 0.02), 'flag', { y: height - 0.06, z: 0.29 }),
    part(box(0.12, 0.1, 0.12), 'trunk', { x: 0.3, y: 0.05, z: 0.36 }),
  ];
}

function store(level: number): THREE.BufferGeometry[] {
  const height = 0.46 + 0.1 * (level - 1);
  return [
    part(box(0.7, height, 0.56), 'plaster', { y: height / 2 }),
    part(box(0.74, 0.05, 0.6), 'slate', { y: height + 0.025 }),
    part(box(0.5, 0.2, 0.01), 'window', { y: 0.15, z: 0.285 }),
    part(box(0.42, 0.08, 0.02), 'flag', { y: height - 0.08, z: 0.29 }),
    part(box(0.7, 0.03, 0.12), 'shopAwning', { y: 0.29, z: 0.33 }),
  ];
}

// --- Town halls --------------------------------------------------------------------------

function flagpole(x: number, y: number, z: number, cloth: ColorKey): THREE.BufferGeometry[] {
  return [
    part(cylinder(0.01, 0.01, 0.3, 4), 'woodDark', { x, y: y + 0.15, z }),
    part(box(0.14, 0.08, 0.01), cloth, { x: x + 0.07, y: y + 0.24, z }),
  ];
}

function chiefsHall(): THREE.BufferGeometry[] {
  return [
    part(box(0.86, 0.34, 0.6), 'wood', { y: 0.17 }),
    part(pyramid(0.6, 0.36).scale(1.25, 1, 0.85), 'thatch', { y: 0.52 }),
    part(cylinder(0.04, 0.05, 0.8, 6), 'woodDark', { x: 0.36, y: 0.4, z: 0.34 }),
    part(box(0.16, 0.1, 0.01), 'clothRed', { x: 0.44, y: 0.72, z: 0.34 }),
    part(box(0.16, 0.22, 0.02), 'woodDark', { y: 0.11, z: 0.305 }),
  ];
}

function townHall(): THREE.BufferGeometry[] {
  return [
    part(box(0.84, 0.46, 0.84), 'hallWall', { y: 0.23 }),
    part(pyramid(0.68, 0.36), 'hallRoof', { y: 0.64 }),
    part(box(0.2, 0.44, 0.2), 'hallWall', { x: 0.26, y: 0.68, z: 0.26 }),
    part(pyramid(0.17, 0.2), 'houseRoof', { x: 0.26, y: 1.0, z: 0.26 }),
    ...flagpole(0.26, 1.1, 0.26, 'flag'),
    part(box(0.16, 0.22, 0.02), 'door', { y: 0.11, z: 0.425 }),
  ];
}

function cityHall(): THREE.BufferGeometry[] {
  const columns = [-0.27, -0.09, 0.09, 0.27].map((x) =>
    part(cylinder(0.035, 0.035, 0.34), 'plaster', { x, y: 0.21, z: 0.36 }),
  );
  return [
    part(box(0.86, 0.44, 0.7), 'concrete', { y: 0.22, z: -0.05 }),
    ...columns,
    part(box(0.8, 0.06, 0.16), 'plaster', { y: 0.41, z: 0.36 }),
    part(box(0.26, 0.38, 0.26), 'concrete', { y: 0.63 }),
    part(box(0.12, 0.12, 0.01), 'white', { y: 0.68, z: 0.135 }),
    part(dome(0.15), 'dome', { y: 0.82 }),
    ...flagpole(0, 0.96, 0, 'flag'),
  ];
}

// --- Parks -------------------------------------------------------------------------------

const TREE_SPOTS: [number, number, number][] = [
  [-0.22, -0.2, 1],
  [0.24, 0.18, 0.85],
  [0.2, -0.24, 0.7],
  [-0.24, 0.24, 0.75],
];

function pineParts(x: number, z: number, scale: number): THREE.BufferGeometry[] {
  return [
    part(cylinder(0.035, 0.045, 0.16, 6), 'trunk', { x, y: 0.12 * scale, z, scale }),
    part(new THREE.ConeGeometry(0.17, 0.32, 7), 'leaves', { x, y: 0.34 * scale, z, scale }),
    part(new THREE.ConeGeometry(0.12, 0.22, 7), 'leavesAlt', { x, y: 0.5 * scale, z, scale }),
  ];
}

function broadleafParts(x: number, z: number, scale: number): THREE.BufferGeometry[] {
  return [
    part(cylinder(0.03, 0.04, 0.2, 6), 'trunk', { x, y: 0.14 * scale, z, scale }),
    part(new THREE.IcosahedronGeometry(0.16, 0), 'leaves', { x, y: 0.34 * scale, z, scale }),
    part(new THREE.IcosahedronGeometry(0.1, 0), 'leavesAlt', { x: x + 0.05 * scale, y: 0.44 * scale, z, scale }),
  ];
}

function grove(level: number): THREE.BufferGeometry[] {
  return [
    part(box(0.94, 0.04, 0.94), 'parkGrass', { y: 0.02 }),
    ...TREE_SPOTS.slice(0, 1 + level).flatMap(([x, z, s]) => pineParts(x, z, s)),
    part(new THREE.IcosahedronGeometry(0.07, 0), 'stone', { x: 0.1, y: 0.07, z: 0.05 }),
  ];
}

function garden(level: number): THREE.BufferGeometry[] {
  return [
    part(box(0.94, 0.04, 0.94), 'parkGrass', { y: 0.02 }),
    part(box(0.8, 0.1, 0.07), 'hedge', { y: 0.09, z: -0.38 }),
    part(box(0.07, 0.1, 0.7), 'hedge', { x: -0.38, y: 0.09 }),
    ...TREE_SPOTS.slice(0, Math.min(3, level)).flatMap(([x, z, s]) => broadleafParts(x, z, s)),
    part(box(0.22, 0.05, 0.08), 'wood', { y: 0.07, z: 0.1 }),
    part(box(0.05, 0.05, 0.05), 'flower', { x: 0.08, y: 0.065, z: -0.24 }),
    part(box(0.05, 0.05, 0.05), 'clothRed', { x: 0.3, y: 0.065, z: 0.3 }),
    part(box(0.05, 0.05, 0.05), 'flower', { x: -0.1, y: 0.065, z: 0.32 }),
  ];
}

function cityPark(level: number): THREE.BufferGeometry[] {
  return [
    part(box(0.94, 0.04, 0.94), 'parkGrass', { y: 0.02 }),
    part(box(0.94, 0.012, 0.16), 'path', { y: 0.046 }),
    part(box(0.16, 0.012, 0.94), 'path', { y: 0.046 }),
    part(cylinder(0.14, 0.16, 0.06, 10), 'stone', { y: 0.07 }),
    part(cylinder(0.11, 0.11, 0.02, 10), 'water', { y: 0.1 }),
    part(cylinder(0.02, 0.02, 0.14, 6), 'stone', { y: 0.14 }),
    ...[
      [-0.28, -0.28, 0.85],
      [0.28, 0.28, 0.8],
      [0.28, -0.28, 0.7],
    ]
      .slice(0, level)
      .flatMap(([x, z, s]) => broadleafParts(x, z, s)),
    part(cylinder(0.012, 0.012, 0.3, 6), 'iron', { x: -0.3, y: 0.19, z: 0.3 }),
    part(box(0.05, 0.05, 0.05), 'gold', { x: -0.3, y: 0.35, z: 0.3 }),
  ];
}

// --- Power -------------------------------------------------------------------------------

function windmillTowerHeight(level: number): number {
  return 0.62 + 0.06 * (level - 1);
}

function windmill(level: number): THREE.BufferGeometry[] {
  // The sails are a separate rotor so they can turn (see getRotor).
  const tower = windmillTowerHeight(level);
  return [
    part(cylinder(0.18, 0.26, tower), 'millWall', { y: tower / 2 }),
    part(new THREE.ConeGeometry(0.24, 0.24, 8), 'hallRoof', { y: tower + 0.12 }),
    part(box(0.12, 0.2, 0.02), 'door', { y: 0.1, z: 0.25 }),
    part(cylinder(0.03, 0.03, 0.12, 6), 'trunk', { y: tower - 0.04, z: 0.24, rotX: Math.PI / 2 }),
  ];
}

function watermill(level: number): THREE.BufferGeometry[] {
  // The wheel is a separate rotor turning in the channel beside the mill.
  const height = 0.4 + 0.05 * (level - 1);
  return [
    part(box(0.5, height, 0.5), 'stone', { x: -0.08, y: height / 2 }),
    part(pyramid(0.42, 0.26), 'tileRoof', { x: -0.08, y: height + 0.13 }),
    part(box(0.12, 0.2, 0.02), 'woodDark', { x: -0.08, y: 0.1, z: 0.255 }),
    part(box(0.16, 0.04, 0.9), 'water', { x: 0.33, y: 0.03 }),
  ];
}

function powerStation(level: number): THREE.BufferGeometry[] {
  const stack = 0.7 + 0.08 * (level - 1);
  return [
    part(box(0.7, 0.4, 0.54), 'brick', { y: 0.2 }),
    part(box(0.74, 0.04, 0.58), 'slate', { y: 0.42 }),
    part(cylinder(0.06, 0.08, stack), 'concrete', { x: -0.2, y: 0.4 + stack / 2, z: -0.15 }),
    part(cylinder(0.06, 0.08, stack), 'concrete', { x: 0.05, y: 0.4 + stack / 2, z: -0.15 }),
    part(box(0.14, 0.16, 0.14), 'iron', { x: 0.26, y: 0.08, z: 0.26 }),
    part(box(0.1, 0.12, 0.1), 'iron', { x: 0.26, y: 0.06, z: 0.06 }),
  ];
}

// --- Research ----------------------------------------------------------------------------

function scholarsHut(level: number): THREE.BufferGeometry[] {
  // A raised writing hut: a thatched room and an open porch with a low desk and scrolls.
  const wall = 0.3 + 0.05 * (level - 1);
  const floor = 0.06;
  return [
    part(box(0.84, floor, 0.74), 'wood', { y: floor / 2 }),
    part(box(0.5, wall, 0.46), 'mud', { x: -0.14, y: floor + wall / 2 }),
    part(box(0.52, 0.04, 0.48), 'woodDark', { x: -0.14, y: floor + wall }),
    part(pyramid(0.56, 0.3).scale(1.25, 1, 1), 'thatch', { x: -0.08, y: floor + wall + 0.16 }),
    part(cylinder(0.028, 0.032, wall, 6), 'woodDark', { x: 0.3, y: floor + wall / 2, z: 0.26 }),
    part(cylinder(0.028, 0.032, wall, 6), 'woodDark', { x: 0.3, y: floor + wall / 2, z: -0.26 }),
    // Low desk with a scroll and a stack of tablets.
    part(box(0.22, 0.03, 0.34), 'wood', { x: 0.22, y: floor + 0.11 }),
    part(box(0.03, 0.11, 0.03), 'woodDark', { x: 0.16, y: floor + 0.055, z: 0.14 }),
    part(box(0.03, 0.11, 0.03), 'woodDark', { x: 0.16, y: floor + 0.055, z: -0.14 }),
    part(cylinder(0.03, 0.03, 0.22, 8).rotateX(Math.PI / 2), 'parchment', { x: 0.24, y: floor + 0.15 }),
    part(box(0.12, 0.05, 0.1), 'plaster', { x: 0.1, y: floor + 0.15, z: -0.02 }),
  ];
}

function library(level: number): THREE.BufferGeometry[] {
  const height = 0.4 + 0.06 * (level - 1);
  return [
    part(box(0.7, height, 0.5), 'stone', { y: height / 2 }),
    part(pyramid(0.48, 0.3).scale(1.35, 1, 1), 'slate', { y: height + 0.15 }),
    part(box(0.08, 0.16, 0.01), 'window', { x: -0.22, y: height * 0.55, z: 0.252 }),
    part(box(0.08, 0.16, 0.01), 'window', { x: 0.22, y: height * 0.55, z: 0.252 }),
    part(box(0.12, 0.2, 0.02), 'woodDark', { y: 0.1, z: 0.252 }),
    part(box(0.16, height + 0.3, 0.16), 'stone', { x: 0.28, y: (height + 0.3) / 2, z: -0.18 }),
    part(pyramid(0.14, 0.2), 'slate', { x: 0.28, y: height + 0.4, z: -0.18 }),
  ];
}

function laboratory(level: number): THREE.BufferGeometry[] {
  const height = 0.36 + 0.06 * (level - 1);
  return [
    part(box(0.72, height, 0.56), 'concrete', { y: height / 2 }),
    part(box(0.74, 0.08, 0.58), 'window', { y: height * 0.7 }),
    part(cylinder(0.16, 0.16, 0.12, 12), 'concrete', { x: 0.14, y: height + 0.06, z: -0.06 }),
    part(dome(0.16), 'dome', { x: 0.14, y: height + 0.12, z: -0.06 }),
    part(cylinder(0.008, 0.008, 0.3, 4), 'iron', { x: -0.24, y: height + 0.15, z: -0.18 }),
  ];
}

// --- Industry ----------------------------------------------------------------------------

function factory(level: number): THREE.BufferGeometry[] {
  return [
    part(box(0.8, 0.4, 0.64), 'brick', { y: 0.2 }),
    // Sawtooth roof: two triangular prisms along the depth.
    part(cylinder(0.14, 0.14, 0.64, 3), 'roofDark', { x: -0.18, y: 0.44, rotX: Math.PI / 2 }),
    part(cylinder(0.14, 0.14, 0.64, 3), 'roofDark', { x: 0.14, y: 0.44, rotX: Math.PI / 2 }),
    part(cylinder(0.06, 0.08, factoryStack(level)), 'brickDark', { x: 0.3, y: 0.35 + factoryStack(level) / 2, z: -0.2 }),
    part(box(0.2, 0.24, 0.02), 'roofDark', { x: -0.15, y: 0.12, z: 0.325 }),
    part(box(0.14, 0.1, 0.02), 'window', { x: 0.2, y: 0.26, z: 0.325 }),
  ];
}

function factoryStack(level: number): number {
  return 0.55 + 0.08 * (level - 1);
}


// --- Farms -------------------------------------------------------------------------------

/** Rows of crops on tilled soil; more rows as the farm grows. */
function cropRows(count: number, colour: 'crop' | 'cropRipe', width = 0.82): THREE.BufferGeometry[] {
  const rows: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const z = count === 1 ? 0 : -0.34 + (0.68 * i) / (count - 1);
    rows.push(part(box(width, 0.07, 0.09), colour, { y: 0.085, z }));
  }
  return rows;
}

function field(level: number): THREE.BufferGeometry[] {
  return [
    part(box(0.94, 0.05, 0.94), 'soil', { y: 0.025 }),
    ...cropRows(2 + level, 'crop'),
    part(cylinder(0.018, 0.022, 0.2, 5), 'woodDark', { x: -0.42, y: 0.1, z: -0.42 }),
    part(cylinder(0.018, 0.022, 0.2, 5), 'woodDark', { x: 0.42, y: 0.1, z: 0.42 }),
  ];
}

function farmyard(level: number): THREE.BufferGeometry[] {
  return [
    part(box(0.94, 0.05, 0.94), 'soil', { y: 0.025 }),
    ...cropRows(1 + level, 'cropRipe', 0.5).map((row) => row.translate(0.18, 0, 0)),
    // A small barn with a haystack beside it.
    part(box(0.34, 0.26, 0.42), 'clothRed', { x: -0.28, y: 0.18 }),
    part(pyramid(0.3, 0.2).scale(1, 1, 1.15), 'tileRoof', { x: -0.28, y: 0.4 }),
    part(box(0.1, 0.14, 0.02), 'woodDark', { x: -0.28, y: 0.12, z: 0.22 }),
    part(new THREE.ConeGeometry(0.12, 0.2, 7), 'hay', { x: 0.02, y: 0.15, z: -0.34 }),
  ];
}

function plantation(level: number): THREE.BufferGeometry[] {
  const silo = 0.42 + 0.04 * (level - 1);
  return [
    part(box(0.94, 0.05, 0.94), 'soil', { y: 0.025 }),
    ...cropRows(2 + level, 'cropRipe', 0.56).map((row) => row.translate(0.14, 0, 0)),
    part(cylinder(0.11, 0.12, silo, 10), 'concrete', { x: -0.3, y: 0.05 + silo / 2, z: -0.16 }),
    part(new THREE.ConeGeometry(0.13, 0.12, 10), 'slate', { x: -0.3, y: 0.05 + silo + 0.06, z: -0.16 }),
    part(box(0.3, 0.22, 0.3), 'brick', { x: -0.28, y: 0.16, z: 0.26 }),
    part(box(0.34, 0.04, 0.34), 'slate', { x: -0.28, y: 0.28, z: 0.26 }),
  ];
}

// --- Workshops ---------------------------------------------------------------------------

function craftShed(level: number): THREE.BufferGeometry[] {
  const post = 0.34 + 0.04 * (level - 1);
  const posts = [
    [-0.3, -0.26],
    [0.3, -0.26],
    [-0.3, 0.26],
    [0.3, 0.26],
  ].map(([x, z]) => part(cylinder(0.03, 0.035, post, 6), 'woodDark', { x, y: post / 2, z }));
  return [
    part(box(0.76, 0.05, 0.68), 'wood', { y: 0.025 }),
    ...posts,
    part(pyramid(0.58, 0.24).scale(1.15, 1, 1), 'thatch', { y: post + 0.12 }),
    // Workbench with a log and tools.
    part(box(0.44, 0.06, 0.2), 'wood', { x: -0.05, y: 0.2, z: -0.12 }),
    part(cylinder(0.07, 0.07, 0.18, 8).rotateZ(Math.PI / 2), 'trunk', { x: 0.22, y: 0.12, z: 0.2 }),
    part(box(0.03, 0.14, 0.03), 'iron', { x: -0.16, y: 0.29, z: -0.12 }),
  ];
}

function smithy(level: number): THREE.BufferGeometry[] {
  const wall = 0.34 + 0.05 * (level - 1);
  return [
    part(box(0.62, wall, 0.54), 'stone', { x: -0.08, y: wall / 2 }),
    part(pyramid(0.5, 0.26).scale(1.2, 1, 1), 'slate', { x: -0.06, y: wall + 0.13 }),
    part(box(0.1, 0.26, 0.1), 'brickDark', { x: -0.3, y: wall + 0.13, z: -0.16 }),
    // Forge mouth glowing under the eaves, and an anvil on a block.
    part(box(0.16, 0.12, 0.02), 'forge', { x: -0.08, y: 0.12, z: 0.272 }),
    part(cylinder(0.07, 0.08, 0.1, 8), 'woodDark', { x: 0.28, y: 0.05, z: 0.16 }),
    part(box(0.16, 0.06, 0.09), 'iron', { x: 0.28, y: 0.13, z: 0.16 }),
  ];
}

function machineShop(level: number): THREE.BufferGeometry[] {
  const wall = 0.36 + 0.05 * (level - 1);
  return [
    part(box(0.78, wall, 0.6), 'brick', { y: wall / 2 }),
    part(box(0.82, 0.05, 0.64), 'slate', { y: wall + 0.025 }),
    part(box(0.6, 0.12, 0.01), 'glass', { y: wall * 0.66, z: 0.302 }),
    part(box(0.2, 0.1, 0.24), 'iron', { x: 0.2, y: wall + 0.08, z: -0.1 }),
    part(cylinder(0.05, 0.05, 0.12, 8), 'iron', { x: -0.22, y: wall + 0.09, z: -0.12 }),
    part(box(0.16, 0.16, 0.16), 'woodDark', { x: 0.3, y: 0.08, z: 0.34 }),
  ];
}

// --- Water -------------------------------------------------------------------------------

function well(level: number): THREE.BufferGeometry[] {
  const roof = 0.42 + 0.03 * (level - 1);
  return [
    part(cylinder(0.2, 0.22, 0.16, 10), 'stone', { y: 0.08 }),
    part(cylinder(0.15, 0.15, 0.03, 10), 'water', { y: 0.165 }),
    part(cylinder(0.022, 0.022, roof, 6), 'woodDark', { x: -0.16, y: 0.16 + roof / 2 }),
    part(cylinder(0.022, 0.022, roof, 6), 'woodDark', { x: 0.16, y: 0.16 + roof / 2 }),
    part(pyramid(0.3, 0.16).scale(1, 1, 0.8), 'thatch', { y: 0.16 + roof + 0.08 }),
    part(cylinder(0.02, 0.02, 0.3, 6).rotateZ(Math.PI / 2), 'wood', { y: 0.16 + roof - 0.03 }),
    part(cylinder(0.05, 0.045, 0.08, 8), 'wood', { y: 0.16 + roof - 0.12 }),
  ];
}

function waterTower(level: number): THREE.BufferGeometry[] {
  const legs = 0.34 + 0.04 * (level - 1);
  const tank = 0.26;
  const posts = [
    [-0.16, -0.16],
    [0.16, -0.16],
    [-0.16, 0.16],
    [0.16, 0.16],
  ].map(([x, z]) => part(box(0.045, legs, 0.045), 'woodDark', { x, y: legs / 2, z }));
  return [
    part(box(0.56, 0.05, 0.56), 'stone', { y: 0.025 }),
    ...posts,
    part(box(0.44, 0.04, 0.44), 'wood', { y: legs }),
    part(cylinder(0.2, 0.2, tank, 10), 'wood', { y: legs + tank / 2 }),
    part(cylinder(0.21, 0.21, 0.03, 10), 'iron', { y: legs + tank * 0.8 }),
    part(new THREE.ConeGeometry(0.24, 0.14, 10), 'tileRoof', { y: legs + tank + 0.07 }),
    part(cylinder(0.03, 0.03, 0.18, 6), 'iron', { x: 0.2, y: legs - 0.06, z: 0.1 }),
  ];
}

function waterworks(level: number): THREE.BufferGeometry[] {
  const tank = 0.2 + 0.03 * (level - 1);
  return [
    part(box(0.9, 0.05, 0.82), 'concrete', { y: 0.025 }),
    part(cylinder(0.22, 0.22, tank, 12), 'concrete', { x: -0.2, y: 0.05 + tank / 2, z: -0.1 }),
    part(cylinder(0.19, 0.19, 0.02, 12), 'water', { x: -0.2, y: 0.05 + tank, z: -0.1 }),
    part(cylinder(0.16, 0.16, tank * 0.8, 12), 'concrete', { x: 0.24, y: 0.05 + tank * 0.4, z: 0.2 }),
    part(cylinder(0.13, 0.13, 0.02, 12), 'water', { x: 0.24, y: 0.05 + tank * 0.8, z: 0.2 }),
    part(cylinder(0.04, 0.04, 0.5, 8).rotateZ(Math.PI / 2), 'iron', { x: 0.02, y: 0.12, z: 0.06 }),
    part(box(0.2, 0.18, 0.16), 'plaster', { x: 0.26, y: 0.14, z: -0.26 }),
  ];
}

// --- Inns --------------------------------------------------------------------------------

function signPost(x: number, z: number, height: number, cloth: ColorKey): THREE.BufferGeometry[] {
  return [
    part(cylinder(0.02, 0.022, height, 6), 'woodDark', { x, y: height / 2, z }),
    part(box(0.14, 0.1, 0.02), cloth, { x: x + 0.07, y: height - 0.08, z }),
  ];
}

function tavern(level: number): THREE.BufferGeometry[] {
  const wall = 0.3 + 0.05 * (level - 1);
  return [
    part(box(0.6, wall, 0.5), 'mud', { x: -0.1, y: wall / 2 }),
    part(pyramid(0.5, 0.26).scale(1.2, 1, 1), 'thatch', { x: -0.08, y: wall + 0.13 }),
    part(box(0.5, 0.03, 0.22), 'cloth', { x: -0.02, y: wall * 0.85, z: 0.3, rotX: 0.3 }),
    part(box(0.28, 0.05, 0.14), 'wood', { x: 0.06, y: 0.12, z: 0.3 }),
    part(box(0.28, 0.04, 0.06), 'woodDark', { x: 0.06, y: 0.06, z: 0.38 }),
    ...signPost(0.3, -0.22, wall + 0.2, 'clothRed'),
  ];
}

function inn(level: number): THREE.BufferGeometry[] {
  const floor = 0.28 + 0.04 * (level - 1);
  return [
    part(box(0.64, floor, 0.54), 'plaster', { y: floor / 2 }),
    part(box(0.68, floor * 0.9, 0.58), 'plaster', { y: floor + (floor * 0.9) / 2 }),
    part(box(0.7, 0.04, 0.6), 'woodDark', { y: floor }),
    part(pyramid(0.56, 0.3).scale(1.2, 1, 1), 'tileRoof', { y: floor * 1.9 + 0.15 }),
    part(box(0.12, 0.2, 0.02), 'woodDark', { y: 0.1, z: 0.275 }),
    part(box(0.1, 0.1, 0.01), 'window', { x: -0.2, y: floor + 0.14, z: 0.292 }),
    part(box(0.1, 0.1, 0.01), 'window', { x: 0.2, y: floor + 0.14, z: 0.292 }),
    ...signPost(0.34, 0.28, floor + 0.24, 'flag'),
  ];
}

function hotel(level: number): THREE.BufferGeometry[] {
  const height = 0.6 + 0.12 * (level - 1);
  const parts = [
    part(box(0.66, height, 0.56), 'brick', { y: height / 2 }),
    part(box(0.7, 0.05, 0.6), 'slate', { y: height + 0.025 }),
    part(box(0.48, 0.03, 0.16), 'clothRed', { y: 0.3, z: 0.33 }),
    part(box(0.14, 0.24, 0.02), 'glass', { y: 0.12, z: 0.285 }),
    part(box(0.3, 0.06, 0.01), 'gold', { y: 0.4, z: 0.288 }),
  ];
  for (let y = 0.5; y < height - 0.08; y += 0.18) {
    for (const x of [-0.18, 0.02, 0.22]) {
      parts.push(part(box(0.1, 0.1, 0.01), 'window', { x, y, z: 0.285 }));
    }
  }
  return parts;
}

// --- Monuments ---------------------------------------------------------------------------

function memorialStone(): THREE.BufferGeometry[] {
  // A plain engraved slab on a stepped base, with a flower bed around it.
  return [
    part(box(0.72, 0.06, 0.72), 'parkGrass', { y: 0.03 }),
    part(box(0.46, 0.07, 0.46), 'stone', { y: 0.095 }),
    part(box(0.34, 0.06, 0.34), 'stone', { y: 0.16 }),
    part(box(0.26, 0.44, 0.1), 'plaster', { y: 0.41 }),
    part(box(0.18, 0.02, 0.01), 'woodDark', { y: 0.5, z: 0.052 }),
    part(box(0.18, 0.02, 0.01), 'woodDark', { y: 0.44, z: 0.052 }),
    part(box(0.18, 0.02, 0.01), 'woodDark', { y: 0.38, z: 0.052 }),
    part(box(0.06, 0.05, 0.06), 'flower', { x: -0.28, y: 0.08, z: 0.28 }),
    part(box(0.06, 0.05, 0.06), 'clothRed', { x: 0.28, y: 0.08, z: -0.26 }),
  ];
}

function clockTower(): THREE.BufferGeometry[] {
  const shaft = 0.66;
  return [
    part(box(0.42, 0.08, 0.42), 'stone', { y: 0.04 }),
    part(box(0.3, shaft, 0.3), 'stone', { y: 0.08 + shaft / 2 }),
    part(box(0.36, 0.06, 0.36), 'slate', { y: 0.08 + shaft + 0.03 }),
    part(cylinder(0.11, 0.11, 0.03, 14), 'plaster', { y: 0.08 + shaft * 0.78, z: 0.155, rotX: Math.PI / 2 }),
    part(box(0.015, 0.07, 0.01), 'woodDark', { y: 0.08 + shaft * 0.78 + 0.03, z: 0.172 }),
    part(box(0.05, 0.015, 0.01), 'woodDark', { x: 0.02, y: 0.08 + shaft * 0.78, z: 0.172 }),
    part(pyramid(0.26, 0.24), 'tileRoof', { y: 0.08 + shaft + 0.16 }),
    part(box(0.1, 0.18, 0.02), 'woodDark', { y: 0.17, z: 0.152 }),
  ];
}

function observationDeck(): THREE.BufferGeometry[] {
  const column = 0.72;
  return [
    part(cylinder(0.14, 0.2, 0.08, 12), 'concrete', { y: 0.04 }),
    part(cylinder(0.09, 0.11, column, 12), 'concrete', { y: 0.08 + column / 2 }),
    part(cylinder(0.26, 0.22, 0.1, 14), 'concrete', { y: 0.08 + column + 0.05 }),
    part(cylinder(0.24, 0.24, 0.08, 14), 'glass', { y: 0.08 + column + 0.14 }),
    part(cylinder(0.26, 0.26, 0.02, 14), 'iron', { y: 0.08 + column + 0.19 }),
    part(cylinder(0.02, 0.02, 0.14, 6), 'iron', { y: 0.08 + column + 0.27 }),
  ];
}

// --- Moving parts and effects ------------------------------------------------------------

/** A moving part drawn separately from its building (windmill sails, a waterwheel). */
export interface Rotor {
  /** Cache key shared by every rotor with this geometry. */
  key: string;
  geometry: THREE.BufferGeometry;
  /** Pivot position relative to the building's origin. */
  pivot: THREE.Vector3;
  /** Local axis the part spins around. */
  axis: 'x' | 'z';
  /** Radians per second. */
  speed: number;
}

let sailsGeometry: THREE.BufferGeometry | null = null;
let wheelGeometry: THREE.BufferGeometry | null = null;

/** Four sails around a hub at the origin, in the x-y plane (facing +z). */
function getSailsGeometry(): THREE.BufferGeometry {
  if (!sailsGeometry) {
    const blades: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      blades.push(part(box(0.035, 0.42, 0.012), 'trunk', { y: 0.23 }).rotateZ((i * Math.PI) / 2));
      blades.push(part(box(0.1, 0.3, 0.008), 'sail', { x: 0.06, y: 0.26 }).rotateZ((i * Math.PI) / 2));
    }
    sailsGeometry = merge(blades);
  }
  return sailsGeometry;
}

/** A paddle wheel around the x axis. */
function getWheelGeometry(): THREE.BufferGeometry {
  if (!wheelGeometry) {
    const pieces: THREE.BufferGeometry[] = [part(cylinder(0.03, 0.03, 0.16, 6).rotateZ(Math.PI / 2), 'woodDark')];
    for (let i = 0; i < 8; i++) {
      pieces.push(part(box(0.1, 0.12, 0.025), 'wood', { y: 0.16 }).rotateX((i * Math.PI) / 4));
      pieces.push(part(box(0.02, 0.16, 0.02), 'woodDark', { y: 0.08 }).rotateX((i * Math.PI) / 4));
    }
    wheelGeometry = merge(pieces);
  }
  return wheelGeometry;
}

/** The animated part of a building, if it has one in this era. */
export function getRotor(type: BuildingType, level: number, era: EraId): Rotor | null {
  if (type !== 'powerPlant') return null;
  if (era === 'ancient') {
    return {
      key: 'sails',
      geometry: getSailsGeometry(),
      pivot: new THREE.Vector3(0, windmillTowerHeight(level) - 0.04, 0.31),
      axis: 'z',
      speed: 1.6,
    };
  }
  if (era === 'medieval') {
    return { key: 'wheel', geometry: getWheelGeometry(), pivot: new THREE.Vector3(0.33, 0.2, 0), axis: 'x', speed: -1.2 };
  }
  return null;
}

/** Chimney tops that emit smoke, relative to the building's origin. */
export function getSmokeEmitters(type: BuildingType, level: number, era: EraId): THREE.Vector3[] {
  if (type === 'factory') return [new THREE.Vector3(0.3, 0.35 + factoryStack(level), -0.2)];
  if (type === 'powerPlant' && era === 'industrial') {
    const top = 0.4 + 0.7 + 0.08 * (level - 1);
    return [new THREE.Vector3(-0.2, top, -0.15), new THREE.Vector3(0.05, top, -0.15)];
  }
  return [];
}

export type DecorKind = 'pine' | 'broadleaf' | 'rock' | 'stump';

const decorCache = new Map<DecorKind, THREE.BufferGeometry>();

/** Scenery for land outside the territory. */
export function getDecorGeometry(kind: DecorKind): THREE.BufferGeometry {
  let geometry = decorCache.get(kind);
  if (!geometry) {
    switch (kind) {
      case 'pine':
        geometry = merge(pineParts(0, 0, 1.1));
        break;
      case 'broadleaf':
        geometry = merge(broadleafParts(0, 0, 1.1));
        break;
      case 'rock':
        geometry = merge([part(new THREE.IcosahedronGeometry(0.13, 0).scale(1, 0.6, 1), 'stone', { y: 0.05 })]);
        break;
      case 'stump':
        geometry = merge([part(cylinder(0.06, 0.07, 0.08, 7), 'woodDark', { y: 0.04 })]);
        break;
    }
    decorCache.set(kind, geometry);
  }
  return geometry;
}

export interface CitizenGeometries {
  /** Legs and head, with fixed colours. */
  body: THREE.BufferGeometry;
  /** Torso in white, tinted per citizen through instance colours. */
  shirt: THREE.BufferGeometry;
}

let citizenGeometries: CitizenGeometries | null = null;

/** Tiny blocky citizen, about a quarter tile tall, split so shirts can vary per instance. */
export function getCitizenGeometries(): CitizenGeometries {
  citizenGeometries ??= {
    body: merge([
      part(box(0.07, 0.08, 0.05), 'pants', { y: 0.04 }),
      part(box(0.07, 0.07, 0.07), 'skin', { y: 0.215 }),
    ]),
    shirt: part(box(0.09, 0.1, 0.06), 'white', { y: 0.13 }),
  };
  return citizenGeometries;
}
