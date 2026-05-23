// Single source of truth for tuning numbers used by both client and server.
// Changing a value here must take effect on every machine running the game,
// which is exactly why this lives in `shared`.

export const TICK_RATE = 20;
export const TICK_INTERVAL_MS = 1000 / TICK_RATE;

export const MAX_SPEED = 5.0;
export const SPRINT_MULTIPLIER = 1.6;

// Anti-cheat tolerance: server rejects any move whose effective speed exceeds
// MAX_SPEED * SPEED_TOLERANCE. 10% covers floating point + jitter.
export const SPEED_TOLERANCE = 1.1;

// Cap deltaMs on client inputs to prevent "lag exploit" warp moves.
export const MAX_INPUT_DELTA_MS = 50;

export const PLAYER_RADIUS = 0.3;
export const PLAYER_HEIGHT = 1.7;
export const CELL_SIZE = 2.0;

// Maze dimensions must be ODD so that the recursive backtracker can place
// cells at odd coordinates with walls between them.
export const MAZE_WIDTH = 21;
export const MAZE_HEIGHT = 21;

export const MAX_PLAYERS_PER_ROOM = 8;
export const MIN_PLAYERS_PER_ROOM = 2;

export const FLAG_PICKUP_RADIUS = 1.0;
// Player wins when their center is within this distance of the door cell
// center. 1.5u is calibrated so the player has to actually press up
// against the perimeter wall (~1.3u away at the wall contact) — no
// "drive-by" wins from the middle of the adjacent inner cell.
export const EXIT_REACH_RADIUS = 1.5;

// Tag-to-drop mechanic: a player can knock the flag off the carrier by
// left-clicking when close to and facing them. Server-authoritative —
// client just sends a 'tag' message, server checks geometry + cooldown.
export const TAG_REACH_RADIUS = 2.0;
// cos(90°) = 0 — carrier just has to be in the front hemisphere. Very
// forgiving; only "stabs in the back" don't count. Raise toward 0.5 if
// players start drive-by tagging at weird angles.
export const TAG_FRONT_CONE_COS = 0.0;
export const TAG_COOLDOWN_MS = 500;
// How far from the carrier the flag falls when knocked off — placed
// roughly between attacker and carrier so the carrier can't immediately
// re-pick it up but the attacker can.
export const FLAG_DROP_OFFSET = FLAG_PICKUP_RADIUS * 1.5;

// Default player avatar color used by anyone who hasn't picked one yet.
// `#4f7cff` mirrors the UI accent — recognizable as "default player".
export const DEFAULT_PLAYER_COLOR = '#4f7cff';
export const DEFAULT_WALL_COLOR = '#7b6c52';

export const INTERPOLATION_DELAY_MS = 100;

// Game flow timings.
export const COUNTDOWN_MS = 3000;
export const END_SCREEN_MS = 5000;
export const EXIT_COUNT = 2;

// Game phases (string union). Strings instead of enum because @colyseus/schema
// doesn't ship enum support and these go on the wire.
export const PHASE_LOBBY = 'lobby';
export const PHASE_COUNTDOWN = 'countdown';
export const PHASE_PLAYING = 'playing';
export const PHASE_ENDED = 'ended';
export type GamePhase =
  | typeof PHASE_LOBBY
  | typeof PHASE_COUNTDOWN
  | typeof PHASE_PLAYING
  | typeof PHASE_ENDED;

export const MODE_CAPTURE = 'capture';
export const MODE_ESCAPE = 'escape';
export type GameMode = typeof MODE_CAPTURE | typeof MODE_ESCAPE;

// Room code: 6 chars from base32 alphabet (no 0/1/O/I) → ~30 bits entropy.
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
