import {
  CELL_SIZE,
  MODE_CAPTURE,
  PHASE_COUNTDOWN,
  PHASE_ENDED,
  PHASE_LOBBY,
  PHASE_PLAYING,
  Tile,
  type MazeGrid,
  type Vec2,
} from '@mazerush/shared';

import type { GameStateView } from '../net/stateTypes.js';

const MINIMAP_SIZE_PX = 220;

export interface HudUpdate {
  readonly state: GameStateView;
  readonly mySessionId: string;
  readonly selfPos: Vec2;
  readonly selfYaw: number;
  readonly remotes: Map<
    string,
    { x: number; z: number; yaw: number; name: string; color: string }
  >;
  readonly roomCode: string;
}

// HUD owns:
//   - the top-center status line (phase, objective, flag holder)
//   - the top-right minimap (canvas-based, redrawn each frame)
//   - the top-left players list (DOM, refreshed on update)
//   - the room code chip (shown so the host can read it off)
//
// Lifetime: constructed once after the maze is known, lives for the room.
export class HUD {
  private readonly topEl: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly roomCodeEl: HTMLElement;
  private readonly playersEl: HTMLElement;
  private readonly minimapCanvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly cellPx: number;

  constructor(rootEl: HTMLElement, private readonly maze: MazeGrid) {
    rootEl.innerHTML = `
      <div class="hud-top" id="hud-top">
        <div class="hud-status" id="hud-status"></div>
        <div class="hud-room" id="hud-room"></div>
      </div>
      <div class="hud-players" id="hud-players"></div>
      <canvas id="hud-minimap" width="${MINIMAP_SIZE_PX}" height="${MINIMAP_SIZE_PX}"></canvas>
    `;
    this.topEl = HUD.must(rootEl, '#hud-top');
    this.statusEl = HUD.must(rootEl, '#hud-status');
    this.roomCodeEl = HUD.must(rootEl, '#hud-room');
    this.playersEl = HUD.must(rootEl, '#hud-players');
    this.minimapCanvas = HUD.must<HTMLCanvasElement>(rootEl, '#hud-minimap');

    const ctx = this.minimapCanvas.getContext('2d');
    if (!ctx) throw new Error('HUD: failed to get 2D context for minimap');
    this.ctx = ctx;
    this.cellPx = MINIMAP_SIZE_PX / Math.max(maze.width, maze.height);
  }

  show(): void {
    this.topEl.style.display = '';
    this.playersEl.style.display = '';
    this.minimapCanvas.style.display = '';
  }

  hide(): void {
    this.topEl.style.display = 'none';
    this.playersEl.style.display = 'none';
    this.minimapCanvas.style.display = 'none';
  }

  update(u: HudUpdate): void {
    this.renderStatus(u);
    this.renderRoomCode(u.roomCode);
    this.renderPlayers(u);
    this.renderMinimap(u);
  }

  private renderStatus(u: HudUpdate): void {
    const { state, mySessionId } = u;
    switch (state.phase) {
      case PHASE_LOBBY:
        this.statusEl.textContent = `Waiting for players (${state.players.size}/2)…`;
        return;
      case PHASE_COUNTDOWN: {
        const sec = Math.max(0, Math.ceil((state.countdownEndsAt - Date.now()) / 1000));
        this.statusEl.textContent = `Starting in ${sec}…`;
        return;
      }
      case PHASE_PLAYING: {
        const carrier = state.flag.carriedBy;
        const goal =
          state.mode === MODE_CAPTURE
            ? 'Grab the flag at the center, then reach a green exit pad.'
            : 'Find a green exit pad.';
        if (carrier === '') {
          this.statusEl.textContent = goal;
        } else if (carrier === mySessionId) {
          this.statusEl.textContent = 'You have the flag — escape!';
        } else {
          const name = state.players.get(carrier)?.name ?? '?';
          this.statusEl.textContent = `${name} has the flag.`;
        }
        return;
      }
      case PHASE_ENDED: {
        const won = state.winnerId === mySessionId;
        const winnerName = state.players.get(state.winnerId)?.name ?? 'someone';
        this.statusEl.textContent = won ? 'You won 🏆' : `${winnerName} won.`;
        return;
      }
      default:
        this.statusEl.textContent = '';
    }
  }

