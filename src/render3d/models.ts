import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { BuildingType } from '../building/types';

/**
 * Procedural low-poly models (1 world unit = 1 tile, origin on the tile surface).
 * Each model is merged into a single vertex-coloured geometry so it can be drawn with
 * one InstancedMesh per model.
 */

export const PALETTE = {
  grass: 0x7cb85a,
  grassAlt: 0x74b052,
  locked: 0x3e4a3a,
  lockedAlt: 0x39443a,
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
/** Four-sided pyramid roof whose base lines up with boxes. */
const pyramid = (radius: number, height: number) =>
  new THREE.ConeGeometry(radius, height, 4).rotateY(Math.PI / 4);

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  if (!merged) throw new Error('Failed to merge model parts');
  return merged;
}

const buildingCache = new Map<string, THREE.BufferGeometry>();

/** Shared geometry for a building type at a level; higher levels are taller or denser. */
export function getBuildingGeometry(type: BuildingType, level: number): THREE.BufferGeometry {
  const key = `${type}:${level}`;
  let geometry = buildingCache.get(key);
  if (!geometry) {
    geometry = merge(buildingParts(type, level));
    buildingCache.set(key, geometry);
  }
  return geometry;
}

function buildingParts(type: BuildingType, level: number): THREE.BufferGeometry[] {
  switch (type) {
    case 'house': {
      const wall = 0.34 + 0.16 * (level - 1);
      return [
        part(box(0.56, wall, 0.48), 'houseWall', { y: wall / 2 }),
        part(pyramid(0.46, 0.3), 'houseRoof', { y: wall + 0.15 }),
        part(box(0.08, 0.18, 0.08), 'hallRoof', { x: 0.14, y: wall + 0.2, z: -0.08 }),
        part(box(0.12, 0.18, 0.02), 'door', { y: 0.09, z: 0.245 }),
        part(box(0.1, 0.1, 0.02), 'window', { x: -0.17, y: wall - 0.12, z: 0.245 }),
      ];
    }
    case 'shop': {
      const height = 0.32 + 0.1 * (level - 1);
      return [
        part(box(0.68, height, 0.56), 'shopWall', { y: height / 2 }),
        part(box(0.74, 0.05, 0.62), 'hallRoof', { y: height + 0.025 }),
        part(box(0.72, 0.04, 0.2), 'shopAwning', { y: height * 0.78, z: 0.34, rotX: 0.35 }),
        part(box(0.3, 0.1, 0.02), 'flag', { y: height - 0.06, z: 0.29 }),
        part(box(0.12, 0.1, 0.12), 'trunk', { x: 0.3, y: 0.05, z: 0.36 }),
      ];
    }
    case 'townHall':
      return [
        part(box(0.84, 0.46, 0.84), 'hallWall', { y: 0.23 }),
        part(pyramid(0.68, 0.36), 'hallRoof', { y: 0.64 }),
        part(box(0.2, 0.44, 0.2), 'hallWall', { x: 0.26, y: 0.68, z: 0.26 }),
        part(pyramid(0.17, 0.2), 'houseRoof', { x: 0.26, y: 1.0, z: 0.26 }),
        part(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 4), 'door', { x: 0.26, y: 1.25, z: 0.26 }),
        part(box(0.14, 0.08, 0.01), 'flag', { x: 0.33, y: 1.34, z: 0.26 }),
        part(box(0.16, 0.22, 0.02), 'door', { y: 0.11, z: 0.425 }),
      ];
    case 'park': {
      const trees: [number, number, number][] = [
        [-0.22, -0.2, 1],
        [0.24, 0.18, 0.85],
        [0.2, -0.24, 0.7],
        [-0.24, 0.24, 0.75],
      ];
      return [
        part(box(0.94, 0.04, 0.94), 'parkGrass', { y: 0.02 }),
        ...trees.slice(0, 1 + level).flatMap(([x, z, scale]) => treeParts(x, z, scale)),
        part(box(0.22, 0.05, 0.08), 'trunk', { y: 0.07, z: 0.05 }),
        part(box(0.05, 0.05, 0.05), 'flower', { x: 0.08, y: 0.065, z: -0.32 }),
        part(box(0.05, 0.05, 0.05), 'flower', { x: -0.34, y: 0.065, z: -0.02 }),
        part(box(0.05, 0.05, 0.05), 'flower', { x: 0.34, y: 0.065, z: -0.02 }),
      ];
    }
  }
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

function treeParts(x: number, z: number, scale: number): THREE.BufferGeometry[] {
  return [
    part(new THREE.CylinderGeometry(0.035, 0.045, 0.16, 6), 'trunk', { x, y: 0.12 * scale, z, scale }),
    part(new THREE.ConeGeometry(0.17, 0.32, 7), 'leaves', { x, y: 0.34 * scale, z, scale }),
    part(new THREE.ConeGeometry(0.12, 0.22, 7), 'leavesAlt', { x, y: 0.5 * scale, z, scale }),
  ];
}
