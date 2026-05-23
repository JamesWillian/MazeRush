// Client → server input message. The client sends inputs, not positions —
// the server is authoritative for movement. `seq` is a monotonically
// increasing sequence number used for client-side prediction reconciliation
// (server echoes the last processed seq with the state snapshot).
export type InputMessage = {
  readonly seq: number;
  // Unit-ish vector in player-local space. Server re-normalizes and clamps
  // magnitude to 1, so a cheating client can't move faster by sending (2, 2).
  readonly moveX: number;
  readonly moveZ: number;
  readonly yaw: number;
  readonly sprint: boolean;
  // Time since the previous input the client emitted. Server caps this at
  // MAX_INPUT_DELTA_MS to prevent lag-exploit teleporting.
  readonly deltaMs: number;
};

// Wire-level message names. Pickup and exit are server-detected on tick
// (see GameRules), so the client doesn't have to claim those — that closes
// the "client lies about being close" vector. `tag` is the one explicit
// action: the player has to actually press something, so the click goes
// up here and the server validates geometry.
export const MessageType = {
  Input: 'input',
  Tag: 'tag',
} as const;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

// Tag carries no payload — server already knows who sent it (sessionId)
// and decides everything else from authoritative state.
export type TagMessage = Record<string, never>;
