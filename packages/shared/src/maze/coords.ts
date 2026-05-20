// Conversion between maze-grid coordinates (integer indices) and world-space
// coordinates (Three.js units, origin at maze center, +X east, +Z south).
//
// Both client and server use these helpers so the meaning of a position is
// identical on either side. Putting the origin at the maze center keeps
// rotations symmetric and makes the camera frustum sit nicely around the
// player without needing to translate the whole scene.

export function gridToWorldX(gx: number, width: number, cellSize: number): number {
  return (gx - (width - 1) / 2) * cellSize;
}

export function gridToWorldZ(gy: number, height: number, cellSize: number): number {
  return (gy - (height - 1) / 2) * cellSize;
}

export function worldToGridX(worldX: number, width: number, cellSize: number): number {
  return Math.round(worldX / cellSize + (width - 1) / 2);
}

export function worldToGridZ(worldZ: number, height: number, cellSize: number): number {
  return Math.round(worldZ / cellSize + (height - 1) / 2);
}
