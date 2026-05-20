import { describe, expect, it } from 'vitest';

import {
  CELL_SIZE,
  generateMaze,
  gridToWorldX,
  gridToWorldZ,
  type MovementInput,
} from '@mazerush/shared';

import { Prediction } from './Prediction.js';

const MAZE = generateMaze({ width: 21, height: 21, seed: 42 });
const SPAWN = {
  x: gridToWorldX(1, MAZE.width, CELL_SIZE),
  z: gridToWorldZ(1, MAZE.height, CELL_SIZE),
};

function move(seq: number, partial: Partial<MovementInput> = {}): MovementInput & { seq: number } {
  return {
    seq,
    moveX: 0,
    moveZ: 1,
    yaw: Math.PI,
    sprint: false,
    deltaMs: 16,
    ...partial,
  };
}

describe('Prediction', () => {
  it('advances locally on applyLocalInput', () => {
    const p = new Prediction(MAZE, SPAWN);
    const after = p.applyLocalInput(move(1));
    expect(after).not.toEqual(SPAWN);
    expect(p.pendingCount).toBe(1);
  });

  it('agreeing server: reconcile keeps the same predicted position', () => {
    const p = new Prediction(MAZE, SPAWN);
    p.applyLocalInput(move(1));
    p.applyLocalInput(move(2));
    p.applyLocalInput(move(3));
    const before = p.snapshot();

    // Server processed all 3 — its authoritative pos equals our prediction.
    p.reconcile(before, 3);

    expect(p.snapshot()).toEqual(before);
    expect(p.pendingCount).toBe(0);
  });

  it('partially-acked server: drops acked, replays the rest', () => {
    const p = new Prediction(MAZE, SPAWN);
    p.applyLocalInput(move(1));
    p.applyLocalInput(move(2));
    p.applyLocalInput(move(3));
    const fullPrediction = p.snapshot();

    // Server only saw seq 1 so far. Authoritative pos reflects only that
    // input. Build the "as if only seq 1" position by running a fresh
    // prediction.
    const reference = new Prediction(MAZE, SPAWN);
    const after1 = reference.applyLocalInput(move(1));

    p.reconcile(after1, 1);

    // After reconcile, predicted should equal "after applying 2 and 3 on top
    // of after1" — which is the same as the full prediction, since the same
    // ordered inputs produce the same result.
    expect(p.snapshot().x).toBeCloseTo(fullPrediction.x, 10);
    expect(p.snapshot().z).toBeCloseTo(fullPrediction.z, 10);
    expect(p.pendingCount).toBe(2);
  });

  it('snaps to authoritative position when server diverges (anti-cheat / collision)', () => {
    const p = new Prediction(MAZE, SPAWN);
    p.applyLocalInput(move(1));
    p.applyLocalInput(move(2));

    // Server says we never moved (e.g., clamped us). lastSeq=2, pos=SPAWN.
    p.reconcile(SPAWN, 2);

    expect(p.snapshot()).toEqual(SPAWN);
    expect(p.pendingCount).toBe(0);
  });

  it('reset clears pending and forces position', () => {
    const p = new Prediction(MAZE, SPAWN);
    p.applyLocalInput(move(1));
    p.applyLocalInput(move(2));
    p.reset({ x: 5, z: -3 });
    expect(p.snapshot()).toEqual({ x: 5, z: -3 });
    expect(p.pendingCount).toBe(0);
  });

  it('caps pending buffer at the configured maximum', () => {
    const p = new Prediction(MAZE, SPAWN);
    for (let i = 1; i <= 1000; i++) {
      p.applyLocalInput(move(i));
    }
    expect(p.pendingCount).toBeLessThanOrEqual(256);
  });
});
