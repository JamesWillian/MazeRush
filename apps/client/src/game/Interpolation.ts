import { INTERPOLATION_DELAY_MS } from '@mazerush/shared';

export interface PositionSample {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
}

interface TimedSample extends PositionSample {
  readonly t: number; // performance.now() when received
}

// Entity interpolation buffer. We render remote players ~100 ms in the past,
// between two server snapshots, so movement looks smooth even though state
// arrives in 50 ms chunks. The standard trick: time-shift the render clock
// so we always have a "future" snapshot to interpolate toward.
//
// Capped at a small history so memory stays bounded; older samples are
// dropped as new ones come in.
const MAX_BUFFER = 32;

export class RemoteInterpolator {
  private readonly buffer: TimedSample[] = [];

  pushSnapshot(sample: PositionSample, now: number = performance.now()): void {
    // Out-of-order delivery shouldn't happen on WebSocket (TCP ordered), but
    // we still guard against it — newer snapshots replace older ones at the
    // same timestamp.
    const last = this.buffer[this.buffer.length - 1];
    if (last && now <= last.t) {
      return;
    }
    this.buffer.push({ ...sample, t: now });
    if (this.buffer.length > MAX_BUFFER) {
      this.buffer.splice(0, this.buffer.length - MAX_BUFFER);
    }
  }

  sample(now: number): PositionSample | null {
    if (this.buffer.length === 0) return null;
    const targetT = now - INTERPOLATION_DELAY_MS;

    // Find the latest snapshot whose t <= targetT — call it `a`. Its
    // successor (if any) is `b`, which has t > targetT. We interpolate
    // between a and b.
    let i = this.buffer.length - 1;
    while (i > 0) {
      const candidate = this.buffer[i];
      if (candidate && candidate.t <= targetT) break;
      i--;
    }

    const a = this.buffer[i];
    if (!a) return null;
    const b = this.buffer[i + 1];

    // No future snapshot yet — freeze on the last known position.
    if (!b) return { x: a.x, z: a.z, yaw: a.yaw };

    const span = b.t - a.t;
    if (span <= 0) return { x: a.x, z: a.z, yaw: a.yaw };
    const alpha = Math.max(0, Math.min(1, (targetT - a.t) / span));

    return {
      x: a.x + (b.x - a.x) * alpha,
      z: a.z + (b.z - a.z) * alpha,
      yaw: lerpAngle(a.yaw, b.yaw, alpha),
    };
  }
}

// Lerp between two angles via the shortest arc, so a remote turning from
// -π to +π doesn't swing the whole circle backwards.
export function lerpAngle(a: number, b: number, t: number): number {
  const TAU = Math.PI * 2;
  let d = ((b - a) % TAU + TAU) % TAU;
  if (d > Math.PI) d -= TAU;
  return a + d * t;
}
