import * as THREE from 'three';

import { CAMERA_FAR, CAMERA_FOV, CAMERA_NEAR, FOG_FAR, FOG_NEAR } from '../config.js';

// Owns the Three.js scene graph + main camera + WebGL renderer. Anything that
// wants to put something in the world reaches into `scene`. Anything that
// wants to know where the camera is reaches into `camera`.
export class Renderer {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  private readonly container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;

    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, aspect, CAMERA_NEAR, CAMERA_FAR);
    // YXZ keeps yaw on the world Y axis and pitch on the camera-local X axis,
    // which is the only rotation order that feels right for FPS controls.
    this.camera.rotation.order = 'YXZ';

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    const bg = new THREE.Color(0x0a0a0c);
    this.scene.background = bg;
    this.scene.fog = new THREE.Fog(bg, FOG_NEAR, FOG_FAR);

    // Two-light setup: a faint ambient so nothing is pure black, plus a soft
    // directional from above so walls have shading. We deliberately skip
    // shadows for now — they cost a depth pass and the maze geometry barely
    // benefits from them at this art level.
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const dir = new THREE.DirectionalLight(0xffffff, 0.75);
    dir.position.set(8, 20, 6);
    this.scene.add(dir);

    window.addEventListener('resize', this.handleResize);
  }

  private readonly handleResize = (): void => {
    const w = this.container.clientWidth;
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  dispose(): void {
    window.removeEventListener('resize', this.handleResize);
    this.renderer.dispose();
  }
}
