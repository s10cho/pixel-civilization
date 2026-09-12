import * as THREE from 'three';
import type { BuildingType } from '../building/types';
import { CAMERA } from '../config/gameConfig';
import type { EraId } from '../progression/era';
import { getBuildingGeometry } from './models';

/**
 * Small pictures of the buildings for the build menu: the real model, rendered from the same
 * angle as the city, in an offscreen renderer and cached as data URLs.
 */

interface Studio {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  mesh: THREE.Mesh;
}

const RENDER_SIZE = 72;
/** Share of the picture left empty around the model. */
const PADDING = 0.12;

const cache = new Map<string, string>();
let studio: Studio | null = null;
let unavailable = false;

function createStudio(): Studio {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(RENDER_SIZE, RENDER_SIZE, false);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xf2f8ff, 0x6b7a5a, 1.3));
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.2);
  sun.position.set(-6, 10, 6);
  scene.add(sun);

  const mesh = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0 }),
  );
  scene.add(mesh);

  return { renderer, scene, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100), mesh };
}

/** A picture of the building as it looks in this era, or null if the browser cannot render one. */
export function buildingThumbnail(type: BuildingType, era: EraId): string | null {
  if (unavailable) return null;
  const key = `${type}:${era}`;
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    studio ??= createStudio();
    const { renderer, scene, camera, mesh } = studio;
    mesh.geometry = getBuildingGeometry(type, 1, era);
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox!;
    const centre = box.getCenter(new THREE.Vector3());

    // Look at the model from the city's viewing angle.
    const distance = 20;
    const flat = Math.sin(CAMERA.polarAngle) * distance;
    camera.position.set(
      centre.x + flat * Math.sin(CAMERA.azimuth),
      centre.y + Math.cos(CAMERA.polarAngle) * distance,
      centre.z + flat * Math.cos(CAMERA.azimuth),
    );
    camera.lookAt(centre);
    camera.updateMatrixWorld(true);

    // Fit the frustum to the model's silhouette, then square it off.
    const bounds = new THREE.Box3();
    const corner = new THREE.Vector3();
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) {
          bounds.expandByPoint(corner.set(x, y, z).applyMatrix4(camera.matrixWorldInverse));
        }
      }
    }
    const size = bounds.getSize(corner);
    const extent = Math.max(size.x, size.y) * (1 + PADDING * 2);
    const middle = bounds.getCenter(new THREE.Vector3());
    camera.left = middle.x - extent / 2;
    camera.right = middle.x + extent / 2;
    camera.top = middle.y + extent / 2;
    camera.bottom = middle.y - extent / 2;
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    cache.set(key, url);
    return url;
  } catch {
    // No second WebGL context available: the build menu keeps its icons.
    unavailable = true;
    return null;
  }
}
