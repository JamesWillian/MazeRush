import { MAX_INPUT_DELTA_MS, type InputMessage } from '@mazerush/shared';

import { parseInput } from './parseInput.js';

// Token bucket: how many input messages we accept per second before we start
// dropping (with a burst capacity slightly above the sustained rate, so a
// brief jitter spike doesn't penalize a legit client).
const TOKEN_BUCKET_SIZE = 90;
const TOKEN_REFILL_PER_SEC = 60;

// Sliding "time debt" cap (in ms). The client claims a certain amount of
// game time per input (`deltaMs`); the server compares against real elapsed
// wall-clock time and tracks the running difference. Up to MAX_TIME_DEBT_MS
// of "credit" lets jitter bursts through; beyond that we start rejecting
// moves and the client gets a snap-back.
const MAX_TIME_DEBT_MS = 500;

// Kick thresholds. Tuned to be hard to trigger by accident on a flaky
// connection but quick enough that a tool/script abuser gets dropped.
const MAX_MALFORMED_BEFORE_KICK = 20;
const MAX_SPEED_VIOLATIONS_BEFORE_KICK = 30;
const MAX_RATE_LIMIT_HITS_IN_A_ROW_BEFORE_KICK = 240; // ~4s of pegging

// WebSocket close codes >= 4000 are reserved for application use.
export const KICK_MALFORMED_FLOOD = 4001;
export const KICK_SPEED_FLOOD = 4002;
export const KICK_RATE_LIMIT_FLOOD = 4003;

export type ValidationOutcome =
  | { readonly kind: 'apply'; readonly input: InputMessage }
  | { readonly kind: 'reject-speed'; readonly seq: number; readonly yaw: number }
  | { readonly kind: 'rate-limited' }
  | { readonly kind: 'drop-malformed' }
  | { readonly kind: 'kick'; readonly code: number; readonly reason: string };

// Per-connection input gate. Constructed on onJoin, destroyed on onLeave.
// Pure-ish: takes (raw, now) and returns an outcome — no Room dependency.
export class MovementValidator {
  private tokens: number;
  private lastTokenRefillMs: number;
  private timeDebtMs = 0;
  private lastProcessedMs: number;
  private malformedCount = 0;
  private speedViolationCount = 0;
  private rateLimitedInARow = 0;

  constructor(now: number) {
    this.tokens = TOKEN_BUCKET_SIZE;
    this.lastTokenRefillMs = now;
    this.lastProcessedMs = now;
  }

  process(raw: unknown, now: number): ValidationOutcome {
    // 1. Refill + check the rate-limit token bucket.
    this.refillTokens(now);
    if (this.tokens < 1) {
      this.rateLimitedInARow++;
      if (this.rateLimitedInARow > MAX_RATE_LIMIT_HITS_IN_A_ROW_BEFORE_KICK) {
        return {
          kind: 'kick',
          code: KICK_RATE_LIMIT_FLOOD,
          reason: `sustained rate-limit abuse (${this.rateLimitedInARow} hits)`,
        };
      }
      return { kind: 'rate-limited' };
    }
    this.tokens -= 1;
    this.rateLimitedInARow = 0;

    // 2. Structural parse. Malformed inputs are silently dropped; flooders
    //    get kicked.
    const input = parseInput(raw);
    if (!input) {
      this.malformedCount++;
      if (this.malformedCount > MAX_MALFORMED_BEFORE_KICK) {
        return {
          kind: 'kick',
          code: KICK_MALFORMED_FLOOD,
          reason: `${this.malformedCount} malformed inputs`,
        };
      }
      return { kind: 'drop-malformed' };
    }

    // 3. Time-debt speed check. Each accepted input adds (clientDt - realDt)
    //    to the debt; the cap caps how much "claimed game time" a client can
    //    pull ahead of wall-clock time.
    const realElapsedMs = Math.max(0, now - this.lastProcessedMs);
    const cappedDt = Math.min(input.deltaMs, MAX_INPUT_DELTA_MS);
    const projectedDebt = Math.max(0, this.timeDebtMs + cappedDt - realElapsedMs);

    if (projectedDebt > MAX_TIME_DEBT_MS) {
      this.speedViolationCount++;
      if (this.speedViolationCount > MAX_SPEED_VIOLATIONS_BEFORE_KICK) {
        return {
          kind: 'kick',
          code: KICK_SPEED_FLOOD,
          reason: `${this.speedViolationCount} speed violations (debt ${Math.round(projectedDebt)}ms)`,
        };
      }
      // Advance the wall-clock pointer even on rejection so the next
      // legitimate input doesn't get punished for the cheater's burst.
      this.lastProcessedMs = now;
      return { kind: 'reject-speed', seq: input.seq, yaw: input.yaw };
    }

    this.timeDebtMs = projectedDebt;
    this.lastProcessedMs = now;
    // Pass the capped deltaMs downstream so stepPlayer sees the same value
    // the validator gated on. Defense in depth: stepPlayer also caps, but
    // doing it here keeps the contract explicit.
    return { kind: 'apply', input: { ...input, deltaMs: cappedDt } };
  }

  private refillTokens(now: number): void {
    const elapsedSec = (now - this.lastTokenRefillMs) / 1000;
    if (elapsedSec <= 0) return;
    this.tokens = Math.min(TOKEN_BUCKET_SIZE, this.tokens + elapsedSec * TOKEN_REFILL_PER_SEC);
    this.lastTokenRefillMs = now;
  }

  // Exposed for telemetry / tests.
  get diagnostics(): {
    tokens: number;
    timeDebtMs: number;
    malformedCount: number;
    speedViolationCount: number;
  } {
    return {
      tokens: this.tokens,
      timeDebtMs: this.timeDebtMs,
      malformedCount: this.malformedCount,
      speedViolationCount: this.speedViolationCount,
    };
  }
}
