import * as THREE from 'three';

import {
  CELL_SIZE,
  gridToWorldX,
  gridToWorldZ,
  type MazeGrid,
  Tile,
} from '@mazerush/shared';

import { WALL_HEIGHT } from '../config.js';

// Builds a Three.js Group containing the floor plus a single InstancedMesh
// for every wall tile. The maze is static for the lifetime of a match, so we
// build once and never touch instanceMatrix again.
//
// Why InstancedMesh: a 21×21 maze typically has 200+ wall tiles. Rendering
// each as its own Mesh would issue 200+ draw calls per frame. InstancedMesh
// collapses that to one regardless of count.
export function buildMazeMesh(maze: MazeGrid): THREE.Group {
  const group = new THREE.Group();
  group.add(buildFloor(maze));
  group.add(buildWalls(maze));
  return group;
}

function buildFloor(maze: MazeGrid): THREE.Mesh {
  const w = maze.width * CELL_SIZE;
  const h = maze.height * CELL_SIZE;
  const geom = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshStandardMaterial({ color: 0x1f1f23, roughness: 0.95 });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function buildWalls(maze: MazeGrid): THREE.InstancedMesh {
  const wallCells: Array<readonly [number, number]> = [];
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      if (maze.tiles[y * maze.width + x] === Tile.Wall) {
        wallCells.push([x, y]);
      }
    }
  }

  const geom = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE);
  const mat = new THREE.MeshStandardMaterial({ color: 0x7b6c52, roughness: 0.85 });
  const instances = new THREE.InstancedMesh(geom, mat, wallCells.length);

  const m = new THREE.Matrix4();
  for (let i = 0; i < wallCells.length; i++) {
    const cell = wallCells[i];
    if (!cell) continue;
    const [gx, gy] = cell;
    const wx = gridToWorldX(gx, maze.width, CELL_SIZE);
    const wz = gridToWorldZ(gy, maze.height, CELL_SIZE);
    m.makeTranslation(wx, WALL_HEIGHT / 2, wz);
    instances.setMatrixAt(i, m);
  }
  instances.instanceMatrix.needsUpdate = true;
  return instances;
}
