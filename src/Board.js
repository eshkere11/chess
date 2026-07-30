import {
  BoxGeometry,
  CanvasTexture,
  DoubleSide,
  Euler,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { BOARD_FRAME_WIDTH, BOARD_SIZE, COLORS, SQUARE_SIZE } from './constants.js';
import { boardX } from './BoardCoordinates.js';

export class Board {
  constructor(frameMesh) {
    this.frameMesh = frameMesh;
    this.group = new Group();
    this.squares = [];
    this.coordinateDecals = [];
    this.coordinatePerspective = 'white';
    this.createSquares();
    this.createCoordinateLabels();
  }

  createSquares() {
    this.squareHeight = 0.15;
    this.squareElevation = 0.01;
    const squareGeometry = new BoxGeometry(SQUARE_SIZE, this.squareHeight, SQUARE_SIZE);
    const materials = {
      light: new MeshStandardMaterial({ color: COLORS.lightSquare, roughness: 0.9, transparent: true, opacity: 1 }),
      dark: new MeshStandardMaterial({ color: COLORS.darkSquare, roughness: 0.9, transparent: true, opacity: 1 }),
    };

    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let column = 0; column < BOARD_SIZE; column += 1) {
        const mesh = new Mesh(squareGeometry, materials[(row + column) % 2 === 0 ? 'light' : 'dark']);
        mesh.position.set(
          boardX(column),
          this.squareElevation,
          ((BOARD_SIZE - 1) / 2 - row) * SQUARE_SIZE,
        );
        mesh.receiveShadow = true;
        this.group.add(mesh);
        this.squares.push(mesh);
      }
    }
  }

  createCoordinateLabels() {
    const files = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
    const boardSpan = BOARD_SIZE * SQUARE_SIZE;
    const frameStripWidth = BOARD_FRAME_WIDTH / 2;
    const frameCenterOffset = boardSpan / 2 + frameStripWidth / 2;
    const labelSize = frameStripWidth;
    const frameTopY = this.frameMesh.geometry.parameters.height / 2;
    const rankDecalOrientation = new Euler(Math.PI / 2, 0, 0);
    const fileDecalOrientation = new Euler(Math.PI / 2, 0, 0);
    const decalDepth = this.frameMesh.geometry.parameters.height;
    const isBlackPerspective = this.coordinatePerspective === 'black';
    const fileFrameZ = isBlackPerspective ? frameCenterOffset : -frameCenterOffset;
    const rankFrameX = isBlackPerspective ? -frameCenterOffset : frameCenterOffset;

    this.frameMesh.updateWorldMatrix(true, false);

    files.forEach((file, index) => {
      const fileX = boardX(index);
      this.createCoordinateDecal(
        file,
        fileX,
        fileFrameZ,
        frameTopY,
        labelSize,
        decalDepth,
        fileDecalOrientation,
      );
    });

    ranks.forEach((rank, index) => {
      const rankZ = (BOARD_SIZE / 2 - index - 0.5) * SQUARE_SIZE;
      this.createCoordinateDecal(
        rank,
        rankFrameX,
        rankZ,
        frameTopY,
        labelSize,
        decalDepth,
        rankDecalOrientation,
      );
    });
  }

  createCoordinateDecal(text, x, z, frameTopY, labelSize, decalDepth, orientation) {
    const material = this.createCoordinateMaterial(text, this.coordinatePerspective);
    const position = this.frameMesh.localToWorld(new Vector3(x, frameTopY, z));
    const geometry = new DecalGeometry(
      this.frameMesh,
      position,
      orientation,
      new Vector3(labelSize, labelSize, decalDepth),
    );
    geometry.applyMatrix4(this.frameMesh.matrixWorld.clone().invert());

    const decal = new Mesh(geometry, material);
    this.frameMesh.add(decal);
    this.coordinateDecals.push(decal);
  }

  setCoordinatePerspective(perspective) {
    const nextPerspective = perspective === 'black' ? 'black' : 'white';
    if (this.coordinatePerspective === nextPerspective) return;
    this.coordinatePerspective = nextPerspective;
    this.coordinateDecals.forEach((decal) => {
      decal.removeFromParent();
      decal.geometry.dispose();
      decal.material.map?.dispose();
      decal.material.dispose();
    });
    this.coordinateDecals = [];
    this.createCoordinateLabels();
  }

  createCoordinateMaterial(text, perspective) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    context.translate(canvas.width / 2, canvas.height / 2);
    if (perspective === 'black') context.rotate(Math.PI);
    context.scale(-1, 1);
    context.font = 'bold 180px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.strokeStyle = 'rgba(15, 23, 42, 0.72)';
    context.lineWidth = 10;
    context.strokeText(text, 0, 0);
    context.fillStyle = '#f8fafc';
    context.fillText(text, 0, 0);

    const texture = new CanvasTexture(canvas);
    texture.needsUpdate = true;
    return new MeshBasicMaterial({
      map: texture,
      alphaTest: 0.01,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      side: DoubleSide,
    });
  }
}
