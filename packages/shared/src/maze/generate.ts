import { mulberry32, randInt, type Rng } from './seededRng.js';
import { Tile, type MazeGrid } from './types.js';

export type GenerateOptions = {
  readonly width: number;
  readonly height: number;
  readonly seed: number;
};

// Recursive backtracker, iterative form. Carves perfect mazes (every cell
// connected by exactly one path) and is deterministic given (width, height,
// seed).
//
// Cells are placed at odd coordinates. Walls live at the gaps. To carve a
// passage between two adjacent cells, we knock down the wall between them.
export function generateMaze(opts: GenerateOptions): MazeGrid {
  const { width, height, seed } = opts;
  if (width < 3 || height < 3) {
    throw new Error('maze must be at least 3x3');
  }
  if (width % 2 === 0 || height % 2 === 0) {
    throw new Error('maze width and height must both be odd');
  }

  const tiles: Tile[] = new Array<Tile>(width * height).fill(Tile.Wall);
  const rng = mulberry32(seed);

  // Stable ordering — the RNG is the only source of variation.
  const directions: ReadonlyArray<readonly [number, number]> = [
    [0, -2],
    [2, 0],
    [0, 2],
    [-2, 0],
  ];

  const startX = 1;
  const startY = 1;
  tiles[startY * width + startX] = Tile.Floor;

  // Stack of (x, y) cells whose neighbours we still want to explore. Using
  // numbers (no allocation per push) keeps GC pressure minimal even on large
  // mazes.
  const stack: number[] = [startX, startY];

  while (stack.length > 0) {
    const cy = stack[stack.length - 1] ?? 0;
    const cx = stack[stack.length - 2] ?? 0;

    const candidates: Array<readonly [number, number]> = [];
    for (const [dx, dy] of directions) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 1 || ny < 1 || nx > width - 2 || ny > height - 2) continue;
      if (tiles[ny * width + nx] === Tile.Wall) {
        candidates.push([nx, ny]);
      }
    }

    if (candidates.length === 0) {
      stack.pop();
      stack.pop();
      continue;
    }

    const pick = candidates[randInt(rng, candidates.length)];
    if (!pick) continue; // unreachable, satisfies noUncheckedIndexedAccess
    const [nx, ny] = pick;

    // Carve the cell and the wall between current and chosen cell.
    const wx = (cx + nx) >> 1;
    const wy = (cy + ny) >> 1;
    tiles[ny * width + nx] = Tile.Floor;
    tiles[wy * width + wx] = Tile.Floor;

    stack.push(nx, ny);
  }

  return { width, height, seed, tiles };
}

// Convenience for tests and gameplay code that wants to know which cells are
// usable spawn / pickup positions.
export function listFloorCells(maze: MazeGrid): Array<readonly [number, number]> {
  const out: Array<readonly [number, number]> = [];
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      if (maze.tiles[y * maze.width + x] === Tile.Floor) {
        out.push([x, y]);
      }
    }
  }
  return out;
}

// Picks N distinct floor cells with the supplied RNG. Useful for spawn
// placement: server hands the client only the seed, both sides reproduce the
// same spawns.
export function pickFloorCells(
  maze: MazeGrid,
  rng: Rng,
  count: number,
): Array<readonly [number, number]> {
  const all = listFloorCells(maze);
  if (count > all.length) throw new Error('not enough floor cells');
  // Fisher-Yates over the first `count` slots.
  for (let i = 0; i < count; i++) {
    const j = i + randInt(rng, all.length - i);
    const a = all[i];
    const b = all[j];
    if (a && b) {
      all[i] = b;
      all[j] = a;
    }
  }
  return all.slice(0, count);
}
