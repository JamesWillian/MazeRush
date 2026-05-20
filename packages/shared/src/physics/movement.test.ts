import { describe, expect, it } from 'vitest';

import { MAX_INPUT_DELTA_MS } from '../constants.js';
import { generateMaze } from '../maze/generate.js';
import { gridToWorldX, gridToWorldZ } from '../maze/coords.js';

import { stepPlayer, type MovementInput } from './movement.js';

const MAZE = generateMaze({ width: 21, height: 21, seed: 7 });
const SPAWN = {
  x: gridToWorldX(1, MAZE.width, 2.0),
  z: gridToWorldZ(1, MAZE.height, 2.0),
};

function input(partial: Partial<MovementInput> = {}): MovementInput {
  return {
    moveX: 0,
    moveZ: 0,
    yaw: Math.PI,
    sprint: false,
    deltaMs: 16,
    ...partial,
  };
}

describe('stepPlayer', () => {
  it('is deterministic: same args twice give bit-identical positions', () => {
    const a = stepPlayer(MAZE, SPAWN, input({ moveZ: 1 }));
    const b = stepPlayer(MAZE, SPAWN, input({ moveZ: 1 }));
    expect(a.x).toBe(b.x);
    expect(a.z).toBe(b.z);
  });

  it('zero deltaMs returns the same position regardless of input', () => {
    const r = stepPlayer(MAZE, SPAWN, input({ moveX: 1, moveZ: 1, sprint: true, deltaMs: 0 }));
    expect(r).toEqual(SPAWN);
  });

  it('zero input vector returns the same position', () => {
    const r = stepPlayer(MAZE, SPAWN, input({ moveX: 0, moveZ: 0 }));
    expect(r).toEqual(SPAWN);
  });

  it('caps deltaMs at MAX_INPUT_DELTA_MS — huge dt behaves identically to the cap', () => {
    const capped = stepPlayer(
      MAZE,
      SPAWN,
      input({ moveZ: 1, deltaMs: MAX_INPUT_DELTA_MS }),
    );
    const huge = stepPlayer(MAZE, SPAWN, input({ moveZ: 1, deltaMs: 10_000 }));
    expect(capped).toEqual(huge);
  });

  it('does not let the player escape the maze even under repeated max-speed input', () => {
    let pos = SPAWN;
    for (let i = 0; i < 200; i++) {
      pos = stepPlayer(MAZE, pos, input({ moveZ: 1, sprint: true, deltaMs: 50 }));
    }
    // Maze is 21 cells × 2.0 = 42 units across, centered at origin → [-21, 21].
    expect(pos.x).toBeGreaterThan(-22);
    expect(pos.x).toBeLessThan(22);
    expect(pos.z).toBeGreaterThan(-22);
    expect(pos.z).toBeLessThan(22);
  });

  it('diagonal input does not exceed cardinal speed', () => {
    const cardinal = stepPlayer(MAZE, SPAWN, input({ moveZ: 1, deltaMs: 50 }));
    const diagonal = stepPlayer(MAZE, SPAWN, input({ moveX: 1, moveZ: 1, deltaMs: 50 }));
    const cardDist = Math.hypot(cardinal.x - SPAWN.x, cardinal.z - SPAWN.z);
    const diagDist = Math.hypot(diagonal.x - SPAWN.x, diagonal.z - SPAWN.z);
    expect(diagDist).toBeLessThanOrEqual(cardDist + 1e-6);
  });

  it('sprint moves further than walk in the same dt', () => {
    const walk = stepPlayer(MAZE, SPAWN, input({ moveZ: 1, sprint: false, deltaMs: 50 }));
    const run = stepPlayer(MAZE, SPAWN, input({ moveZ: 1, sprint: true, deltaMs: 50 }));
    const dWalk = Math.hypot(walk.x - SPAWN.x, walk.z - SPAWN.z);
    const dRun = Math.hypot(run.x - SPAWN.x, run.z - SPAWN.z);
    expect(dRun).toBeGreaterThan(dWalk);
  });
});
