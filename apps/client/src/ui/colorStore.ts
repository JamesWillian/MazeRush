// Tiny localStorage wrapper for the two persisted preferences: avatar
// color and wall color. Validates on the way in AND out so a tampered
// localStorage value can't bypass server-side sanitization (server still
// re-validates, this is just defense in depth + better UX).

const PLAYER_KEY = 'mr-color-player';
const WALL_KEY = 'mr-color-wall';
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function readValid(key: string): string | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw && COLOR_RE.test(raw)) return raw.toLowerCase();
    return null;
  } catch {
    // SSR / privacy mode / disabled storage — ignore.
    return null;
  }
}

function writeValid(key: string, value: string): void {
  if (!COLOR_RE.test(value)) return;
  try {
    localStorage.setItem(key, value.toLowerCase());
  } catch {
    // ignore — picker still works in-session
  }
}

export function loadPlayerColor(): string | null {
  return readValid(PLAYER_KEY);
}

export function savePlayerColor(color: string): void {
  writeValid(PLAYER_KEY, color);
}

export function loadWallColor(): string | null {
  return readValid(WALL_KEY);
}

export function saveWallColor(color: string): void {
  writeValid(WALL_KEY, color);
}

// Generates a vivid avatar color from a random HSL hue. Fixed saturation
// and lightness keep contrast readable against the dark fog without
// looking neon. Used by main.ts the FIRST time a browser opens the app,
// then persisted via savePlayerColor so subsequent sessions keep it.
export function randomPlayerColor(): string {
  const hue = Math.floor(Math.random() * 360);
  return hslToHex(hue, 65, 60);
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const toHex = (v: number): string =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
