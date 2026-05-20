import * as THREE from 'three';

// Visual representation of the bandeira. A short black pole with a yellow
// emissive flag, sized so it's visible across corridors but doesn't fill
// the whole cell.
const POLE_HEIGHT = 1.4;

export class Flag {
  readonly object: THREE.Object3D;

  constructor() {
    const group = new THREE.Group();

    const poleGeom = new THREE.CylinderGeometry(0.04, 0.04, POLE_HEIGHT, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    const pole = new THREE.Mesh(poleGeom, poleMat);
    pole.position.y = POLE_HEIGHT / 2;
    group.add(pole);

    const clothGeom = new THREE.PlaneGeometry(0.55, 0.35);
    const clothMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xa66b00,
      emissiveIntensity: 0.7,
      side: THREE.DoubleSide,
    });
    const cloth = new THREE.Mesh(clothGeom, clothMat);
    cloth.position.set(0.32, POLE_HEIGHT - 0.2, 0);
    group.add(cloth);

    this.object = group;
  }

  setGroundPosition(x: number, z: number): void {
    this.object.position.set(x, 0, z);
  }

  // When carried, lift the flag a bit so it appears above the carrier's
  // head and isn't obscured by their avatar.
  setCarriedPosition(x: number, z: number): void {
    this.object.position.set(x, 0.4, z);
  }
}
