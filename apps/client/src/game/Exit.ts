import * as THREE from 'three';

import { CELL_SIZE } from '@mazerush/shared';

import { WALL_HEIGHT } from '../config.js';

// Glowing green slab that REPLACES the perimeter wall cube at a door
// cell. MazeMesh skips that cell when building walls, so the Exit fills
// the hole. Slightly narrower than the wall in both horizontal axes so
// the player can tell at a glance it's an opening, not just a colored
// wall.
const DOOR_THICKNESS_RATIO = 0.45; // how thin compared to a full cell
const DOOR_WIDTH_RATIO = 0.9;      // how wide in the wall-plane axis
const DOOR_HEIGHT_RATIO = 0.95;    // a sliver of dark above the doorway

export class Exit {
  readonly object: THREE.Object3D;

  // doorX/doorY are MAZE-GRID coordinates of the perimeter wall cell.
  // mazeWidth/mazeHeight come from the same MazeGrid so we can convert
  // and decide the doorway's orientation (north/south face vs east/west).
  constructor(doorX: number, doorY: number, mazeWidth: number, mazeHeight: number) {
    const isHorizontalWall = doorY === 0 || doorY === mazeHeight - 1;
    const w = CELL_SIZE * (isHorizontalWall ? DOOR_WIDTH_RATIO : DOOR_THICKNESS_RATIO);
    const d = CELL_SIZE * (isHorizontalWall ? DOOR_THICKNESS_RATIO : DOOR_WIDTH_RATIO);
    const h = WALL_HEIGHT * DOOR_HEIGHT_RATIO;

    const geom = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      emissive: 0x16a34a,
      emissiveIntensity: 0.9,
      roughness: 0.4,
    });
    const mesh = new THREE.Mesh(geom, mat);

    // Center the door in the cell, anchored to the floor with the same
    // Y as the wall would have been (so the lintel gap is at the top).
    const worldX = (doorX - (mazeWidth - 1) / 2) * CELL_SIZE;
    const worldZ = (doorY - (mazeHeight - 1) / 2) * CELL_SIZE;
    mesh.position.set(worldX, h / 2, worldZ);
    this.object = mesh;
  }
}
