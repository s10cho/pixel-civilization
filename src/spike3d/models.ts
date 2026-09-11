import * as THREE from 'three';
import type { BuildingType } from '../building/types';

/** Procedural low-poly placeholder models for the 3D spike (1 world unit = 1 tile). */

export const PALETTE = {
  white: 0xffffff,
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
  skin: 0xf2c9a0,
  shirt: 0x3a6fb0,
  shirtAlt: 0xd9743a,
  pants: 0x3b3340,
  flag: 0xe63946,
} as const;

export type ColorKey = keyof typeof PALETTE;

/** One shared material per palette colour, in the style's shading model. */
export class Materials {
  private readonly cache = new Map<ColorKey, THREE.Material>();
  private readonly gradientMap: THREE.DataTexture | null;

  constructor(private readonly toon: boolean) {
    this.gradientMap = toon ? createToonGradient() : null;
  }

  get(key: ColorKey): THREE.Material {
    let material = this.cache.get(key);
    if (!material) {
      const color = PALETTE[key];
      material = this.toon
        ? new THREE.MeshToonMaterial({ color, gradientMap: this.gradientMap })
        : new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, metalness: 0 });
      this.cache.set(key, material);
    }
    return material;
  }

  dispose(): void {
    for (const material of this.cache.values()) material.dispose();
    this.gradientMap?.dispose();
  }
}

/** Three hard light bands for the toon style. */
function createToonGradient(): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

function part(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
/** Four-sided pyramid roof, rotated so its base lines up with boxes. */
const pyramid = (radius: number, height: number) => new THREE.ConeGeometry(radius, height, 4).rotateY(Math.PI / 4);

/** Building model with its origin on the tile surface. Higher levels grow taller or denser. */
export function createBuildingMesh(type: BuildingType, level: number, m: Materials): THREE.Group {
  const group = new THREE.Group();
  switch (type) {
    case 'house': {
      const wall = 0.34 + 0.16 * (level - 1);
      group.add(part(box(0.56, wall, 0.48), m.get('houseWall'), 0, wall / 2, 0));
      group.add(part(pyramid(0.46, 0.3), m.get('houseRoof'), 0, wall + 0.15, 0));
      group.add(part(box(0.08, 0.18, 0.08), m.get('hallRoof'), 0.14, wall + 0.2, -0.08));
      group.add(part(box(0.12, 0.18, 0.02), m.get('door'), 0, 0.09, 0.245));
      group.add(part(box(0.1, 0.1, 0.02), m.get('window'), -0.17, wall - 0.12, 0.245));
      break;
    }
    case 'shop': {
      const height = 0.32 + 0.1 * (level - 1);
      group.add(part(box(0.68, height, 0.56), m.get('shopWall'), 0, height / 2, 0));
      group.add(part(box(0.74, 0.05, 0.62), m.get('hallRoof'), 0, height + 0.025, 0));
      const awning = part(box(0.72, 0.04, 0.2), m.get('shopAwning'), 0, height * 0.78, 0.34);
      awning.rotation.x = 0.35;
      group.add(awning);
      group.add(part(box(0.3, 0.1, 0.02), m.get('flag'), 0, height - 0.06, 0.29));
      group.add(part(box(0.12, 0.1, 0.12), m.get('trunk'), 0.3, 0.05, 0.36));
      break;
    }
    case 'townHall': {
      group.add(part(box(0.84, 0.46, 0.84), m.get('hallWall'), 0, 0.23, 0));
      group.add(part(pyramid(0.68, 0.36), m.get('hallRoof'), 0, 0.64, 0));
      group.add(part(box(0.2, 0.44, 0.2), m.get('hallWall'), 0.26, 0.68, 0.26));
      group.add(part(pyramid(0.17, 0.2), m.get('houseRoof'), 0.26, 1.0, 0.26));
      group.add(part(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 4), m.get('door'), 0.26, 1.25, 0.26));
      group.add(part(box(0.14, 0.08, 0.01), m.get('flag'), 0.33, 1.34, 0.26));
      group.add(part(box(0.16, 0.22, 0.02), m.get('door'), 0, 0.11, 0.425));
      break;
    }
    case 'park': {
      group.add(part(box(0.94, 0.04, 0.94), m.get('parkGrass'), 0, 0.02, 0));
      const spots: [number, number, number][] = [
        [-0.22, -0.2, 1],
        [0.24, 0.18, 0.85],
        [0.2, -0.24, 0.7],
        [-0.24, 0.24, 0.75],
      ];
      for (const [x, z, scale] of spots.slice(0, 1 + level)) group.add(createTree(m, x, z, scale));
      group.add(part(box(0.22, 0.05, 0.08), m.get('trunk'), 0, 0.07, 0.05));
      for (const [x, z] of [
        [0.08, -0.32],
        [-0.34, -0.02],
        [0.34, -0.02],
      ]) {
        group.add(part(box(0.05, 0.05, 0.05), m.get('flower'), x, 0.065, z));
      }
      break;
    }
  }
  return group;
}

function createTree(m: Materials, x: number, z: number, scale: number): THREE.Group {
  const tree = new THREE.Group();
  tree.add(part(new THREE.CylinderGeometry(0.035, 0.045, 0.16, 6), m.get('trunk'), 0, 0.12, 0));
  tree.add(part(new THREE.ConeGeometry(0.17, 0.32, 7), m.get('leaves'), 0, 0.34, 0));
  tree.add(part(new THREE.ConeGeometry(0.12, 0.22, 7), m.get('leavesAlt'), 0, 0.5, 0));
  tree.position.set(x, 0, z);
  tree.scale.setScalar(scale);
  return tree;
}

/** Tiny blocky citizen, about a quarter tile tall. */
export function createCitizenMesh(m: Materials, variant: number): THREE.Group {
  const citizen = new THREE.Group();
  citizen.add(part(box(0.07, 0.08, 0.05), m.get('pants'), 0, 0.04, 0));
  citizen.add(part(box(0.09, 0.1, 0.06), m.get(variant % 2 === 0 ? 'shirt' : 'shirtAlt'), 0, 0.13, 0));
  citizen.add(part(box(0.07, 0.07, 0.07), m.get('skin'), 0, 0.215, 0));
  return citizen;
}
