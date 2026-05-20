import { describe, expect, it } from 'vitest';

import { parseInput } from './parseInput.js';

const VALID = {
  seq: 1,
  moveX: 0.5,
  moveZ: -0.5,
  yaw: 1.2,
  sprint: false,
  deltaMs: 16,
};

describe('parseInput', () => {
  it('accepts a well-formed payload', () => {
    expect(parseInput(VALID)).toEqual(VALID);
  });

  it('returns null for non-object input', () => {
    expect(parseInput(null)).toBeNull();
    expect(parseInput(undefined)).toBeNull();
    expect(parseInput(42)).toBeNull();
    expect(parseInput('hello')).toBeNull();
    expect(parseInput([])).toBeNull(); // array has no `seq` etc, fails field check
  });

  it('rejects payloads missing any required field', () => {
    for (const key of Object.keys(VALID)) {
      const partial: Record<string, unknown> = { ...VALID };
      delete partial[key];
      expect(parseInput(partial)).toBeNull();
    }
  });

  it('rejects NaN / Infinity in numeric fields', () => {
    expect(parseInput({ ...VALID, seq: NaN })).toBeNull();
    expect(parseInput({ ...VALID, moveX: Infinity })).toBeNull();
    expect(parseInput({ ...VALID, yaw: -Infinity })).toBeNull();
    expect(parseInput({ ...VALID, deltaMs: NaN })).toBeNull();
  });

  it('rejects negative seq and deltaMs', () => {
    expect(parseInput({ ...VALID, seq: -1 })).toBeNull();
    expect(parseInput({ ...VALID, deltaMs: -10 })).toBeNull();
  });

  it('rejects oversized move vector components (anti-cheat first line)', () => {
    expect(parseInput({ ...VALID, moveX: 5 })).toBeNull();
    expect(parseInput({ ...VALID, moveZ: -2 })).toBeNull();
  });

  it('rejects wrong-type sprint', () => {
    expect(parseInput({ ...VALID, sprint: 'yes' })).toBeNull();
    expect(parseInput({ ...VALID, sprint: 1 })).toBeNull();
  });

  it('allows boundary move values', () => {
    expect(parseInput({ ...VALID, moveX: 1, moveZ: -1 })).not.toBeNull();
    expect(parseInput({ ...VALID, deltaMs: 0 })).not.toBeNull();
  });
});
