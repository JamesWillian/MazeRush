import { describe, expect, it } from 'vitest';

import { generateMaze, listFloorCells, pickFloorCells } from './generate.js';
import { mulberry32 } from './seededRng.js';
import { getTile, isFloor, Tile, type MazeGrid } from './types.js';

const SMALL = { width: 11, height: 11, seed: 42 };
const SPEC = { width: 21, height: 21, seed: 123 };

function bfsFloorReachable(maze: MazeGrid, start: [number, number]): number {
  const visited = new Set<number>();
  const queue: Array<[number, number]> = [start];
  visited.add(start[1] * maze.width + start[0]);
  const dirs: ReadonlyArray<readonly [number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (queue.length > 0) {
    const cell = queue.shift();
    if (!cell) break;
    const [x, y] = cell;
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      const key = ny * maze.width + nx;
      if (visited.has(key)) continue;
      if (!isFloor(maze, nx, ny)) continue;
      visited.add(key);
      queue.push([nx, ny]);
    }
  }
  return visited.size;
}

describe('generateMaze', () => {
  it('is deterministic: same seed produces identical tiles', () => {
    const a = generateMaze(SPEC);
    const b = generateMaze(SPEC);
    expect(a.tiles).toEqual(b.tiles);
    expect(a.width).toBe(b.width);
    expect(a.height).toBe(b.height);
  });

  it('different seeds produce different mazes', () => {
    const a = generateMaze({ ...SPEC, seed: 1 });
    const b = generateMaze({ ...SPEC, seed: 2 });
    expect(a.tiles).not.toEqual(b.tiles);
  });

  it('rejects even dimensions', () => {
    expect(() => generateMaze({ width: 10, height: 11, seed: 1 })).toThrow();
    expect(() => generateMaze({ width: 11, height: 10, seed: 1 })).toThrow();
  });

  it('rejects mazes smaller than 3x3', () => {
    expect(() => generateMaze({ width: 1, height: 1, seed: 1 })).toThrow();
  });

  it('keeps the entire border sealed', () => {
    const maze = generateMaze(SPEC);
    for (let x = 0; x < maze.width; x++) {
      expect(getTile(maze, x, 0)).toBe(Tile.Wall);
      expect(getTile(maze, x, maze.height - 1)).toBe(Tile.Wall);
    }
    for (let y = 0; y < maze.height; y++) {
      expect(getTile(maze, 0, y)).toBe(Tile.Wall);
      expect(getTile(maze, maze.width - 1, y)).toBe(Tile.Wall);
    }
  });

  it('produces a fully connected floor (every Floor reachable from start)', () => {
    const maze = generateMaze(SPEC);
    const floors = listFloorCells(maze);
    const reached = bfsFloorReachable(maze, [1, 1]);
    expect(reached).toBe(floors.length);
  });

  it('places cells (odd coords) as floor', () => {
    const maze = generateMaze(SMALL);
    for (let y = 1; y < maze.height - 1; y += 2) {
      for (let x = 1; x < maze.width - 1; x += 2) {
        expect(isFloor(maze, x, y)).toBe(true);
      }
    }
  });

  it('returns the seed it was generated with', () => {
    const maze = generateMaze(SPEC);
    expect(maze.seed).toBe(SPEC.seed);
  });
});

describe('pickFloorCells', () => {
  it('returns the requested count of distinct floor cells', () => {
    const maze = generateMaze(SPEC);
    const rng = mulberry32(99);
    const picks = pickFloorCells(maze, rng, 8);
    expect(picks).toHaveLength(8);
    const set = new Set(picks.map(([x, y]) => `${x},${y}`));
    expect(set.size).toBe(8);
    for (const [x, y] of picks) {
      expect(isFloor(maze, x, y)).toBe(true);
    }
  });

  it('is deterministic for a given rng', () => {
    const maze = generateMaze(SPEC);
    const a = pickFloorCells(maze, mulberry32(11), 5);
    const b = pickFloorCells(maze, mulberry32(11), 5);
    expect(a).toEqual(b);
  });

  it('throws when asked for more cells than exist', () => {
    const maze = generateMaze({ width: 3, height: 3, seed: 1 });
    expect(() => pickFloorCells(maze, mulberry32(1), 999)).toThrow();
  });
});
