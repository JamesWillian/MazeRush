import * as THREE from 'three';

import { PLAYER_HEIGHT, PLAYER_RADIUS } from '@mazerush/shared';

import { RemoteInterpolator } from './Interpolation.js';

// Visual avatar for non-local players, driven by an interpolation buffer so
// movement is smooth at 60 fps even though state arrives at 20 Hz. Capsule
// matches the collision AABB so what you see is what you can run into.
export class RemotePlayer {
  readonly object: THREE.Object3D;
  private readonly mesh: THREE.Mesh;
  private readonly interp = new RemoteInterpolator();

  constructor(initial: { x: number; z: number; yaw: number; name: string }) {
    const cylinderHeight = Math.max(0.01, PLAYER_HEIGHT - 2 * PLAYER_RADIUS);
    const geom = new THREE.CapsuleGeometry(PLAYER_RADIUS, cylinderHeight, 4, 8);
    const mat = new THREE.MeshStandardMaterial({ color: colorFromName(initial.name) });
    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.position.set(initial.x, PLAYER_HEIGHT / 2, initial.z);
    this.mesh.rotation.y = initial.yaw;
    this.object = this.mesh;

    // Seed the buffer with the initial pose so `update` has something to
    // sample before the first patch arrives.
    this.interp.pushSnapshot({ x: initial.x, z: initial.z, yaw: initial.yaw });
  }

  pushSnapshot(snapshot: { x: number; z: number; yaw: number }, now: number): void {
    this.interp.pushSnapshot(snapshot, now);
  }

  update(now: number): void {
    const s = this.interp.sample(now);
    if (!s) return;
    this.mesh.position.set(s.x, PLAYER_HEIGHT / 2, s.z);
    this.mesh.rotation.y = s.yaw;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    if (Array.isArray(this.mesh.material)) {
      for (const m of this.mesh.material) m.dispose();
    } else {
      this.mesh.material.dispose();
    }
  }
}

function colorFromName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return new THREE.Color().setHSL((h % 360) / 360, 0.55, 0.55).getHex();
}
