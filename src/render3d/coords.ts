import * as THREE from 'three';
import { SCENE_3D, WORLD } from '../config/gameConfig';

/**
 * Conversions between grid/simulation coordinates and 3D world space.
 * The world is centred on the origin: x runs along columns, z along rows, y is up.
 */

export interface TileCoord {
  col: number;
  row: number;
}

/** World-space centre of a tile's top surface. */
export function tileToWorld(col: number, row: number, target = new THREE.Vector3()): THREE.Vector3 {
  return target.set(col - WORLD.cols / 2 + 0.5, SCENE_3D.tileTop, row - WORLD.rows / 2 + 0.5);
}

export function worldToTile(x: number, z: number): TileCoord {
  return { col: Math.floor(x + WORLD.cols / 2), row: Math.floor(z + WORLD.rows / 2) };
}

/** Simulation positions are in tile units, where a tile's centre is (col + 0.5, row + 0.5). */
export function simToWorld(x: number, y: number, target = new THREE.Vector3()): THREE.Vector3 {
  return target.set(x - WORLD.cols / 2, SCENE_3D.tileTop, y - WORLD.rows / 2);
}
