import * as THREE from 'three';
import { PALETTE, box, cone, cylinder, dome as domeShape, part, prism, pyramid, type ColorKey } from './modelParts';

/**
 * Data-driven building models. A building describes itself — walls, roof, a few props — and
 * this turns that into geometry, so the game can offer many kinds of building without a
 * hand-written model for each one.
 */

export type WallShape = 'box' | 'cylinder' | 'tower' | 'slab' | 'openShed';

export type RoofShape = 'none' | 'flat' | 'pyramid' | 'gable' | 'cone' | 'dome' | 'sawtooth' | 'arch';

export type PropKind =
  | 'door'
  | 'windows'
  | 'windowBand'
  | 'glassFront'
  | 'balconies'
  | 'chimney'
  | 'stack'
  | 'vents'
  | 'antenna'
  | 'dish'
  | 'solar'
  | 'tank'
  | 'silo'
  | 'pipes'
  | 'awning'
  | 'sign'
  | 'flagpole'
  | 'clock'
  | 'lamps'
  | 'columns'
  | 'stairs'
  | 'crops'
  | 'pond'
  | 'trees'
  | 'fence'
  | 'benches'
  | 'crates'
  | 'rails'
  | 'shelter';

export interface ModelSpec {
  /** Footprint, as a share of the tile (0..1). */
  width?: number;
  depth?: number;
  /** Wall height at level 1, and how much each level adds. */
  height: number;
  heightPerLevel?: number;
  shape?: WallShape;
  wall: ColorKey;
  /** Second wall colour: a plinth band at the bottom. */
  plinth?: ColorKey;
  roof?: RoofShape;
  roofColor?: ColorKey;
  /** A ground slab under the building (paving, soil, lawn). */
  platform?: ColorKey;
  props?: readonly PropKind[];
}

const DEFAULTS = { width: 0.68, depth: 0.56, shape: 'box' as WallShape, roof: 'gable' as RoofShape };

/** Builds every part of one building from its spec. */
export function buildFromSpec(spec: ModelSpec, level: number): THREE.BufferGeometry[] {
  const width = spec.width ?? DEFAULTS.width;
  const depth = spec.depth ?? DEFAULTS.depth;
  const height = spec.height + (spec.heightPerLevel ?? 0) * (level - 1);
  const shape = spec.shape ?? DEFAULTS.shape;
  const roof = spec.roof ?? DEFAULTS.roof;
  const roofColor = spec.roofColor ?? 'slate';
  const parts: THREE.BufferGeometry[] = [];
  const ground = spec.platform ? 0.05 : 0;

  if (spec.platform) {
    parts.push(part(box(Math.min(0.96, width + 0.22), 0.05, Math.min(0.96, depth + 0.22)), spec.platform, { y: 0.025 }));
  }

  parts.push(...walls(shape, width, depth, height, ground, spec));
  parts.push(...roofParts(roof, width, depth, height + ground, roofColor, shape));

  const context: PropContext = { width, depth, height, ground, roof, wall: spec.wall, level };
  for (const prop of spec.props ?? []) parts.push(...propParts(prop, context));
  return parts;
}

function walls(
  shape: WallShape,
  width: number,
  depth: number,
  height: number,
  ground: number,
  spec: ModelSpec,
): THREE.BufferGeometry[] {
  const y = ground + height / 2;
  switch (shape) {
    case 'cylinder':
      return [part(cylinder(width / 2, width / 2 + 0.02, height, 12), spec.wall, { y })];
    case 'tower':
      return [
        part(box(width * 0.62, height, depth * 0.62), spec.wall, { y }),
        part(box(width * 0.72, 0.05, depth * 0.72), spec.plinth ?? spec.wall, { y: ground + 0.025 }),
      ];
    case 'slab':
      return [part(box(width, height, depth), spec.wall, { y })];
    case 'openShed': {
      // Four corner posts instead of walls.
      const posts: THREE.BufferGeometry[] = [];
      for (const x of [-width / 2 + 0.04, width / 2 - 0.04]) {
        for (const z of [-depth / 2 + 0.04, depth / 2 - 0.04]) {
          posts.push(part(cylinder(0.03, 0.035, height, 6), spec.plinth ?? 'woodDark', { x, y, z }));
        }
      }
      return posts;
    }
    default: {
      const body = [part(box(width, height, depth), spec.wall, { y })];
      if (spec.plinth) {
        body.push(part(box(width + 0.02, Math.min(0.1, height * 0.3), depth + 0.02), spec.plinth, { y: ground + 0.04 }));
      }
      return body;
    }
  }
}

