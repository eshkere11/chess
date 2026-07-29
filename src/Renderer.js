import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  FogExp2,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { FLOOR_HEIGHT } from './constants.js';

export class Renderer {
  constructor(container) {
    this.container = container;
    this.scene = new Scene();
    this.scene.background = new Color(0x8ec7ff);
    this.scene.fog = new FogExp2(0x9ccfff, 0.012);
    this.onFrame = null;

    this.camera = new PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 220);
    this.camera.position.set(0, FLOOR_HEIGHT + 17, -13);
    this.camera.lookAt(0, FLOOR_HEIGHT + 0.5, 0);

    this.renderer = new WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(0x8ec7ff, 1);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    this.ambientLight = new AmbientLight(0xffffff, 1.45);
    this.directionalLight = new DirectionalLight(0xffffff, 2.0);
    this.directionalLight.position.set(20, 30, 20);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.set(4096, 4096);
    this.directionalLight.shadow.camera.left = -40;
    this.directionalLight.shadow.camera.right = 40;
    this.directionalLight.shadow.camera.top = 40;
    this.directionalLight.shadow.camera.bottom = -40;
    this.directionalLight.shadow.camera.near = 0.5;
    this.directionalLight.shadow.camera.far = 80;
    this.directionalLight.shadow.radius = 8;
    this.directionalLight.shadow.bias = -0.0002;
    this.directionalLight.shadow.normalBias = 0.02;

    this.fillLight = new DirectionalLight(0xbdd7ff, 0.5);
    this.fillLight.position.set(-18, 12, -22);
    this.fillLight.castShadow = false;

    this.scene.add(this.ambientLight, this.directionalLight, this.fillLight);

    this.rafId = 0;
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
  }

  start() {
    this.renderLoop();
  }

  renderLoop() {
    if (this.onFrame) {
      this.onFrame();
    }

    this.renderer.render(this.scene, this.camera);
    this.rafId = window.requestAnimationFrame(() => this.renderLoop());
  }

  resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  dispose() {
    window.removeEventListener('resize', this.resize);
    cancelAnimationFrame(this.rafId);
    this.renderer.dispose();
  }
}
