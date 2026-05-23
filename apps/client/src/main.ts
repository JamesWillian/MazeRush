import type { Room } from 'colyseus.js';

import {
  CELL_SIZE,
  DEFAULT_PLAYER_COLOR,
  DEFAULT_WALL_COLOR,
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
import { buildMazeMesh, type BuiltMaze } from './game/MazeMesh.js';
import { Renderer } from './game/Renderer.js';
import { RemotePlayer } from './game/RemotePlayer.js';
import { ColyseusClient } from './net/ColyseusClient.js';
import { syncRoomState } from './net/stateSync.js';
import type { GameStateView } from './net/stateTypes.js';
import {
  loadPlayerColor,
  loadWallColor,
  savePlayerColor,
  saveWallColor,
} from './ui/colorStore.js';
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
  const wallColorInput = document.getElementById('color-walls');
  const playerColorInput = document.getElementById('color-player');
  if (
    !appEl ||
    !lobbyEl ||
    !prelockEl ||
    !endscreenEl ||
    !hudEl ||
    !playBtn ||
    !(wallColorInput instanceof HTMLInputElement) ||
    !(playerColorInput instanceof HTMLInputElement)
  ) {
    throw new Error('client boot: required DOM nodes missing');
  }

  // Restore saved colors BEFORE the lobby so the avatar color used at join
  // matches what the player picked last session.
  const savedWall = loadWallColor() ?? DEFAULT_WALL_COLOR;
  const savedPlayer = loadPlayerColor() ?? DEFAULT_PLAYER_COLOR;
  wallColorInput.value = savedWall;
  playerColorInput.value = savedPlayer;

  setStatus(statusEl, 'Connecting to server…');

  const net = new ColyseusClient();
  const lobby = new Lobby(lobbyEl, net);
  const { room, code } = await lobby.run();
  lobby.hide();
  setStatus(statusEl, '');

  await waitForInitialState(room);
  const state = room.state as unknown as GameStateView;
  const maze = generateMaze({ width: state.width, height: state.height, seed: state.seed });

  const renderer = new Renderer(appEl);

  // Door cells (perimeter walls that should be skipped so the Exit visual
  // takes their place). Indexed by flat tile position for O(1) lookup
  // inside the wall builder loop.
  const doorCellIndices = new Set<number>();
  state.exits.forEach((e) => {
    doorCellIndices.add(e.doorY * maze.width + e.doorX);
  });

  const builtMaze: BuiltMaze = buildMazeMesh(maze, doorCellIndices);
  renderer.scene.add(builtMaze.group);
  builtMaze.setWallColor(hexFromColor(savedWall));

  // Doors fill the gaps in the perimeter wall where MazeMesh skipped.
  state.exits.forEach((e) => {
    renderer.scene.add(new Exit(e.doorX, e.doorY, maze.width, maze.height).object);
  });

  const flag = new Flag();
  renderer.scene.add(flag.object);

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
      const rp = remotePlayers.get(sessionId);
      if (!rp) return;
      rp.pushSnapshot({ x: view.x, z: view.z, yaw: view.yaw }, performance.now());
      rp.setColor(view.color);
    },
    onPlayerRemove: (sessionId) => {
      const rp = remotePlayers.get(sessionId);
      if (!rp) return;
      renderer.scene.remove(rp.object);
      rp.dispose();
      remotePlayers.delete(sessionId);
    },
  });

  const controls = new Controls(renderer.domElement);
  controls.onLockChange((locked) => {
    prelockEl.style.display = locked ? 'none' : 'flex';
  });
  playBtn.addEventListener('click', () => controls.requestLock());

  // Color pickers. `input` fires on every drag tick — Three.js handles
  // wall recolor in O(1) (just material.color.set), and 'setColor'
  // messages are tiny. Throttling isn't worth the complexity here.
  wallColorInput.addEventListener('input', () => {
    const value = wallColorInput.value;
    saveWallColor(value);
    builtMaze.setWallColor(hexFromColor(value));
  });
  playerColorInput.addEventListener('input', () => {
    const value = playerColorInput.value;
    savePlayerColor(value);
    room.send('setColor', { color: value });
  });

  controls.onAction(() => {
    if (state.phase !== PHASE_PLAYING) return;
    room.send('tag', {});
  });

  setStatus(statusEl, `Connected as ${room.sessionId.slice(0, 8)}`);

  const endScreen = new EndScreen(endscreenEl);
  let endShown = false;

  const hud = new HUD(hudEl, maze);
  hud.show();

  // Reusable scratch for the HUD's remote-positions input.
  const remoteSnaps = new Map<
    string,
    { x: number; z: number; yaw: number; name: string; color: string }
  >();

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

    remoteSnaps.clear();
    remotePlayers.forEach((rp, sid) => {
      const obj = rp.object;
      const peer = state.players.get(sid);
      remoteSnaps.set(sid, {
        x: obj.position.x,
        z: obj.position.z,
        yaw: obj.rotation.y,
        name: peer?.name ?? '?',
        color: peer?.color ?? DEFAULT_PLAYER_COLOR,
      });
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

// '#rrggbb' → integer, with a hardened fallback. Inputs that fail here
// would already have been rejected by colorStore on write, but defending
// the runtime cast against a stale localStorage value is cheap.
function hexFromColor(s: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) return 0x4f7cff;
  return parseInt(s.slice(1), 16);
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
