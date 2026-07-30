import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
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
    this.scene.background = new Color(0x9ed6f4);
    this.scene.fog = new FogExp2(0xa9d8ed, 0.009);
    this.onFrame = null;

    this.camera = new PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 220);
    this.camera.position.set(0, FLOOR_HEIGHT + 17, -13);
    this.camera.lookAt(0, FLOOR_HEIGHT + 0.5, 0);

    this.renderer = new WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(0x9ed6f4, 1);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    this.ambientLight = new AmbientLight(0xf3e7d1, 1.25);
    this.hemisphereLight = new HemisphereLight(0xbfe3ff, 0x5b6673, 0.7);
    this.directionalLight = new DirectionalLight(0xffefd0, 2.15);
    this.directionalLight.position.set(26, 38, 18);
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

    this.fillLight = new DirectionalLight(0xb8d9ff, 0.42);
    this.fillLight.position.set(-18, 12, -22);
    this.fillLight.castShadow = false;

    this.scene.add(this.ambientLight, this.hemisphereLight, this.directionalLight, this.fillLight);

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
