import { stepPlayer, type MazeGrid, type MovementInput, type Vec2 } from '@mazerush/shared';

interface PendingInput extends MovementInput {
  readonly seq: number;
}

// Client-side prediction + server reconciliation.
//
// Flow:
//   1. On every frame the controls are sampled, an InputMessage is sent up,
//      AND `applyLocalInput` is called locally to advance our predicted
//      position immediately. The camera reads from `pos` so the player sees
//      zero-latency response to their own keys.
//   2. The server processes the same inputs, broadcasts state with its
//      `lastSeq` ack. When that arrives, `reconcile()` runs:
//        - drop every pending input whose seq the server has already acked
//        - reset the predicted position to the server's authoritative pos
//        - re-apply the still-pending inputs on top
//      If the client and server agree, the resulting `pos` equals what we
//      had before reconcile — no visible jump. If they disagree (server
//      rejected/clamped a move under Step 7's anti-cheat), the player's
//      camera snaps to the corrected position in one frame.
//
// Cap on the pending buffer: a hostile or hopelessly lagged client could
// otherwise stockpile inputs and blow memory.
const MAX_PENDING_INPUTS = 256;

export class Prediction {
  private predictedPos: Vec2;
  private readonly pending: PendingInput[] = [];

  constructor(
    private readonly maze: MazeGrid,
    initialPos: Vec2,
  ) {
    this.predictedPos = { x: initialPos.x, z: initialPos.z };
  }

  applyLocalInput(input: PendingInput): Vec2 {
    this.predictedPos = stepPlayer(this.maze, this.predictedPos, input);
    this.pending.push(input);
    if (this.pending.length > MAX_PENDING_INPUTS) {
      this.pending.splice(0, this.pending.length - MAX_PENDING_INPUTS);
    }
    return this.snapshot();
  }

  reconcile(authoritativePos: Vec2, serverLastSeq: number): Vec2 {
    // Drop acked inputs in place (O(n) but n is bounded and small).
    let drop = 0;
    while (drop < this.pending.length) {
      const head = this.pending[drop];
      if (!head || head.seq > serverLastSeq) break;
      drop++;
    }
    if (drop > 0) this.pending.splice(0, drop);

    // Replay remaining unacked inputs on top of the authoritative position.
    let pos: Vec2 = { x: authoritativePos.x, z: authoritativePos.z };
    for (const input of this.pending) {
      pos = stepPlayer(this.maze, pos, input);
    }
    this.predictedPos = pos;
    return this.snapshot();
  }

  // Forces predicted position to a value (used on initial spawn before the
  // first reconcile, and as an emergency reset if the buffer is full).
  reset(pos: Vec2): void {
    this.predictedPos = { x: pos.x, z: pos.z };
    this.pending.length = 0;
  }

  snapshot(): Vec2 {
    return { x: this.predictedPos.x, z: this.predictedPos.z };
  }

  get pendingCount(): number {
    return this.pending.length;
  }
}
