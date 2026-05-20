// Maze representation: a width × height grid of tiles. Cells live at odd
// coordinates and the spaces between them (also stored as tiles) are either
// carved into passages (Floor) or left as Wall.
//
// We use a flat Uint8 of 0/1 instead of an object-per-cell. Two reasons:
//   1. It serializes trivially (server can ship a single Uint8Array).
//   2. AABB collision in the hot path becomes one indexed read.

export const Tile = {
  Wall: 0,
  Floor: 1,
} as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

export type MazeGrid = {
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  readonly tiles: ReadonlyArray<Tile>;
};

// Safe read: out-of-bounds always returns Wall, so collision code never has
// to special-case the perimeter.
export function getTile(maze: MazeGrid, x: number, y: number): Tile {
  if (x < 0 || y < 0 || x >= maze.width || y >= maze.height) return Tile.Wall;
  const idx = y * maze.width + x;
  return maze.tiles[idx] ?? Tile.Wall;
}

export function isFloor(maze: MazeGrid, x: number, y: number): boolean {
  return getTile(maze, x, y) === Tile.Floor;
}
