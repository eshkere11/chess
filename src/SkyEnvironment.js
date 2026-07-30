import {
  BackSide,
  BufferGeometry,
  BoxGeometry,
  Color,
  ConeGeometry,
  DodecahedronGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';

const random = (index, seed) => {
  const value = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453123;
  return value - Math.floor(value);
};

/** Lightweight decorative scene layer. It owns no game state and never raycasts. */
export class SkyEnvironment {
  constructor(scene) {
    this.root = new Group();
    this.cloudData = [];
    this.createSky();
    this.createCloudLayers();
    this.createDistantIslands();
    this.createAmbientParticles();
    scene.add(this.root);
  }

  createSky() {
    const material = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      uniforms: {
        time: { value: 0 },
        zenith: { value: new Color(0x2f6fa8) },
        horizon: { value: new Color(0xa9d9f2) },
      },
      vertexShader: `varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `uniform float time;
        uniform vec3 zenith;
        uniform vec3 horizon;
        varying vec3 vWorldPosition;
        void main() {
          float height = normalize(vWorldPosition).y * 0.5 + 0.5;
          float glow = 0.035 * sin(time * 0.025);
          vec3 sky = mix(horizon, zenith, smoothstep(0.12, 0.92, height));
          gl_FragColor = vec4(sky + glow, 1.0);
        }`,
    });
    this.sky = new Mesh(new SphereGeometry(240, 32, 20), material);
    this.sky.raycast = () => {};
    this.root.add(this.sky);
  }

  createCloudLayers() {
    const cloudGeometry = new DodecahedronGeometry(1, 1);
    const cloudMaterial = new MeshStandardMaterial({
      color: 0xf7fbff,
      roughness: 0.95,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      fog: true,
    });
    this.cloudMaterial = cloudMaterial;
    const count = 108;
    this.clouds = new InstancedMesh(cloudGeometry, cloudMaterial, count);
    this.clouds.instanceMatrix.setUsage(35048); // DynamicDrawUsage
    this.clouds.frustumCulled = false;
    this.clouds.raycast = () => {};

    for (let index = 0; index < count; index += 1) {
      const layer = index % 3;
      const radius = layer === 0 ? 42 : layer === 1 ? 70 : 108;
      const angle = random(index, 1) * Math.PI * 2;
      const distance = radius + random(index, 2) * 34;
      const data = {
        x: Math.cos(angle) * distance,
        y: [-18, 8, 47][layer] + random(index, 3) * 7,
        z: Math.sin(angle) * distance,
        scaleX: 5 + random(index, 4) * 8,
        scaleY: 1.1 + random(index, 5) * 2.5,
        scaleZ: 2.8 + random(index, 6) * 5,
        speed: 0.00015 + random(index, 7) * 0.00022,
        phase: random(index, 8) * Math.PI * 2,
      };
      this.cloudData.push(data);
      this.setCloudMatrix(index, data, 0);
    }
    this.root.add(this.clouds);
  }

  setCloudMatrix(index, cloud, time) {
    const matrix = new Matrix4();
    const offsetX = Math.sin(time * cloud.speed + cloud.phase) * 5;
    const offsetZ = Math.cos(time * cloud.speed * 0.7 + cloud.phase) * 3;
    matrix.compose(
      new Vector3(cloud.x + offsetX, cloud.y, cloud.z + offsetZ),
      this.root.quaternion,
      new Vector3(cloud.scaleX, cloud.scaleY, cloud.scaleZ),
    );
    this.clouds.setMatrixAt(index, matrix);
  }

  createDistantIslands() {
    const islandPositions = [
      [-54, 5, -45], [48, 14, -52], [-72, 29, 32], [67, 40, 38],
      [-35, -12, 70], [30, 55, -2], [-92, 16, -8], [92, 24, 4],
    ];
    const rockMaterial = new MeshStandardMaterial({ color: 0x3e4852, roughness: 0.98, metalness: 0.02 });
    const grassMaterial = new MeshStandardMaterial({ color: 0x526555, roughness: 1 });
    const stoneMaterial = new MeshStandardMaterial({ color: 0x8e9694, roughness: 0.9, metalness: 0.03 });

    islandPositions.forEach(([x, y, z], index) => {
      const island = new Group();
      island.position.set(x, y, z);
      island.rotation.y = random(index, 20) * Math.PI;
      const scale = 0.75 + random(index, 21) * 0.65;
      island.scale.setScalar(scale);

      const underside = new Mesh(new ConeGeometry(9, 18, 7), rockMaterial);
      underside.position.y = -6;
      underside.rotation.x = Math.PI;
      const cap = new Mesh(new DodecahedronGeometry(8, 1), grassMaterial);
      cap.scale.set(1.45, 0.28, 1.1);
      cap.position.y = 1;
      island.add(underside, cap);

      const columnGeometry = new BoxGeometry(0.75, 5, 0.75);
      for (let column = 0; column < 3; column += 1) {
        const ruin = new Mesh(columnGeometry, stoneMaterial);
        const angle = (column / 3) * Math.PI * 2 + random(index, column + 30) * 0.35;
        ruin.position.set(Math.cos(angle) * 3.2, 3.2 + column * 0.25, Math.sin(angle) * 2.5);
        ruin.rotation.z = (random(index, column + 40) - 0.5) * 0.22;
        island.add(ruin);
      }
      island.traverse((object) => { if (object.isMesh) object.raycast = () => {}; });
      this.root.add(island);
    });
  }

  createAmbientParticles() {
    const positions = new Float32Array(180 * 3);
    for (let index = 0; index < 180; index += 1) {
      positions[index * 3] = (random(index, 60) - 0.5) * 100;
      positions[index * 3 + 1] = -8 + random(index, 61) * 64;
      positions[index * 3 + 2] = (random(index, 62) - 0.5) * 100;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    const material = new PointsMaterial({ color: 0xfff4d6, size: 0.13, transparent: true, opacity: 0.45, depthWrite: false });
    this.particles = new Points(geometry, material);
    this.particles.raycast = () => {};
    this.root.add(this.particles);
  }

  update(time, cameraController) {
    this.sky.material.uniforms.time.value = time / 1000;
    this.cloudData.forEach((cloud, index) => this.setCloudMatrix(index, cloud, time));
    this.clouds.instanceMatrix.needsUpdate = true;
    this.clouds.visible = true;
    this.particles.visible = true;
    this.cloudMaterial.opacity = 0.38;
    this.particles.material.opacity = 0.45;
    this.particles.rotation.y = time * 0.000008;
  }
}
