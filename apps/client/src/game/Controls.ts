import { MOUSE_SENSITIVITY, PITCH_LIMIT } from '../config.js';

// Snapshot of input state the rest of the game consumes each frame.
// `forward` and `strafe` are -1 / 0 / 1 (digital keys); the per-frame
// magnitude is computed by the player, not here, so re-binding keys later
// won't require touching movement math.
export type InputSnapshot = {
  readonly forward: number;
  readonly strafe: number;
  readonly yaw: number;
  readonly pitch: number;
  readonly sprint: boolean;
};

// Owns: pointer lock state, the keyboard set, accumulated yaw/pitch from
// mouse deltas. Deliberately does NOT touch the camera — `LocalPlayer` reads
// a snapshot once per frame and decides what to do with it.
export class Controls {
  private readonly keys = new Set<string>();
  private locked = false;
  private yaw = Math.PI; // face +Z by default (away from NW corner spawn)
  private pitch = 0;
  private readonly listeners: Array<(locked: boolean) => void> = [];

  constructor(private readonly target: HTMLElement) {
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
  }

  requestLock(): void {
    if (!this.locked) {
      this.target.requestPointerLock();
    }
  }

  releaseLock(): void {
    if (this.locked) document.exitPointerLock();
  }

  onLockChange(cb: (locked: boolean) => void): void {
    this.listeners.push(cb);
  }

  get isLocked(): boolean {
    return this.locked;
  }

  setInitialYaw(yaw: number): void {
    this.yaw = yaw;
  }

  snapshot(): InputSnapshot {
    return {
      forward: (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0),
      strafe: (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0),
      yaw: this.yaw,
      pitch: this.pitch,
      sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
    };
  }

  private readonly onPointerLockChange = (): void => {
    this.locked = document.pointerLockElement === this.target;
    if (!this.locked) this.keys.clear();
    for (const cb of this.listeners) cb(this.locked);
  };

  private readonly onMouseMove = (e: MouseEvent): void => {
    if (!this.locked) return;
    this.yaw -= e.movementX * MOUSE_SENSITIVITY;
    this.pitch -= e.movementY * MOUSE_SENSITIVITY;
    if (this.pitch > PITCH_LIMIT) this.pitch = PITCH_LIMIT;
    else if (this.pitch < -PITCH_LIMIT) this.pitch = -PITCH_LIMIT;
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.locked) return;
    this.keys.add(e.code);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  dispose(): void {
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
  }
}
