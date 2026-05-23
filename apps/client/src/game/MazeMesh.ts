import * as THREE from 'three';

import {
  CELL_SIZE,
  DEFAULT_WALL_COLOR,
  gridToWorldX,
  gridToWorldZ,
  type MazeGrid,
  Tile,
} from '@mazerush/shared';

import { WALL_HEIGHT } from '../config.js';

export interface BuiltMaze {
  readonly group: THREE.Group;
  setWallColor(hex: number): void;
}

// Builds a Three.js Group containing the floor plus a single InstancedMesh
// for every wall tile. The maze is static for the lifetime of a match, so
// we build once.
//
// `skipCells` is a set of `y * width + x` indices for wall cells that
// should NOT render — used by exit doors to punch holes in the perimeter
// so the door visual (rendered separately) can take their place. Physics
// still treats those cells as walls; the player can't actually walk
// through, the door is a visual marker on the perimeter.
//
// `setWallColor` lets the pause-screen color picker recolor walls
// instantly: assigning to `material.color` is reflected next frame, no
// rebuild needed.
export function buildMazeMesh(maze: MazeGrid, skipCells: ReadonlySet<number> = new Set()): BuiltMaze {
  const group = new THREE.Group();
  group.add(buildFloor(maze));
  const { mesh, material } = buildWalls(maze, skipCells);
  group.add(mesh);

  return {
    group,
    setWallColor(hex: number): void {
      material.color.setHex(hex);
    },
  };
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

function buildWalls(
  maze: MazeGrid,
  skipCells: ReadonlySet<number>,
): { mesh: THREE.InstancedMesh; material: THREE.MeshStandardMaterial } {
  const wallCells: Array<readonly [number, number]> = [];
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      const idx = y * maze.width + x;
      if (skipCells.has(idx)) continue;
      if (maze.tiles[idx] === Tile.Wall) {
        wallCells.push([x, y]);
      }
    }
  }

  const geom = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE);
  const mat = new THREE.MeshStandardMaterial({
    color: parseInt(DEFAULT_WALL_COLOR.slice(1), 16),
    roughness: 0.85,
  });
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
  return { mesh: instances, material: mat };
}
