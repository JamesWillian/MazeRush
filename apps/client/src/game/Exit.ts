import * as THREE from 'three';

// Glowing green pad on the floor marking an exit cell. We use an emissive
// material so the pad reads as "active" even in the dim ambient lighting.
const PAD_HEIGHT = 0.06;
const PAD_RADIUS = 0.9;

export class Exit {
  readonly object: THREE.Object3D;

  constructor(x: number, z: number) {
    const geom = new THREE.CylinderGeometry(PAD_RADIUS, PAD_RADIUS, PAD_HEIGHT, 24);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      emissive: 0x15803d,
      emissiveIntensity: 0.85,
      roughness: 0.5,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, PAD_HEIGHT / 2, z);
    this.object = mesh;
  }
}
