// Client-side view of the server-defined GameState schema. We deliberately
// don't import the server's `PlayerState`/`GameState` classes here — that
// would couple the client to the server's @colyseus/schema decorators and
// blur the package boundary. Instead, this file mirrors the field shape and
// we cast `room.state` to it in exactly one place (stateSync.ts).
//
// In @colyseus/schema 3.x, the Schema instances don't expose .onChange /
// .onAdd directly — those are routed through `getStateCallbacks(room)` in
// stateSync.ts. So these interfaces describe only the FIELDS we read.

export interface PlayerStateView {
  id: string;
  name: string;
  x: number;
  z: number;
  yaw: number;
  connected: boolean;
  lastSeq: number;
}

// Alias for the raw schema instance (same fields, just naming clarity).
export type PlayerStateNet = PlayerStateView;

export interface FlagStateView {
  x: number;
  z: number;
  carriedBy: string;
}

export interface ExitPointView {
  gx: number;
  gy: number;
}

export interface ArraySchemaLike<T> {
  readonly length: number;
  forEach(cb: (item: T, index: number) => void): void;
}

export interface GameStateView {
  seed: number;
  width: number;
  height: number;
  // Typed as a Map for the few read sites that need it. Iteration in
  // stateSync.ts goes through the callbacks proxy, not this property.
  players: Map<string, PlayerStateNet>;
  flag: FlagStateView;
  phase: string;

  // Step 8 fields:
  mode: string;
  countdownEndsAt: number;
  endedAt: number;
  winnerId: string;
  exits: ArraySchemaLike<ExitPointView>;
}