  private renderRoomCode(code: string): void {
    this.roomCodeEl.textContent = code ? `Room: ${code}` : '';
  }

  private renderPlayers(u: HudUpdate): void {
    // Build a small list with each player's name + tag (you / flag carrier).
    const rows: string[] = [];
    u.state.players.forEach((p, sid) => {
      const isMe = sid === u.mySessionId;
      const hasFlag = u.state.flag.carriedBy === sid;
      const tag = hasFlag ? ' 🚩' : '';
      const youMark = isMe ? ' (you)' : '';
      const dotColor = p.color || colorForName(p.name);
      rows.push(
        `<li><span class="dot" style="background:${dotColor}"></span>${escapeHtml(p.name)}${youMark}${tag}</li>`,
      );
    });
    this.playersEl.innerHTML = `<ul>${rows.join('')}</ul>`;
  }

  private renderMinimap(u: HudUpdate): void {
    const { state, maze, ctx, cellPx } = { ...u, maze: this.maze, ctx: this.ctx, cellPx: this.cellPx };
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, MINIMAP_SIZE_PX, MINIMAP_SIZE_PX);

    // Walls
    ctx.fillStyle = '#3b3220';
    for (let y = 0; y < maze.height; y++) {
      for (let x = 0; x < maze.width; x++) {
        if (maze.tiles[y * maze.width + x] === Tile.Wall) {
          ctx.fillRect(x * cellPx, y * cellPx, cellPx, cellPx);
        }
      }
    }

    // Exits
    ctx.fillStyle = '#4ade80';
    state.exits.forEach((e) => {
      ctx.beginPath();
      ctx.arc((e.gx + 0.5) * cellPx, (e.gy + 0.5) * cellPx, cellPx * 0.6, 0, Math.PI * 2);
      ctx.fill();
    });

    // Flag (only show on ground; while carried, it's already implied by the carrier's color + 🚩 in the list)
    if (state.flag.carriedBy === '') {
      const fp = this.worldToPx(state.flag.x, state.flag.z);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(fp.px, fp.py, cellPx * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }

    // Remote players — arrows pointing the way they're facing, same
    // shape as self so everyone reads the minimap the same way.
    u.remotes.forEach(({ x, z, yaw, name, color }) => {
      this.drawPlayerArrow(x, z, yaw, color || colorForName(name));
    });

    // Self — drawn last so it sits on top of any remote standing on us.
    const me = state.players.get(u.mySessionId);
    if (me) {
      this.drawPlayerArrow(u.selfPos.x, u.selfPos.z, u.selfYaw, me.color || colorForName(me.name));
    }
  }

  private drawPlayerArrow(x: number, z: number, yaw: number, color: string): void {
    const { px, py } = this.worldToPx(x, z);
    const size = this.cellPx * 0.85;
    // Forward direction in screen px: yaw=0 looks -Z (up on minimap with +Z = down).
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const tipX = px + fx * size;
    const tipY = py + fz * size;
    const leftX = px + (-fz - fx * 0.4) * (size * 0.5);
    const leftY = py + (fx - fz * 0.4) * (size * 0.5);
    const rightX = px + (fz - fx * 0.4) * (size * 0.5);
    const rightY = py + (-fx - fz * 0.4) * (size * 0.5);

    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#0a0a0c';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(tipX, tipY);
    this.ctx.lineTo(leftX, leftY);
    this.ctx.lineTo(rightX, rightY);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
  }

  private worldToPx(worldX: number, worldZ: number): { px: number; py: number } {
    const gx = worldX / CELL_SIZE + (this.maze.width - 1) / 2;
    const gy = worldZ / CELL_SIZE + (this.maze.height - 1) / 2;
    return { px: (gx + 0.5) * this.cellPx, py: (gy + 0.5) * this.cellPx };
  }

  private static must<T extends HTMLElement>(root: HTMLElement, sel: string): T {
    const el = root.querySelector<T>(sel);
    if (!el) throw new Error(`HUD: missing ${sel}`);
    return el;
  }
}

function colorForName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 65%, 60%)`;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c] ?? c,
  );
}
