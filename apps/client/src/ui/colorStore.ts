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
