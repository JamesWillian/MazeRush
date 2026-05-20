import type { InputMessage } from '@mazerush/shared';

// Strict validator for incoming 'input' messages. The brief says malformed
// messages should disconnect the client; for Step 5 we just drop them and
// return null. Step 7 (anti-cheat) escalates repeated failures to a kick.
//
// `unknown` in / structured-or-null out: TypeScript narrows on the typeof
// checks below, so the returned object is fully typed without `any`.
export function parseInput(raw: unknown): InputMessage | null {
  if (raw === null || typeof raw !== 'object') return null;
  if (
    !('seq' in raw) ||
    !('moveX' in raw) ||
    !('moveZ' in raw) ||
    !('yaw' in raw) ||
    !('sprint' in raw) ||
    !('deltaMs' in raw)
  ) {
    return null;
  }

  const { seq, moveX, moveZ, yaw, sprint, deltaMs } = raw;

  if (typeof seq !== 'number' || !Number.isFinite(seq) || seq < 0) return null;
  if (typeof moveX !== 'number' || !Number.isFinite(moveX) || Math.abs(moveX) > 1.001) return null;
  if (typeof moveZ !== 'number' || !Number.isFinite(moveZ) || Math.abs(moveZ) > 1.001) return null;
  if (typeof yaw !== 'number' || !Number.isFinite(yaw)) return null;
  if (typeof sprint !== 'boolean') return null;
  if (typeof deltaMs !== 'number' || !Number.isFinite(deltaMs) || deltaMs < 0) return null;

  return { seq, moveX, moveZ, yaw, sprint, deltaMs };
}