function roofParts(
  roof: RoofShape,
  width: number,
  depth: number,
  top: number,
  colour: ColorKey,
  shape: WallShape,
): THREE.BufferGeometry[] {
  const radius = Math.max(width, depth) * 0.72;
  switch (roof) {
    case 'none':
      return [];
    case 'flat':
      return [part(box(width + 0.04, 0.05, depth + 0.04), colour, { y: top + 0.025 })];
    case 'pyramid':
      return [part(pyramid(radius, 0.26).scale(width / radius / 1.4 + 0.6, 1, depth / radius / 1.4 + 0.6), colour, { y: top + 0.13 })];
    case 'gable':
      return [part(prism(width + 0.04, 0.22, depth + 0.04), colour, { y: top + 0.11 })];
    case 'cone':
      return [part(cone(radius * 0.8, 0.3, 10), colour, { y: top + 0.15 })];
    case 'dome':
      return [part(domeShape(Math.min(width, depth) * 0.52), colour, { y: top })];
    case 'sawtooth':
      return [
        part(prism(width * 0.46, 0.16, depth + 0.04), colour, { x: -width * 0.26, y: top + 0.08 }),
        part(prism(width * 0.46, 0.16, depth + 0.04), colour, { x: width * 0.26, y: top + 0.08 }),
      ];
    case 'arch':
      return [
        part(cylinder(Math.min(width, depth) * 0.5, Math.min(width, depth) * 0.5, width, 12).rotateZ(Math.PI / 2), colour, {
          y: top,
        }),
      ];
    default:
      return shape === 'cylinder' ? [part(cone(width * 0.6, 0.22, 12), colour, { y: top + 0.11 })] : [];
  }
}

interface PropContext {
  width: number;
  depth: number;
  height: number;
  ground: number;
  roof: RoofShape;
  wall: ColorKey;
  level: number;
}

