import * as THREE from 'three';
import type { BuildingType } from '../building/types';
import { MARKERS, SCENE_3D } from '../config/gameConfig';
import type { EraId } from '../progression/era';
import { tileToWorld, type TileCoord } from './coords';
import { getBuildingGeometry } from './models';

/** Selection frame and placement preview (tinted tile + translucent ghost building). */
export class TileMarkers {
  private readonly selection = new THREE.Group();
  private readonly selectionMaterial = new THREE.MeshBasicMaterial({ color: MARKERS.selection });
  private readonly previewTile: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly ghost: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private readonly position = new THREE.Vector3();

  constructor(private readonly scene: THREE.Scene) {
    const { frameThickness: t, frameHeight: h } = MARKERS;
    const bar = new THREE.BoxGeometry(1, h, t);
    for (const [x, z, rotated] of [
      [0, -0.5, false],
      [0, 0.5, false],
      [-0.5, 0, true],
      [0.5, 0, true],
    ] as const) {
      const mesh = new THREE.Mesh(bar, this.selectionMaterial);
      mesh.position.set(x, h / 2, z);
      if (rotated) mesh.rotation.y = Math.PI / 2;
      this.selection.add(mesh);
    }
    this.selection.visible = false;
    scene.add(this.selection);

    this.previewTile = new THREE.Mesh(
      new THREE.PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: MARKERS.previewOpacity, depthWrite: false }),
    );
    this.previewTile.visible = false;
    scene.add(this.previewTile);

    this.ghost = new THREE.Mesh(
      getBuildingGeometry('house', 1, 'ancient'),
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        transparent: true,
        opacity: MARKERS.ghostOpacity,
        depthWrite: false,
      }),
    );
    this.ghost.visible = false;
    scene.add(this.ghost);
  }

  setSelection(tile: TileCoord | null): void {
    this.selection.visible = tile !== null;
    if (tile) this.selection.position.copy(tileToWorld(tile.col, tile.row, this.position));
  }

  showPreview(type: BuildingType, level: number, era: EraId, tile: TileCoord, valid: boolean): void {
    tileToWorld(tile.col, tile.row, this.position);
    this.previewTile.position.copy(this.position).setY(SCENE_3D.tileTop + 0.006);
    this.previewTile.material.color.setHex(valid ? MARKERS.previewValid : MARKERS.previewInvalid);
    this.previewTile.visible = true;

    this.ghost.geometry = getBuildingGeometry(type, level, era);
    this.ghost.position.copy(this.position);
    this.ghost.visible = true;
  }

  hidePreview(): void {
    this.previewTile.visible = false;
    this.ghost.visible = false;
  }

  dispose(): void {
    this.scene.remove(this.selection, this.previewTile, this.ghost);
    (this.selection.children[0] as THREE.Mesh).geometry.dispose();
    this.selectionMaterial.dispose();
    this.previewTile.geometry.dispose();
    this.previewTile.material.dispose();
    // The ghost's geometry is a shared cached model; only its material is ours.
    this.ghost.material.dispose();
  }
}
