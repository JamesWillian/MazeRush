import * as THREE from 'three';

import { CELL_SIZE } from '@mazerush/shared';

import { WALL_HEIGHT } from '../config.js';

// Replaces the perimeter wall cube at the door cell with a full-size
// emissive green block — same shape as a regular wall, just colored.
// The player wins by walking up to it from the adjacent inner cell;
// MazeMesh skips rendering the brown wall there so this is what fills
// the slot.
export class Exit {
  readonly object: THREE.Object3D;

  constructor(doorX: number, doorY: number, mazeWidth: number, mazeHeight: number) {
    const geom = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      emissive: 0x16a34a,
      emissiveIntensity: 0.85,
      roughness: 0.4,
    });
    const mesh = new THREE.Mesh(geom, mat);
    const worldX = (doorX - (mazeWidth - 1) / 2) * CELL_SIZE;
    const worldZ = (doorY - (mazeHeight - 1) / 2) * CELL_SIZE;
    mesh.position.set(worldX, WALL_HEIGHT / 2, worldZ);
    this.object = mesh;
  }
}
