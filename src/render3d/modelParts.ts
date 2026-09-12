import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Shared building blocks for the 3D models: the palette, vertex-coloured primitives and the
 * merge step that turns a pile of parts into one geometry.
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
  asphalt: 0x4d4f56,
  roadLine: 0xe6e2d4,
  sidewalk: 0xb9b5ac,
} as const;

export type ColorKey = keyof typeof PALETTE;

export interface Placement {
  x?: number;
  y?: number;
  z?: number;
  rotX?: number;
  scale?: number;
}

const paint = new THREE.Color();

/** Transforms a primitive and colours every vertex, ready to be merged with other parts. */
export function part(geometry: THREE.BufferGeometry, color: ColorKey, at: Placement = {}): THREE.BufferGeometry {
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

export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
export const cylinder = (top: number, bottom: number, height: number, segments = 8) =>
  new THREE.CylinderGeometry(top, bottom, height, segments);
/** Four-sided pyramid roof whose base lines up with boxes. */
export const pyramid = (radius: number, height: number) =>
  new THREE.ConeGeometry(radius, height, 4).rotateY(Math.PI / 4);
export const dome = (radius: number) => new THREE.SphereGeometry(radius, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);

export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // Boxes and cylinders are indexed but polyhedra are not; mergeGeometries needs one kind.
  const uniform = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  const merged = mergeGeometries(uniform);
  for (const p of [...parts, ...uniform]) p.dispose();
  if (!merged) throw new Error('Failed to merge model parts');
  return merged;
}

/** Cone with the base on the ground plane of the part. */
export const cone = (radius: number, height: number, segments = 8) =>
  new THREE.ConeGeometry(radius, height, segments);

/**
 * Triangular prism extruded along Z with a flat bottom and the ridge on top: gable roofs and
 * sawtooth roofs are made of these.
 */
export function prism(width: number, height: number, depth: number): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(0.5, 0.5, depth, 3).rotateX(Math.PI / 2).rotateZ(Math.PI / 2);
  geometry.computeBoundingBox();
  const size = geometry.boundingBox!.getSize(new THREE.Vector3());
  geometry.scale(width / size.x, height / size.y, 1);
  // Centre it vertically so `part` can place it by its middle.
  geometry.computeBoundingBox();
  geometry.translate(0, -(geometry.boundingBox!.min.y + height / 2), 0);
  return geometry;
}
