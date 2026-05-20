import { describe, expect, it } from 'vitest';

import { hashStringToSeed, mulberry32, randInt } from './seededRng.js';

describe('mulberry32', () => {
  it('returns numbers in [0, 1)', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it('produces different streams for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    // Probability of collision over 50 draws is astronomically low.
    let differed = false;
    for (let i = 0; i < 50; i++) {
      if (a() !== b()) {
        differed = true;
        break;
      }
    }
    expect(differed).toBe(true);
  });

  it('survives the round-trip through unsigned 32-bit math', () => {
    // Negative seeds get folded into uint32; same value should result.
    const a = mulberry32(-1);
    const b = mulberry32(0xffffffff);
    for (let i = 0; i < 10; i++) {
      expect(a()).toBe(b());
    }
  });
});

describe('hashStringToSeed', () => {
  it('is deterministic', () => {
    expect(hashStringToSeed('hello')).toBe(hashStringToSeed('hello'));
  });

  it('distinguishes similar strings', () => {
    expect(hashStringToSeed('ABCDEF')).not.toBe(hashStringToSeed('ABCDEG'));
  });

  it('returns an unsigned 32-bit integer', () => {
    const h = hashStringToSeed('any-room-code');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });
});

describe('randInt', () => {
  it('returns values in [0, max)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = randInt(rng, 10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});
