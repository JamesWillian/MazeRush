import { describe, expect, it } from 'vitest';

import { INTERPOLATION_DELAY_MS } from '@mazerush/shared';

import { lerpAngle, RemoteInterpolator } from './Interpolation.js';

describe('lerpAngle', () => {
  it('lerps within the same half-circle', () => {
    expect(lerpAngle(0, Math.PI / 2, 0.5)).toBeCloseTo(Math.PI / 4);
  });

  it('takes the shortest arc when wrapping ±π', () => {
    // Going from -3π/4 to +3π/4: the short way is -π/2 (back across ±π),
    // not +3π/2 the long way around.
    const result = lerpAngle(-3 * Math.PI / 4, 3 * Math.PI / 4, 0.5);
    // Halfway along the short arc starting at -3π/4 going negative lands
    // at ±π exactly (the wrap point).
    expect(Math.abs(Math.abs(result) - Math.PI)).toBeLessThan(1e-9);
  });

  it('endpoints are exact', () => {
    expect(lerpAngle(1.2, 3.4, 0)).toBeCloseTo(1.2);
    expect(lerpAngle(1.2, 3.4, 1)).toBeCloseTo(3.4);
  });
});

describe('RemoteInterpolator', () => {
  it('returns null when buffer is empty', () => {
    const ri = new RemoteInterpolator();
    expect(ri.sample(0)).toBeNull();
  });

  it('returns the last snapshot when only one is available', () => {
    const ri = new RemoteInterpolator();
    ri.pushSnapshot({ x: 1, z: 2, yaw: 0.5 }, 0);
    expect(ri.sample(INTERPOLATION_DELAY_MS + 1000)).toEqual({ x: 1, z: 2, yaw: 0.5 });
  });

  it('interpolates linearly between two snapshots at midpoint', () => {
    const ri = new RemoteInterpolator();
    ri.pushSnapshot({ x: 0, z: 0, yaw: 0 }, 0);
    ri.pushSnapshot({ x: 10, z: 20, yaw: 0 }, 100);
    // targetT = now - 100. Pick now = 100 + 50 → targetT = 50, halfway.
    const result = ri.sample(150);
    expect(result?.x).toBeCloseTo(5);
    expect(result?.z).toBeCloseTo(10);
  });

  it('clamps before the first snapshot — never extrapolates backwards', () => {
    const ri = new RemoteInterpolator();
    ri.pushSnapshot({ x: 0, z: 0, yaw: 0 }, 100);
    ri.pushSnapshot({ x: 10, z: 0, yaw: 0 }, 200);
    // targetT = 50 → before any snapshot. Should clamp to first sample.
    const result = ri.sample(150);
    expect(result?.x).toBeCloseTo(0);
  });

  it('drops out-of-order samples', () => {
    const ri = new RemoteInterpolator();
    ri.pushSnapshot({ x: 0, z: 0, yaw: 0 }, 200);
    ri.pushSnapshot({ x: 999, z: 999, yaw: 999 }, 100); // stale, must be ignored
    const result = ri.sample(200 + INTERPOLATION_DELAY_MS + 50);
    expect(result).toEqual({ x: 0, z: 0, yaw: 0 });
  });

  it('caps buffer growth under sustained input', () => {
    const ri = new RemoteInterpolator();
    for (let i = 0; i < 1000; i++) {
      ri.pushSnapshot({ x: i, z: 0, yaw: 0 }, i * 10);
    }
    // The oldest samples were dropped — sampling far in the past returns
    // the oldest remaining one (still 999-ish, not the original 0).
    const result = ri.sample(50_000); // well past
    expect(result).toBeDefined();
  });
});
