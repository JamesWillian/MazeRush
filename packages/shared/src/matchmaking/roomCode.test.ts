import { describe, expect, it } from 'vitest';

import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../constants.js';

import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from './roomCode.js';

describe('generateRoomCode', () => {
  it('returns a string of the configured length', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateRoomCode()).toHaveLength(ROOM_CODE_LENGTH);
    }
  });

  it('uses only alphabet characters (no 0/1/O/I/L)', () => {
    const allowed = new Set(ROOM_CODE_ALPHABET);
    for (let i = 0; i < 100; i++) {
      for (const ch of generateRoomCode()) {
        expect(allowed.has(ch)).toBe(true);
      }
    }
  });

  it('produces unique codes (probabilistic — at ~30 bits, 1000 draws never collide)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateRoomCode());
    expect(seen.size).toBe(1000);
  });
});

describe('isValidRoomCode', () => {
  it('accepts strings of the right length and alphabet', () => {
    expect(isValidRoomCode('ABCDEF')).toBe(true);
    expect(isValidRoomCode('234567')).toBe(true);
  });

  it('rejects non-string input', () => {
    expect(isValidRoomCode(undefined)).toBe(false);
    expect(isValidRoomCode(null)).toBe(false);
    expect(isValidRoomCode(123456)).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(isValidRoomCode('')).toBe(false);
    expect(isValidRoomCode('ABCDE')).toBe(false);
    expect(isValidRoomCode('ABCDEFG')).toBe(false);
  });

  it('rejects forbidden chars (0/1/O/I and lowercase)', () => {
    expect(isValidRoomCode('ABCDE0')).toBe(false);
    expect(isValidRoomCode('ABCDE1')).toBe(false);
    expect(isValidRoomCode('ABCDEO')).toBe(false);
    expect(isValidRoomCode('ABCDEI')).toBe(false);
    expect(isValidRoomCode('abcdef')).toBe(false);
    expect(isValidRoomCode('ABCDE!')).toBe(false);
  });
});

describe('normalizeRoomCode', () => {
  it('uppercases and strips spaces', () => {
    expect(normalizeRoomCode(' abc def ')).toBe('ABCDEF');
  });

  it('leaves a valid code unchanged', () => {
    expect(normalizeRoomCode('ABCDEF')).toBe('ABCDEF');
  });
});
