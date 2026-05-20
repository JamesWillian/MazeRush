import type { Room } from 'colyseus.js';

import {
  CELL_SIZE,
  generateMaze,
  gridToWorldX,
  gridToWorldZ,
  PHASE_ENDED,
  PHASE_PLAYING,
  PLAYER_HEIGHT,
} from '@mazerush/shared';

import { SERVER_URL } from './config.js';
import { Controls } from './game/Controls.js';
import { Exit } from './game/Exit.js';
import { Flag } from './game/Flag.js';
import { LocalPlayer } from './game/LocalPlayer.js';
import { buildMazeMesh } from './game/MazeMesh.js';
import { Renderer } from './game/Renderer.js';
import { RemotePlayer } from './game/RemotePlayer.js';
import { ColyseusClient } from './net/ColyseusClient.js';
import { syncRoomState } from './net/stateSync.js';
import type { GameStateView } from './net/stateTypes.js';
import { EndScreen } from './ui/EndScreen.js';
import { HUD } from './ui/HUD.js';
import { Lobby } from './ui/Lobby.js';

async function boot(): Promise<void> {
  const appEl = document.getElementById('app');
  const lobbyEl = document.getElementById('lobby');
  const prelockEl = document.getElementById('prelock');
  const endscreenEl = document.getElementById('endscreen');
  const hudEl = document.getElementById('hud');
  const playBtn = document.getElementById('play');
  const statusEl = document.getElementById('status');
  if (!appEl || !lobbyEl || !prelockEl || !endscreenEl || !hudEl || !playBtn) {
    throw new Error('client boot: required DOM nodes missing');
  }

  // 1. Lobby first. Resolves when the player has either created or joined
  //    a room and we have an open Room handle.
  const net = new ColyseusClient();
  const lobby = new Lobby(lobbyEl, net);
  const { room, code } = await lobby.run();
  lobby.hide();
  setStatus(statusEl, '');

  // 2. Wait for the first state patch so seed/width/height are real numbers,
  //    not the schema's defaults.
  await waitForInitialState(room);
  const state = room.state as unknown as GameStateView;
  const maze = generateMaze({ width: state.width, height: state.height, seed: state.seed });

  // 3. Three.js scene: maze + flag + exits.
  const renderer = new Renderer(appEl);
  renderer.scene.add(buildMazeMesh(maze));

  const flag = new Flag();
  renderer.scene.add(flag.object);

  state.exits.forEach((e) => {
    const x = gridToWorldX(e.gx, maze.width, CELL_SIZE);
    const z = gridToWorldZ(e.gy, maze.height, CELL_SIZE);
    renderer.scene.add(new Exit(x, z).object);
  });

  // 4. Local player. Spawn from the server's initial state (already arrived
  //    above), with a fallback for the rare case where our own entry shows
  //    up via a later patch.
  const myInitial = state.players.get(room.sessionId);
  const spawn = myInitial
    ? { x: myInitial.x, z: myInitial.z }
    : { x: gridToWorldX(1, maze.width, CELL_SIZE), z: gridToWorldZ(1, maze.height, CELL_SIZE) };
  const localPlayer = new LocalPlayer(maze, spawn);
  renderer.camera.position.set(spawn.x, PLAYER_HEIGHT, spawn.z);
  renderer.camera.rotation.y = Math.PI;

  const remotePlayers = new Map<string, RemotePlayer>();

  syncRoomState(room, {
    onPlayerAdd: (sessionId, view) => {
      if (sessionId === room.sessionId) {
        localPlayer.forceTo({ x: view.x, z: view.z });
        return;
      }
      const rp = new RemotePlayer(view);
      remotePlayers.set(sessionId, rp);
      renderer.scene.add(rp.object);
    },
    onPlayerChange: (sessionId, view) => {
      if (sessionId === room.sessionId) {
        localPlayer.applyServerSnapshot({ x: view.x, z: view.z }, view.lastSeq);
        return;
      }
      remotePlayers.get(sessionId)?.pushSnapshot(
        { x: view.x, z: view.z, yaw: view.yaw },
        performance.now(),
      );
    },
    onPlayerRemove: (sessionId) => {
      const rp = remotePlayers.get(sessionId);
      if (!rp) return;
      renderer.scene.remove(rp.object);
      rp.dispose();
      remotePlayers.delete(sessionId);
    },
  });

  // 5. HUD (status line + minimap + player list).
  const hud = new HUD(hudEl, maze);
  hud.show();

  // 6. Pre-lock overlay ("Click to play"). Controls request pointer lock.
  prelockEl.style.display = 'flex';
  const controls = new Controls(renderer.domElement);
  controls.onLockChange((locked) => {
    prelockEl.style.display = locked ? 'none' : 'flex';
  });
  playBtn.addEventListener('click', () => controls.requestLock());

  // 7. End screen — shown once when the server transitions to PHASE_ENDED.
  const endScreen = new EndScreen(endscreenEl);
  let endShown = false;

  // 8. Shared scratch object for HUD's remote-positions input. Avoids
  //    allocating a fresh Map each frame.
  const remoteSnaps = new Map<string, { x: number; z: number; name: string }>();

  let lastFrameAt = performance.now();
  const tick = (now: number): void => {
    const deltaMs = now - lastFrameAt;
    lastFrameAt = now;

    if (controls.isLocked && state.phase === PHASE_PLAYING) {
      const snap = controls.snapshot();
      const payload = localPlayer.consumeInput(snap, deltaMs);
      room.send('input', payload);
      localPlayer.applyToCamera(renderer.camera, snap);
    } else if (controls.isLocked) {
      const snap = controls.snapshot();
      renderer.camera.rotation.y = snap.yaw;
      renderer.camera.rotation.x = snap.pitch;
    }

    placeFlag(flag, state, room.sessionId, localPlayer, remotePlayers);

    for (const rp of remotePlayers.values()) {
      rp.update(now);
    }

    // Build the remote snapshot map for the HUD's minimap.
    remoteSnaps.clear();
    remotePlayers.forEach((rp, sid) => {
      const obj = rp.object;
      const name = state.players.get(sid)?.name ?? '?';
      remoteSnaps.set(sid, { x: obj.position.x, z: obj.position.z, name });
    });

    hud.update({
      state,
      mySessionId: room.sessionId,
      selfPos: localPlayer.pos,
      selfYaw: controls.isLocked ? controls.snapshot().yaw : Math.PI,
      remotes: remoteSnaps,
      roomCode: code,
    });

    if (!endShown && state.phase === PHASE_ENDED) {
      endShown = true;
      // Release the pointer so the user can click the Play Again button.
      controls.releaseLock();
      endScreen.show({
        winnerName: state.players.get(state.winnerId)?.name ?? 'someone',
        won: state.winnerId === room.sessionId,
        roomCode: code,
      });
    }

    renderer.render();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  bindDisconnect(room, statusEl);
}

function placeFlag(
  flag: Flag,
  state: GameStateView,
  mySessionId: string,
  localPlayer: LocalPlayer,
  remotePlayers: Map<string, RemotePlayer>,
): void {
  const carrierId = state.flag.carriedBy;
  if (!carrierId) {
    flag.setGroundPosition(state.flag.x, state.flag.z);
    return;
  }
  if (carrierId === mySessionId) {
    const p = localPlayer.pos;
    flag.setCarriedPosition(p.x, p.z);
    return;
  }
  const rp = remotePlayers.get(carrierId);
  if (rp) {
    const obj = rp.object;
    flag.setCarriedPosition(obj.position.x, obj.position.z);
  } else {
    flag.setGroundPosition(state.flag.x, state.flag.z);
  }
}

function setStatus(el: HTMLElement | null, text: string): void {
  if (!el) return;
  el.textContent = text;
}

function bindDisconnect(room: Room, statusEl: HTMLElement | null): void {
  room.onLeave((closeCode) => {
    setStatus(statusEl, `Disconnected (code ${closeCode}). Reload to rejoin.`);
  });
  room.onError((errCode, message) => {
    setStatus(statusEl, `Error ${errCode}: ${message ?? 'unknown'}`);
  });
}

boot().catch((err: unknown) => {
  const statusEl = document.getElementById('status');
  setStatus(statusEl, `Boot failed: ${formatBootError(err)}`);
  console.error('boot failed', err);
});

function waitForInitialState(room: Room, timeoutMs = 5000): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const ready = (): boolean => {
      const s = room.state as unknown as Partial<GameStateView> | undefined;
      return typeof s?.width === 'number' && s.width > 0;
    };
    if (ready()) {
      resolve();
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`initial room state never arrived (waited ${timeoutMs}ms)`));
    }, timeoutMs);
    room.onStateChange(() => {
      if (settled || !ready()) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    });
  });
}

function formatBootError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof Event !== 'undefined' && err instanceof Event) {
    return `cannot reach server (${err.type}). Is the server running at ${SERVER_URL}? Check the terminal where pnpm dev is running for @mazerush/server logs.`;
  }
  return String(err);
}
