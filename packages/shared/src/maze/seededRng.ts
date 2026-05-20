// Mulberry32: 32-bit PRNG with very small state. Same seed → same stream on
// any machine. We deliberately avoid Math.random() because client and server
// must agree on the maze for predicted local rendering to match the server's
// authoritative state.

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a 32-bit. Cheap, deterministic, and good enough to expand a short
// human-readable seed (room code, nickname) into a 32-bit RNG seed.
export function hashStringToSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Integer in [0, max). Uses the RNG once per call; not cryptographically
// uniform, but plenty good for maze carving and pickup randomization.
export function randInt(rng: Rng, max: number): number {
  return Math.floor(rng() * max);
}
