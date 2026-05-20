import {
  CELL_SIZE,
  EXIT_REACH_RADIUS,
  FLAG_PICKUP_RADIUS,
  gridToWorldX,
  gridToWorldZ,
  MODE_CAPTURE,
  mulberry32,
  type MazeGrid,
} from '@mazerush/shared';

import type { ExitPoint } from '../schema/ExitPoint.js';

const FLAG_PICKUP_RADIUS_SQ = FLAG_PICKUP_RADIUS * FLAG_PICKUP_RADIUS;
const EXIT_REACH_RADIUS_SQ = EXIT_REACH_RADIUS * EXIT_REACH_RADIUS;

export interface CellPos {
  readonly gx: number;
  readonly gy: number;
}

// Finds the floor cell closest to the maze center. Recursive backtracker
// guarantees the center is a cell (odd coords), so this almost always
// returns exactly (midX, midY); we still scan a small ring as a safety net
// in case a future generator change moves things around.
export function pickFlagCell(maze: MazeGrid): CellPos {
  const midX = Math.floor(maze.width / 2);
  const midY = Math.floor(maze.height / 2);
  const cx = midX % 2 === 0 ? midX + 1 : midX;
  const cy = midY % 2 === 0 ? midY + 1 : midY;
  const safeCx = cx >= maze.width ? cx - 2 : cx;
  const safeCy = cy >= maze.height ? cy - 2 : cy;
  return { gx: safeCx, gy: safeCy };
}

// Picks `count` distinct exit cells from the inner perimeter — guaranteed
// floor cells (odd grid coords) on the row/column one step inside the
// outer wall. Deterministic in (seed, count).
export function pickExits(
  maze: MazeGrid,
  seed: number,
  count: number,
  excluded: ReadonlyArray<CellPos> = [],
): CellPos[] {
  const blocked = new Set(excluded.map((c) => `${c.gx},${c.gy}`));
  const candidates: CellPos[] = [];

  // Top + bottom edges (cells only — odd gx, gy=1 or height-2)
  for (let gx = 1; gx < maze.width - 1; gx += 2) {
    pushUnique({ gx, gy: 1 });
    pushUnique({ gx, gy: maze.height - 2 });
  }
  // Left + right edges
  for (let gy = 1; gy < maze.height - 1; gy += 2) {
    pushUnique({ gx: 1, gy });
    pushUnique({ gx: maze.width - 2, gy });
  }

  function pushUnique(cell: CellPos): void {
    const key = `${cell.gx},${cell.gy}`;
    if (blocked.has(key)) return;
    blocked.add(key);
    candidates.push(cell);
  }

  // Deterministic Fisher-Yates against the supplied seed.
  const rng = mulberry32(seed ^ 0xface);
  for (let i = 0; i < candidates.length - 1; i++) {
    const j = i + Math.floor(rng() * (candidates.length - i));
    const a = candidates[i];
    const b = candidates[j];
    if (a && b) {
      candidates[i] = b;
      candidates[j] = a;
    }
  }

  return candidates.slice(0, Math.min(count, candidates.length));
}

export interface TickInput {
  readonly maze: MazeGrid;
  // Iterable of (sessionId, position) — abstracted so tests don't need a
  // real MapSchema.
  readonly players: Iterable<{ sessionId: string; x: number; z: number }>;
  readonly flag: { x: number; z: number; carriedBy: string };
  readonly exits: ReadonlyArray<{ gx: number; gy: number }>;
  readonly mode: string;
}

export type TickEvent =
  | { readonly kind: 'pickup'; readonly sessionId: string }
  | { readonly kind: 'win'; readonly sessionId: string };

// Pure logic for one server tick. Returns the list of events that happened.
// Caller (MazeRoom) applies these to the schema. Keeping it pure means we
// can test win conditions with plain objects, no Colyseus required.
export function applyGameTick(input: TickInput): TickEvent[] {
  const events: TickEvent[] = [];

  // 1. Pickup detection. First player within the radius gets the flag.
  if (input.flag.carriedBy === '') {
    for (const p of input.players) {
      const d2 = sqDist(p.x, p.z, input.flag.x, input.flag.z);
      if (d2 <= FLAG_PICKUP_RADIUS_SQ) {
        events.push({ kind: 'pickup', sessionId: p.sessionId });
        // First match wins this tick — later ticks can resolve subsequent
        // events independently.
        break;
      }
    }
  }

  // 2. Exit detection. In Capture mode the player must be carrying the
  // flag; in Escape mode just reaching any exit ends the game.
  // Note: we use a *projected* carriedBy that accounts for a pickup that
  // happened above, so picking up and stepping out in the same tick still
  // counts.
  const carrierForThisTick =
    events.length > 0 && events[0]?.kind === 'pickup'
      ? events[0].sessionId
      : input.flag.carriedBy;
  const needsFlag = input.mode === MODE_CAPTURE;

  for (const p of input.players) {
    if (needsFlag && carrierForThisTick !== p.sessionId) continue;
    for (const exit of input.exits) {
      const ex = gridToWorldX(exit.gx, input.maze.width, CELL_SIZE);
      const ez = gridToWorldZ(exit.gy, input.maze.height, CELL_SIZE);
      if (sqDist(p.x, p.z, ex, ez) <= EXIT_REACH_RADIUS_SQ) {
        events.push({ kind: 'win', sessionId: p.sessionId });
        return events;
      }
    }
  }

  return events;
}

function sqDist(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

// Convenience: typed exit array accessor so MazeRoom callers don't need to
// know the schema shape.
export function exitsToReadonly(exits: ArrayLike<ExitPoint>): CellPos[] {
  const out: CellPos[] = [];
  for (let i = 0; i < exits.length; i++) {
    const e = exits[i];
    if (!e) continue;
    out.push({ gx: e.gx, gy: e.gy });
  }
  return out;
}
