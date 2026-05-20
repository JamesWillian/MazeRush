import { getStateCallbacks, type Room } from 'colyseus.js';

import type { GameStateView, PlayerStateNet, PlayerStateView } from './stateTypes.js';

export interface StateSyncCallbacks {
  onPlayerAdd: (sessionId: string, view: PlayerStateView) => void;
  onPlayerRemove: (sessionId: string) => void;
  onPlayerChange: (sessionId: string, view: PlayerStateView) => void;
}

// Bridges Colyseus's reactive Schema state to a callback-shaped API the
// renderer can consume. Uses the @colyseus/schema 3.x callbacks proxy
// (`getStateCallbacks`) — in 3.x, schema instances no longer expose
// .onChange / .onAdd directly; you go through `$()` instead. The proxy
// replays existing collection entries on registration, so we don't need a
// separate forEach pass for players who joined before us.
export function syncRoomState(room: Room, callbacks: StateSyncCallbacks): void {
  const $ = getStateCallbacks(room);
  const state = room.state as unknown as GameStateView;

  // `$(state).players.onAdd(cb)` fires once per existing entry plus once
  // per future onJoin.
  $(state).players.onAdd((player: PlayerStateNet, sessionId: string) => {
    callbacks.onPlayerAdd(sessionId, viewOf(player));
    $(player).onChange(() => {
      callbacks.onPlayerChange(sessionId, viewOf(player));
    });
  });

  $(state).players.onRemove((_player: PlayerStateNet, sessionId: string) => {
    callbacks.onPlayerRemove(sessionId);
  });
}

function viewOf(p: PlayerStateNet): PlayerStateView {
  return {
    id: p.id,
    name: p.name,
    x: p.x,
    z: p.z,
    yaw: p.yaw,
    connected: p.connected,
    lastSeq: p.lastSeq,
  };
}
