// Client-only tunables. Anything that must agree with the server lives in
// `@mazerush/shared/constants` instead — settings here are local to the
// rendering / input layer.

export const MOUSE_SENSITIVITY = 0.002;
export const PITCH_LIMIT = Math.PI / 2 - 0.01;

export const WALL_HEIGHT = 2.5;
export const FOG_NEAR = 6;
export const FOG_FAR = 26;

export const CAMERA_FOV = 75;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 200;

// Local seed used while the standalone client has no server. Step 5 replaces
// it with the seed broadcast by the room.
export const STANDALONE_SEED = 0xc0ffee;

// Server endpoint. Override at build time with `VITE_SERVER_URL=...`.
const ENV_URL = import.meta.env.VITE_SERVER_URL;
export const SERVER_URL: string =
  typeof ENV_URL === 'string' && ENV_URL.length > 0 ? ENV_URL : 'ws://localhost:2567';
