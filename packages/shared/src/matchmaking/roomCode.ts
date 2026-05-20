import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../constants.js';

// Cryptographically random room code. 6 chars from a 32-char alphabet
// (no 0/1/O/I) → ~30 bits of entropy per code, unguessable in practice.
//
// Lives in `shared` because the client generates the code locally before
// asking the server to create a room. Web Crypto's `getRandomValues` works
// in browsers AND Node ≥ 20, so the same function runs on both sides.

const ALPHABET_SIZE = ROOM_CODE_ALPHABET.length;
const REJECT_THRESHOLD = 256 - (256 % ALPHABET_SIZE);

function getRandomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  const g = globalThis as {
    crypto?: { getRandomValues?<T extends ArrayBufferView>(array: T): T };
  };
  if (!g.crypto?.getRandomValues) {
    throw new Error('Web Crypto API (crypto.getRandomValues) is not available');
  }
  g.crypto.getRandomValues(out);
  return out;
}

export function generateRoomCode(): string {
  const out: string[] = [];
  while (out.length < ROOM_CODE_LENGTH) {
    // Pull more than we strictly need; on average ~1 in 32 bytes is
    // rejected, so this almost always finishes in a single iteration.
    const buf = getRandomBytes(ROOM_CODE_LENGTH * 2);
    for (let i = 0; i < buf.length && out.length < ROOM_CODE_LENGTH; i++) {
      const b = buf[i];
      if (b === undefined || b >= REJECT_THRESHOLD) continue;
      const ch = ROOM_CODE_ALPHABET[b % ALPHABET_SIZE];
      if (ch !== undefined) out.push(ch);
    }
  }
  return out.join('');
}

// Validator usable as a type guard. Used by:
//   - the lobby UI to disable the Join button until input is valid,
//   - the server's MazeRoom.onCreate to reject malformed creation requests.
export function isValidRoomCode(code: unknown): code is string {
  if (typeof code !== 'string' || code.length !== ROOM_CODE_LENGTH) return false;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (ch === undefined || !ROOM_CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}

// Normalize user-typed input before validation (uppercase, strip spaces).
// Tolerates the common typo of typing `0`/`O`/`1`/`I` — caller still has
// to pass through `isValidRoomCode`, which will reject if normalization
// didn't produce a valid string.
export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}
