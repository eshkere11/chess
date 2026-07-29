import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SQUARE_SIZE } from './constants.js';

const PIECE_TYPES = ['pawn', 'rook', 'knight', 'bishop', 'queen', 'king'];
const COLOR_PATTERNS = {
  white: ['white', 'light'],
  black: ['black', 'dark', 'chesspiece'],
};
const NON_PIECE_PATTERNS = ['board', 'plane', 'grid', 'surround'];

export class ModelManager {
  static gltf = null;
  static loadPromise = null;
  static pieceCache = new Map();

  async loadModels() {
    if (ModelManager.gltf) {
      return ModelManager.gltf;
    }

    if (!ModelManager.loadPromise) {
      ModelManager.loadPromise = new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/ChessSet.glb`)
        .then((gltf) => {
          ModelManager.gltf = gltf;
          this.cachePieceMeshes(gltf);
          return gltf;
        })
        .catch((error) => {
          ModelManager.loadPromise = null;
          throw error;
        });
    }

    return ModelManager.loadPromise;
  }

  cachePieceMeshes(gltf) {
    gltf.scene.traverse((object) => {
      if (!object.isMesh) {
        return;
      }

      const name = object.name.toLowerCase();
      if (NON_PIECE_PATTERNS.some((pattern) => name.includes(pattern))) {
        return;
      }

      const type = PIECE_TYPES.find((pieceType) => name.includes(pieceType));
      const color = this.getMeshColor(object) ?? Object.entries(COLOR_PATTERNS)
        .find(([, patterns]) => patterns.some((pattern) => name.includes(pattern)))?.[0];

      if (type && color) {
        ModelManager.pieceCache.set(this.getCacheKey(color, type), object);
      }
    });
  }

  getMeshColor(mesh) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const materialNames = materials.map((material) => material?.name.toLowerCase());

    if (materialNames.includes('black_piece')) {
      return 'black';
    }

    if (materialNames.includes('white_piece')) {
      return 'white';
    }

    return null;
  }

  getCacheKey(color, type) {
    return `${color}:${type}`;
  }

  async clonePiece(color, type) {
    await this.loadModels();

    const sourceMesh = ModelManager.pieceCache.get(this.getCacheKey(color, type));
    if (!sourceMesh) {
      throw new Error(`ChessSet.glb does not contain a ${color} ${type} mesh.`);
    }

    const clone = sourceMesh.clone(true);
    clone.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    if (color === 'black') {
      this.improveBlackMaterial(clone);
    }
    this.fitPieceToSquare(clone);
    return clone;
  }

  improveBlackMaterial(mesh) {
    mesh.traverse((object) => {
      if (!object.isMesh) {
        return;
      }

      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (!material?.isMeshStandardMaterial) {
          return;
        }

        material.color.set(0x2f343a);
        material.emissive.set(0x050607);
        material.emissiveIntensity = 0.08;
      });
    });
  }

  fitPieceToSquare(mesh) {
    mesh.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(mesh);
    const size = bounds.getSize(new Vector3());
    const footprint = Math.max(size.x, size.z);
    const targetFootprint = SQUARE_SIZE * 0.53;

    if (footprint > 0) {
      mesh.scale.multiplyScalar(targetFootprint / footprint);
      mesh.updateMatrixWorld(true);
    }

    const fittedBounds = new Box3().setFromObject(mesh);
    const center = fittedBounds.getCenter(new Vector3());
    mesh.position.x -= center.x;
    mesh.position.z -= center.z;
    mesh.position.y -= fittedBounds.min.y;
    mesh.updateMatrixWorld(true);
  }
}
