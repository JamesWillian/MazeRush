import {
  gridToWorldX,
  gridToWorldZ,
  worldToGridX,
  worldToGridZ,
} from '../maze/coords.js';
import { getTile, Tile, type MazeGrid } from '../maze/types.js';

export type Vec2 = { x: number; z: number };

export type Aabb = {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
};

const EPS = 1e-4;

export function aabbOverlap(a: Aabb, b: Aabb): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

export function playerAabb(x: number, z: number, radius: number): Aabb {
  return { minX: x - radius, maxX: x + radius, minZ: z - radius, maxZ: z + radius };
}

function wallAabb(gx: number, gy: number, maze: MazeGrid, cellSize: number): Aabb {
  const cx = gridToWorldX(gx, maze.width, cellSize);
  const cz = gridToWorldZ(gy, maze.height, cellSize);
  const half = cellSize / 2;
  return { minX: cx - half, maxX: cx + half, minZ: cz - half, maxZ: cz + half };
}

// Iterates the 3×3 grid window around the player and yields the AABB of any
// wall tile (or out-of-bounds cell — perimeter treated as wall). Pure
// function: callers can reuse it on both sides.
export function nearbyWalls(
  maze: MazeGrid,
  cellSize: number,
  x: number,
  z: number,
): Aabb[] {
  const gx = worldToGridX(x, maze.width, cellSize);
  const gy = worldToGridZ(z, maze.height, cellSize);
  const out: Aabb[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = gx + dx;
      const cy = gy + dy;
      if (getTile(maze, cx, cy) === Tile.Wall) {
        out.push(wallAabb(cx, cy, maze, cellSize));
      }
    }
  }
  return out;
}

// Two-axis swept resolution: move on X first, snap out of any overlap, then
// move on Z. This is cheap, allocation-light, and avoids the diagonal
// "corner snag" you get when you naively reject the whole step.
//
// CAVEAT: at very large deltas (greater than cellSize) the player can tunnel
// through a thin wall in one tick. Callers must cap deltaMs server-side
// (MAX_INPUT_DELTA_MS) which keeps any single step well under cellSize at
// MAX_SPEED.
export function resolvePlayerMove(
  maze: MazeGrid,
  cellSize: number,
  radius: number,
  pos: Vec2,
  delta: Vec2,
): Vec2 {
  let nx = pos.x + delta.x;
  let nz = pos.z;

  if (delta.x !== 0) {
    const walls = nearbyWalls(maze, cellSize, nx, nz);
    for (const wall of walls) {
      const p = playerAabb(nx, nz, radius);
      if (!aabbOverlap(p, wall)) continue;
      if (delta.x > 0) nx = wall.minX - radius - EPS;
      else nx = wall.maxX + radius + EPS;
    }
  }

  nz = pos.z + delta.z;
  if (delta.z !== 0) {
    const walls = nearbyWalls(maze, cellSize, nx, nz);
    for (const wall of walls) {
      const p = playerAabb(nx, nz, radius);
      if (!aabbOverlap(p, wall)) continue;
      if (delta.z > 0) nz = wall.minZ - radius - EPS;
      else nz = wall.maxZ + radius + EPS;
    }
  }

  return { x: nx, z: nz };
}
