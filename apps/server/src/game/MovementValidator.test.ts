import { describe, expect, it } from 'vitest';

import type { InputMessage } from '@mazerush/shared';

import {
  KICK_MALFORMED_FLOOD,
  KICK_RATE_LIMIT_FLOOD,
  KICK_SPEED_FLOOD,
  MovementValidator,
  type ValidationOutcome,
} from './MovementValidator.js';

function makeInput(seq: number, deltaMs = 16, overrides: Partial<InputMessage> = {}): InputMessage {
  return {
    seq,
    moveX: 0,
    moveZ: 1,
    yaw: 0,
    sprint: false,
    deltaMs,
    ...overrides,
  };
}

describe('MovementValidator', () => {
  it('accepts a well-formed input', () => {
    const v = new MovementValidator(0);
    const r = v.process(makeInput(1), 16);
    expect(r.kind).toBe('apply');
    if (r.kind === 'apply') {
      // deltaMs is passed through capped, equal to input here.
      expect(r.input.seq).toBe(1);
      expect(r.input.deltaMs).toBe(16);
    }
  });

  it('caps deltaMs at MAX_INPUT_DELTA_MS in the passed-through input', () => {
    const v = new MovementValidator(0);
    const r = v.process(makeInput(1, 10_000), 50);
    expect(r.kind).toBe('apply');
    if (r.kind === 'apply') {
      expect(r.input.deltaMs).toBe(50);
    }
  });

  it('drops messages when the token bucket is empty', () => {
    const v = new MovementValidator(0);
    // Burn through the full bucket within the same instant (no refill).
    for (let i = 1; i <= 90; i++) {
      v.process(makeInput(i, 1), 0);
    }
    const r = v.process(makeInput(91, 1), 0);
    expect(r.kind).toBe('rate-limited');
  });

  it('refills tokens over wall-clock time', () => {
    const v = new MovementValidator(0);
    for (let i = 1; i <= 90; i++) {
      v.process(makeInput(i, 1), 0);
    }
    // One second later the bucket should be full again.
    const r = v.process(makeInput(91, 1), 1000);
    expect(r.kind).toBe('apply');
  });

  it('drops malformed inputs silently up to the threshold', () => {
    const v = new MovementValidator(0);
    for (let i = 0; i < 20; i++) {
      const r = v.process({ rubbish: true }, i);
      expect(r.kind).toBe('drop-malformed');
    }
  });

  it('kicks after too many malformed inputs', () => {
    const v = new MovementValidator(0);
    let outcome: ValidationOutcome | null = null;
    for (let i = 0; i < 30; i++) {
      outcome = v.process({ junk: 'x' }, i);
      if (outcome.kind === 'kick') break;
    }
    expect(outcome?.kind).toBe('kick');
    if (outcome?.kind === 'kick') {
      expect(outcome.code).toBe(KICK_MALFORMED_FLOOD);
    }
  });

  it('rejects-speed when time debt exceeds threshold', () => {
    const v = new MovementValidator(0);
    // Each input claims 50ms but only 1ms of wall time passes between them.
    // Debt grows by ~49ms per call → exceeds 500ms after ~11 calls.
    let firstRejectAt = -1;
    for (let i = 0; i < 30; i++) {
      const r = v.process(makeInput(i + 1, 50), i);
      if (r.kind === 'reject-speed' && firstRejectAt < 0) firstRejectAt = i;
    }
    expect(firstRejectAt).toBeGreaterThan(5);
    expect(firstRejectAt).toBeLessThan(20);
  });

  it('eventually kicks for persistent speed violations', () => {
    const v = new MovementValidator(0);
    let outcome: ValidationOutcome | null = null;
    for (let i = 0; i < 200; i++) {
      outcome = v.process(makeInput(i + 1, 50), i);
      if (outcome.kind === 'kick') break;
    }
    expect(outcome?.kind).toBe('kick');
    if (outcome?.kind === 'kick') {
      expect(outcome.code).toBe(KICK_SPEED_FLOOD);
    }
  });

  it('kicks for sustained rate-limit abuse', () => {
    const v = new MovementValidator(0);
    // Drain the bucket, then hammer with no time advancing for ~5 seconds
    // worth of attempts. Should kick before 1000 iterations.
    for (let i = 1; i <= 90; i++) v.process(makeInput(i, 1), 0);
    let outcome: ValidationOutcome | null = null;
    for (let i = 0; i < 1000; i++) {
      outcome = v.process(makeInput(91 + i, 1), 0);
      if (outcome.kind === 'kick') break;
    }
    expect(outcome?.kind).toBe('kick');
    if (outcome?.kind === 'kick') {
      expect(outcome.code).toBe(KICK_RATE_LIMIT_FLOOD);
    }
  });

  it('a steady 60 Hz legit client never trips any safeguard over 5 seconds', () => {
    const v = new MovementValidator(0);
    let nonApplyCount = 0;
    for (let i = 0; i < 5 * 60; i++) {
      const now = i * 16; // ~60 Hz
      const r = v.process(makeInput(i + 1, 16), now);
      if (r.kind !== 'apply') nonApplyCount++;
    }
    expect(nonApplyCount).toBe(0);
  });
});
