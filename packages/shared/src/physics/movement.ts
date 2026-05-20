import {
  CELL_SIZE,
  MAX_INPUT_DELTA_MS,
  MAX_SPEED,
  PLAYER_RADIUS,
  SPRINT_MULTIPLIER,
} from '../constants.js';
import { type MazeGrid } from '../maze/types.js';

import { resolvePlayerMove, type Vec2 } from './aabb.js';

// MovementInput is the gameplay-relevant subset of an InputMessage — just
// the fields that affect simulation. Decoupled so callers can construct one
// without faking a seq number.
export interface MovementInput {
  readonly moveX: number; // local right (D = +1, A = -1)
  readonly moveZ: number; // local forward (W = +1, S = -1)
  readonly yaw: number;
  readonly sprint: boolean;
  readonly deltaMs: number;
}

// Single source of truth for player movement. Server runs this in its
// receive-input handler; client runs it for local prediction. Same code in
// both places means the predicted position converges with the authoritative
// position whenever input + seed match, with no float drift.
//
// Caps deltaMs server-side and client-side identically (MAX_INPUT_DELTA_MS),
// which is what keeps the two halves in sync when the client's frame is
// long (tab refocus, GC pause) — both halves see the same effective step.
export function stepPlayer(maze: MazeGrid, pos: Vec2, input: MovementInput): Vec2 {
  const dtMs = Math.min(input.deltaMs, MAX_INPUT_DELTA_MS);
  if (dtMs <= 0) return { x: pos.x, z: pos.z };
  const dt = dtMs / 1000;

  // Player-local axes in world space (see LocalPlayer.ts notes).
  const cosY = Math.cos(input.yaw);
  const sinY = Math.sin(input.yaw);
  const forwardX = -sinY;
  const forwardZ = -cosY;
  const rightX = cosY;
  const rightZ = -sinY;

  let inX = rightX * input.moveX + forwardX * input.moveZ;
  let inZ = rightZ * input.moveX + forwardZ * input.moveZ;

  // Normalize so diagonals don't outrun cardinals.
  const mag = Math.hypot(inX, inZ);
  if (mag > 1) {
    inX /= mag;
    inZ /= mag;
  }

  const speed = MAX_SPEED * (input.sprint ? SPRINT_MULTIPLIER : 1);
  return resolvePlayerMove(maze, CELL_SIZE, PLAYER_RADIUS, pos, {
    x: inX * speed * dt,
    z: inZ * speed * dt,
  });
}