function propParts(prop: PropKind, c: PropContext): THREE.BufferGeometry[] {
  const front = c.depth / 2 + 0.005;
  const top = c.ground + c.height;
  switch (prop) {
    case 'door':
      return [part(box(0.12, Math.min(0.22, c.height * 0.6), 0.02), 'woodDark', { y: c.ground + 0.1, z: front })];
    case 'windows': {
      const parts: THREE.BufferGeometry[] = [];
      for (let y = c.ground + 0.18; y < top - 0.08; y += 0.2) {
        for (const x of [-c.width * 0.26, 0, c.width * 0.26]) {
          parts.push(part(box(0.1, 0.1, 0.015), 'window', { x, y, z: front }));
        }
      }
      return parts;
    }
    case 'windowBand':
      return [part(box(c.width * 0.86, Math.min(0.14, c.height * 0.35), 0.02), 'glass', { y: c.ground + c.height * 0.62, z: front })];
    case 'glassFront':
      return [part(box(c.width * 0.9, c.height * 0.8, 0.02), 'glass', { y: c.ground + c.height * 0.5, z: front })];
    case 'balconies': {
      const parts: THREE.BufferGeometry[] = [];
      for (let y = c.ground + 0.3; y < top - 0.1; y += 0.22) {
        parts.push(part(box(c.width * 0.8, 0.03, 0.08), 'concrete', { y, z: front + 0.03 }));
        parts.push(part(box(c.width * 0.8, 0.06, 0.015), 'iron', { y: y + 0.04, z: front + 0.06 }));
      }
      return parts;
    }
    case 'chimney':
      return [part(box(0.09, 0.2, 0.09), 'brickDark', { x: c.width * 0.3, y: top + 0.14, z: -c.depth * 0.28 })];
    case 'stack':
      return [
        part(cylinder(0.06, 0.08, 0.5 + 0.06 * c.level, 10), 'concrete', {
          x: -c.width * 0.28,
          y: top + (0.5 + 0.06 * c.level) / 2,
          z: -c.depth * 0.26,
        }),
      ];
    case 'vents':
      return [
        part(box(0.14, 0.08, 0.14), 'iron', { x: -c.width * 0.2, y: top + 0.08, z: -c.depth * 0.15 }),
        part(box(0.1, 0.06, 0.1), 'iron', { x: c.width * 0.22, y: top + 0.07, z: c.depth * 0.1 }),
      ];
    case 'antenna':
      return [
        part(cylinder(0.008, 0.012, 0.34, 5), 'iron', { y: top + 0.17 }),
        part(box(0.05, 0.02, 0.02), 'iron', { y: top + 0.3 }),
      ];
    case 'dish':
      return [
        part(cylinder(0.012, 0.012, 0.12, 5), 'iron', { x: c.width * 0.26, y: top + 0.06, z: -c.depth * 0.2 }),
        part(domeShape(0.07).rotateX(-Math.PI / 3), 'plaster', { x: c.width * 0.26, y: top + 0.14, z: -c.depth * 0.2 }),
      ];
    case 'solar':
      return [
        part(box(c.width * 0.42, 0.02, c.depth * 0.5), 'slate', { x: -c.width * 0.22, y: top + 0.06, rotX: -0.3 }),
        part(box(c.width * 0.42, 0.02, c.depth * 0.5), 'glass', { x: c.width * 0.22, y: top + 0.06, rotX: -0.3 }),
      ];
    case 'tank':
      return [
        part(cylinder(0.12, 0.12, 0.16, 10), 'plaster', { x: c.width * 0.18, y: top + 0.08, z: -c.depth * 0.2 }),
        part(cylinder(0.125, 0.125, 0.02, 10), 'iron', { x: c.width * 0.18, y: top + 0.16, z: -c.depth * 0.2 }),
      ];
    case 'silo':
      return [
        part(cylinder(0.1, 0.11, c.height + 0.2, 10), 'concrete', { x: -c.width / 2 - 0.1, y: c.ground + (c.height + 0.2) / 2 }),
        part(cone(0.12, 0.1, 10), 'slate', { x: -c.width / 2 - 0.1, y: c.ground + c.height + 0.25 }),
      ];
    case 'pipes':
      return [
        part(cylinder(0.035, 0.035, c.depth * 0.9, 8), 'iron', { x: c.width / 2 + 0.05, y: c.ground + 0.1, rotX: Math.PI / 2 }),
        part(cylinder(0.03, 0.03, 0.18, 8), 'iron', { x: c.width / 2 + 0.05, y: c.ground + 0.2 }),
      ];
    case 'awning':
      return [part(box(c.width * 0.94, 0.03, 0.16), 'clothRed', { y: c.ground + c.height * 0.72, z: front + 0.07 })];
    case 'sign':
      return [
        part(cylinder(0.018, 0.02, c.height * 0.6, 6), 'woodDark', { x: c.width / 2 + 0.06, y: c.ground + c.height * 0.3, z: c.depth * 0.2 }),
        part(box(0.13, 0.09, 0.015), 'cloth', { x: c.width / 2 + 0.06, y: c.ground + c.height * 0.54, z: c.depth * 0.2 }),
      ];
    case 'flagpole':
      return [
        part(cylinder(0.01, 0.012, 0.3, 5), 'plaster', { y: top + 0.15 }),
        part(box(0.12, 0.07, 0.012), 'flag', { x: 0.06, y: top + 0.25 }),
      ];
    case 'clock':
      return [
        part(cylinder(0.1, 0.1, 0.03, 14), 'plaster', { y: c.ground + c.height * 0.78, z: front + 0.01, rotX: Math.PI / 2 }),
        part(box(0.014, 0.06, 0.01), 'woodDark', { y: c.ground + c.height * 0.78 + 0.025, z: front + 0.025 }),
      ];
    case 'lamps':
      return [-1, 1].flatMap((side) => [
        part(cylinder(0.012, 0.012, 0.22, 5), 'iron', { x: (side * c.width) / 2 + side * 0.08, y: c.ground + 0.11, z: front }),
        part(box(0.05, 0.05, 0.05), 'gold', { x: (side * c.width) / 2 + side * 0.08, y: c.ground + 0.24, z: front }),
      ]);
    case 'columns': {
      const columns: THREE.BufferGeometry[] = [];
      const count = 4;
      for (let i = 0; i < count; i++) {
        const x = -c.width * 0.36 + (c.width * 0.72 * i) / (count - 1);
        columns.push(part(cylinder(0.03, 0.032, c.height * 0.86, 8), 'plaster', { x, y: c.ground + c.height * 0.43, z: front + 0.06 }));
      }
      columns.push(part(box(c.width * 0.86, 0.05, 0.14), 'plaster', { y: c.ground + c.height * 0.88, z: front + 0.06 }));
      return columns;
    }
    case 'stairs':
      return [
        part(box(c.width * 0.5, 0.04, 0.1), 'stone', { y: c.ground + 0.02, z: front + 0.08 }),
        part(box(c.width * 0.42, 0.04, 0.07), 'stone', { y: c.ground + 0.06, z: front + 0.05 }),
      ];
    case 'crops': {
      const rows: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 4; i++) {
        rows.push(part(box(0.8, 0.06, 0.08), i % 2 ? 'crop' : 'cropRipe', { y: 0.08, z: -0.3 + i * 0.2 }));
      }
      return rows;
    }
    case 'pond':
      return [
        part(cylinder(0.16, 0.17, 0.05, 12), 'stone', { x: -c.width * 0.1, y: 0.05, z: c.depth * 0.55 }),
        part(cylinder(0.13, 0.13, 0.02, 12), 'water', { x: -c.width * 0.1, y: 0.08, z: c.depth * 0.55 }),
      ];
    case 'trees':
      return [
        [-0.34, -0.3],
        [0.34, 0.3],
      ].flatMap(([x, z]) => [
        part(cylinder(0.03, 0.035, 0.16, 6), 'trunk', { x, y: 0.13, z }),
        part(new THREE.IcosahedronGeometry(0.13, 0), 'leaves', { x, y: 0.3, z }),
      ]);
    case 'fence':
      return [-0.44, 0.44].flatMap((x) => [
        part(cylinder(0.016, 0.018, 0.16, 5), 'woodDark', { x, y: 0.08, z: -0.44 }),
        part(cylinder(0.016, 0.018, 0.16, 5), 'woodDark', { x, y: 0.08, z: 0.44 }),
      ]);
    case 'benches':
      return [
        part(box(0.2, 0.03, 0.07), 'wood', { y: 0.11, z: c.depth * 0.6 }),
        part(box(0.2, 0.05, 0.02), 'wood', { y: 0.15, z: c.depth * 0.6 - 0.03 }),
      ];
    case 'crates':
      return [
        part(box(0.12, 0.12, 0.12), 'wood', { x: c.width / 2 + 0.12, y: 0.06, z: c.depth * 0.2 }),
        part(box(0.1, 0.1, 0.1), 'woodDark', { x: c.width / 2 + 0.1, y: 0.17, z: c.depth * 0.24 }),
      ];
    case 'rails':
      return [
        part(box(0.9, 0.02, 0.035), 'iron', { y: 0.07, z: -0.08 }),
        part(box(0.9, 0.02, 0.035), 'iron', { y: 0.07, z: 0.08 }),
        ...[-0.3, -0.1, 0.1, 0.3].map((x) => part(box(0.06, 0.02, 0.3), 'woodDark', { x, y: 0.055 })),
      ];
    case 'shelter':
      return [
        part(box(0.3, 0.03, 0.2), 'glass', { x: c.width / 2 + 0.2, y: 0.3, z: 0 }),
        part(cylinder(0.018, 0.018, 0.3, 6), 'iron', { x: c.width / 2 + 0.08, y: 0.15 }),
        part(cylinder(0.018, 0.018, 0.3, 6), 'iron', { x: c.width / 2 + 0.32, y: 0.15 }),
      ];
  }
}

export { PALETTE };
