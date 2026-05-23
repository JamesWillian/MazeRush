import * as THREE from 'three';

import { DEFAULT_PLAYER_COLOR, PLAYER_HEIGHT, PLAYER_RADIUS } from '@mazerush/shared';

import { RemoteInterpolator } from './Interpolation.js';

// Visual avatar for non-local players, driven by an interpolation buffer
// so movement is smooth at 60 fps even though state arrives at 20 Hz.
// Capsule matches the collision AABB so what you see is what you can
// run into. Color is per-player and can change mid-game when the owner
// uses the color picker — `setColor` mutates the shared material in
// place, no rebuild.
export class RemotePlayer {
  readonly object: THREE.Object3D;
  private readonly mesh: THREE.Mesh;
  private readonly material: THREE.MeshStandardMaterial;
  private currentColor: string;
  private readonly interp = new RemoteInterpolator();

  constructor(initial: { x: number; z: number; yaw: number; color: string }) {
    const cylinderHeight = Math.max(0.01, PLAYER_HEIGHT - 2 * PLAYER_RADIUS);
    const geom = new THREE.CapsuleGeometry(PLAYER_RADIUS, cylinderHeight, 4, 8);
    this.currentColor = initial.color || DEFAULT_PLAYER_COLOR;
    this.material = new THREE.MeshStandardMaterial({ color: hexFromString(this.currentColor) });
    this.mesh = new THREE.Mesh(geom, this.material);
    this.mesh.position.set(initial.x, PLAYER_HEIGHT / 2, initial.z);
    this.mesh.rotation.y = initial.yaw;
    this.object = this.mesh;

    this.interp.pushSnapshot({ x: initial.x, z: initial.z, yaw: initial.yaw });
  }

  pushSnapshot(snapshot: { x: number; z: number; yaw: number }, now: number): void {
    this.interp.pushSnapshot(snapshot, now);
  }

  // Skip the material assignment when the incoming color matches the
  // current one. Color changes are rare; checking once per state delta
  // is cheaper than reassigning the THREE.Color every frame.
  setColor(color: string): void {
    if (!color || color === this.currentColor) return;
    this.currentColor = color;
    this.material.color.setHex(hexFromString(color));
  }

  update(now: number): void {
    const s = this.interp.sample(now);
    if (!s) return;
    this.mesh.position.set(s.x, PLAYER_HEIGHT / 2, s.z);
    this.mesh.rotation.y = s.yaw;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

function hexFromString(s: string): number {
  // Accepts `#rrggbb`. Falls back to the default if the input is malformed,
  // which mirrors the server's sanitizer behavior.
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) {
    return parseInt(DEFAULT_PLAYER_COLOR.slice(1), 16);
  }
  return parseInt(s.slice(1), 16);
}
