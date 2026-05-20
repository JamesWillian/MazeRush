import type * as THREE from 'three';

import { PLAYER_HEIGHT, type MazeGrid, type Vec2 } from '@mazerush/shared';

import type { InputSnapshot } from './Controls.js';
import { Prediction } from './Prediction.js';

// Local player is now a thin shell over `Prediction`. Each frame:
//   1. consumeInput(snap, dt) advances the predicted position locally and
//      returns a (seq, payload) tuple for the network layer to send.
//   2. applyServerSnapshot(serverPos, lastSeq) reconciles when the server's
//      authoritative state arrives.
// The camera always reads from `pos`, so the player sees zero-RTT response
// to their own keys while still snapping back if the server disagrees.
export class LocalPlayer {
  private readonly prediction: Prediction;
  private nextSeq = 0;

  constructor(maze: MazeGrid, spawn: Vec2) {
    this.prediction = new Prediction(maze, spawn);
  }

  consumeInput(
    snap: InputSnapshot,
    deltaMs: number,
  ): {
    seq: number;
    moveX: number;
    moveZ: number;
    yaw: number;
    sprint: boolean;
    deltaMs: number;
  } {
    const payload = {
      seq: ++this.nextSeq,
      moveX: snap.strafe,
      moveZ: snap.forward,
      yaw: snap.yaw,
      sprint: snap.sprint,
      deltaMs,
    };
    this.prediction.applyLocalInput(payload);
    return payload;
  }

  applyServerSnapshot(serverPos: Vec2, lastSeq: number): void {
    this.prediction.reconcile(serverPos, lastSeq);
  }

  // Initial spawn snap, before any reconcile has happened.
  forceTo(pos: Vec2): void {
    this.prediction.reset(pos);
  }

  get pos(): Vec2 {
    return this.prediction.snapshot();
  }

  applyToCamera(camera: THREE.PerspectiveCamera, snap: InputSnapshot): void {
    const p = this.pos;
    camera.position.set(p.x, PLAYER_HEIGHT, p.z);
    camera.rotation.y = snap.yaw;
    camera.rotation.x = snap.pitch;
  }
}
