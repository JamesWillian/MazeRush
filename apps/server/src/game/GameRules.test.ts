import { describe, expect, it } from 'vitest';

import {
  CELL_SIZE,
  generateMaze,
  gridToWorldX,
  gridToWorldZ,
  MODE_CAPTURE,
  MODE_ESCAPE,
  type MazeGrid,
} from '@mazerush/shared';

import { applyGameTick, pickExits, pickFlagCell } from './GameRules.js';

const MAZE = generateMaze({ width: 21, height: 21, seed: 7 });

function exitWorld(maze: MazeGrid, gx: number, gy: number): { x: number; z: number } {
  return {
    x: gridToWorldX(gx, maze.width, CELL_SIZE),
    z: gridToWorldZ(gy, maze.height, CELL_SIZE),
  };
}

describe('pickFlagCell', () => {
  it('returns an odd-coord cell near center', () => {
    const flag = pickFlagCell(MAZE);
    expect(flag.gx % 2).toBe(1);
    expect(flag.gy % 2).toBe(1);
    expect(Math.abs(flag.gx - 10)).toBeLessThan(2);
    expect(Math.abs(flag.gy - 10)).toBeLessThan(2);
  });
});

describe('pickExits', () => {
  it('returns the requested count of distinct cells', () => {
    const exits = pickExits(MAZE, 7, 2);
    expect(exits).toHaveLength(2);
    expect(exits[0]).not.toEqual(exits[1]);
  });

  it('all exits sit on the inner perimeter', () => {
    const exits = pickExits(MAZE, 7, 4);
    for (const e of exits) {
      const onEdge =
        e.gx === 1 || e.gx === MAZE.width - 2 || e.gy === 1 || e.gy === MAZE.height - 2;
      expect(onEdge).toBe(true);
    }
  });

  it('respects excluded cells', () => {
    const flag = pickFlagCell(MAZE);
    const exits = pickExits(MAZE, 7, 2, [flag]);
    for (const e of exits) {
      expect(`${e.gx},${e.gy}`).not.toBe(`${flag.gx},${flag.gy}`);
    }
  });

  it('is deterministic for the same seed', () => {
    expect(pickExits(MAZE, 7, 2)).toEqual(pickExits(MAZE, 7, 2));
  });
});

describe('applyGameTick', () => {
  const flagPos = exitWorld(MAZE, 11, 11); // approx maze center
  const exitsCell = [{ gx: 1, gy: 1 }];
  const baseInput = {
    maze: MAZE,
    flag: { x: flagPos.x, z: flagPos.z, carriedBy: '' },
    exits: exitsCell,
    mode: MODE_CAPTURE,
  };

  it('emits no events when nobody is near anything', () => {
    const events = applyGameTick({
      ...baseInput,
      players: [{ sessionId: 'a', x: -100, z: -100 }],
    });
    expect(events).toEqual([]);
  });

  it('emits pickup when a player is within FLAG_PICKUP_RADIUS', () => {
    const events = applyGameTick({
      ...baseInput,
      players: [{ sessionId: 'a', x: flagPos.x, z: flagPos.z }],
    });
    expect(events).toEqual([{ kind: 'pickup', sessionId: 'a' }]);
  });

  it('does not emit pickup if flag is already carried', () => {
    const events = applyGameTick({
      ...baseInput,
      flag: { x: flagPos.x, z: flagPos.z, carriedBy: 'b' },
      players: [{ sessionId: 'a', x: flagPos.x, z: flagPos.z }],
    });
    expect(events.find((e) => e.kind === 'pickup')).toBeUndefined();
  });

  it('emits win in Capture mode only when carrier reaches exit', () => {
    const exitW = exitWorld(MAZE, 1, 1);
    // Non-carrier at exit: no win
    const events1 = applyGameTick({
      ...baseInput,
      flag: { x: flagPos.x, z: flagPos.z, carriedBy: 'a' },
      players: [{ sessionId: 'b', x: exitW.x, z: exitW.z }],
    });
    expect(events1.find((e) => e.kind === 'win')).toBeUndefined();

    // Carrier at exit: win
    const events2 = applyGameTick({
      ...baseInput,
      flag: { x: flagPos.x, z: flagPos.z, carriedBy: 'a' },
      players: [{ sessionId: 'a', x: exitW.x, z: exitW.z }],
    });
    expect(events2).toContainEqual({ kind: 'win', sessionId: 'a' });
  });

  it('emits win in Escape mode for any player at exit, no flag required', () => {
    const exitW = exitWorld(MAZE, 1, 1);
    const events = applyGameTick({
      ...baseInput,
      mode: MODE_ESCAPE,
      players: [{ sessionId: 'a', x: exitW.x, z: exitW.z }],
    });
    expect(events).toContainEqual({ kind: 'win', sessionId: 'a' });
  });

  it('handles pickup-and-win in the same tick (Capture mode)', () => {
    // Player is at flag AND at exit simultaneously (degenerate test maze
    // where flag and exit overlap — verifies the carrier-of-this-tick
    // logic). Move exit to flag for the test.
    const exitsAtFlag = [{ gx: 11, gy: 11 }];
    const events = applyGameTick({
      ...baseInput,
      exits: exitsAtFlag,
      players: [{ sessionId: 'a', x: flagPos.x, z: flagPos.z }],
    });
    expect(events).toContainEqual({ kind: 'pickup', sessionId: 'a' });
    expect(events).toContainEqual({ kind: 'win', sessionId: 'a' });
  });
});
