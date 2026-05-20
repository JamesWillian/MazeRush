import { describe, expect, it } from 'vitest';

import { CELL_SIZE, PLAYER_RADIUS } from '../constants.js';
import { generateMaze } from '../maze/generate.js';
import { gridToWorldX, gridToWorldZ } from '../maze/coords.js';
import { isFloor, type MazeGrid } from '../maze/types.js';

import { aabbOverlap, nearbyWalls, playerAabb, resolvePlayerMove } from './aabb.js';

const MAZE = generateMaze({ width: 21, height: 21, seed: 7 });

function spawnCenter(maze: MazeGrid): { x: number; z: number } {
  return {
    x: gridToWorldX(1, maze.width, CELL_SIZE),
    z: gridToWorldZ(1, maze.height, CELL_SIZE),
  };
}

describe('aabbOverlap', () => {
  it('detects overlapping boxes', () => {
    expect(
      aabbOverlap(
        { minX: 0, maxX: 1, minZ: 0, maxZ: 1 },
        { minX: 0.5, maxX: 1.5, minZ: 0.5, maxZ: 1.5 },
      ),
    ).toBe(true);
  });

  it('returns false for boxes that only touch on an edge', () => {
    expect(
      aabbOverlap(
        { minX: 0, maxX: 1, minZ: 0, maxZ: 1 },
        { minX: 1, maxX: 2, minZ: 0, maxZ: 1 },
      ),
    ).toBe(false);
  });

  it('returns false for separated boxes', () => {
    expect(
      aabbOverlap(
        { minX: 0, maxX: 1, minZ: 0, maxZ: 1 },
        { minX: 2, maxX: 3, minZ: 2, maxZ: 3 },
      ),
    ).toBe(false);
  });
});

describe('playerAabb', () => {
  it('produces a centered square of side 2*radius', () => {
    const aabb = playerAabb(5, 7, 0.3);
    expect(aabb.minX).toBeCloseTo(4.7);
    expect(aabb.maxX).toBeCloseTo(5.3);
    expect(aabb.minZ).toBeCloseTo(6.7);
    expect(aabb.maxZ).toBeCloseTo(7.3);
  });
});

describe('nearbyWalls', () => {
  it('returns up to 9 walls (3x3 window) and at least the perimeter', () => {
    const spawn = spawnCenter(MAZE);
    const walls = nearbyWalls(MAZE, CELL_SIZE, spawn.x, spawn.z);
    expect(walls.length).toBeGreaterThan(0);
    expect(walls.length).toBeLessThanOrEqual(9);
  });

  it('treats out-of-bounds cells as walls', () => {
    const farX = gridToWorldX(MAZE.width + 5, MAZE.width, CELL_SIZE);
    const farZ = gridToWorldZ(MAZE.height + 5, MAZE.height, CELL_SIZE);
    const walls = nearbyWalls(MAZE, CELL_SIZE, farX, farZ);
    expect(walls.length).toBe(9);
  });
});

describe('resolvePlayerMove', () => {
  it('moves freely in open space (zero collision)', () => {
    const start = spawnCenter(MAZE);
    const after = resolvePlayerMove(MAZE, CELL_SIZE, PLAYER_RADIUS, start, { x: 0.1, z: 0 });
    expect(after.x).toBeCloseTo(start.x + 0.1);
    expect(after.z).toBeCloseTo(start.z);
  });

  it('does not push the player through a wall when walking into one', () => {
    const start = spawnCenter(MAZE);
    // Find a direction that hits a wall: scan 4 cardinals
    const dirs: Array<{ x: number; z: number }> = [
      { x: CELL_SIZE, z: 0 },
      { x: -CELL_SIZE, z: 0 },
      { x: 0, z: CELL_SIZE },
      { x: 0, z: -CELL_SIZE },
    ];
    for (const d of dirs) {
      const after = resolvePlayerMove(MAZE, CELL_SIZE, PLAYER_RADIUS, start, d);
      // Player AABB must not overlap any nearby wall after resolution.
      const playerBox = playerAabb(after.x, after.z, PLAYER_RADIUS);
      const walls = nearbyWalls(MAZE, CELL_SIZE, after.x, after.z);
      for (const w of walls) {
        expect(aabbOverlap(playerBox, w)).toBe(false);
      }
    }
  });

  it('resolves diagonal movement without getting stuck on corners', () => {
    // Stress test: 1000 random moves from spawn never end inside a wall.
    let pos = spawnCenter(MAZE);
    let seed = 1;
    const rng = () => {
      // tiny inline lcg, deterministic
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 1000; i++) {
      const dx = (rng() - 0.5) * 0.5;
      const dz = (rng() - 0.5) * 0.5;
      pos = resolvePlayerMove(MAZE, CELL_SIZE, PLAYER_RADIUS, pos, { x: dx, z: dz });
      const playerBox = playerAabb(pos.x, pos.z, PLAYER_RADIUS);
      const walls = nearbyWalls(MAZE, CELL_SIZE, pos.x, pos.z);
      for (const w of walls) {
        expect(aabbOverlap(playerBox, w)).toBe(false);
      }
    }
  });

  it('zero delta returns the same position', () => {
    const start = spawnCenter(MAZE);
    const after = resolvePlayerMove(MAZE, CELL_SIZE, PLAYER_RADIUS, start, { x: 0, z: 0 });
    expect(after.x).toBeCloseTo(start.x);
    expect(after.z).toBeCloseTo(start.z);
  });

  it('keeps the player on a floor cell after small moves', () => {
    const start = spawnCenter(MAZE);
    const after = resolvePlayerMove(MAZE, CELL_SIZE, PLAYER_RADIUS, start, { x: 0.05, z: 0.05 });
    // The cell we end up rounding to must be floor.
    const gx = Math.round(after.x / CELL_SIZE + (MAZE.width - 1) / 2);
    const gy = Math.round(after.z / CELL_SIZE + (MAZE.height - 1) / 2);
    expect(isFloor(MAZE, gx, gy)).toBe(true);
  });
});
