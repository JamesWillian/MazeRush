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

// Action messages are rare events (pickup, reach exit). Listed here for
// completeness — wired up in Step 8.
export type ActionMessage =
  | { readonly type: 'pickupFlag' }
  | { readonly type: 'reachExit' };

export const MessageType = {
  Input: 'input',
  Action: 'action',
} as const;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];
