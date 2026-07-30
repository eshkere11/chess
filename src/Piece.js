import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
} from 'three';
import { BOARD_SIZE, SQUARE_SIZE } from './constants.js';
import { boardX, boardZ } from './BoardCoordinates.js';

export class Piece {
  constructor(type, color, boardGroup, modelMesh = null) {
    this.type = type;
    this.color = color;
    this.board = 'middle';
    this.row = -1;
    this.column = -1;
    this.hasMoved = false;
    this.isSelected = false;
    this.elevator = null;
    this.baseHeight = modelMesh ? 0 : 0.28;

    this.root = new Group();
    this.bodyGroup = new Group();
    this.root.add(this.bodyGroup);

    this.createMesh(modelMesh);
    this.setSelected(false);
    boardGroup.add(this.root);
  }

  createMesh(modelMesh) {
    this.bodyGroup.position.y = this.baseHeight;

    if (modelMesh) {
      this.bodyGroup.add(modelMesh);
    }

    this.selectionRing = new Mesh(
      new CylinderGeometry(0.48, 0.48, 0.04, 24),
      new MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.7, depthWrite: false }),
    );
    this.selectionRing.position.y = 0.03;
    this.selectionRing.visible = false;
    this.root.add(this.selectionRing);

    this.root.traverse((child) => {
      child.userData.piece = this;
    });
  }

  setBoard(row, column) {
    this.row = row;
    this.column = column;
    this.updatePosition();
  }

  setElevator(elevator) {
    this.elevator = elevator;
  }

  setFloor(floorKey) {
    this.board = floorKey;
  }

  replaceModel(type, modelMesh) {
    this.type = type;
    this.bodyGroup.clear();
    this.baseHeight = 0;
    this.bodyGroup.position.y = 0;
    this.bodyGroup.add(modelMesh);
    this.root.traverse((child) => { child.userData.piece = this; });
  }

  updatePosition() {
    const x = boardX(this.column);
    const z = boardZ(this.row);
    this.root.position.set(x, 0, z);
  }

  setSelected(isSelected) {
    this.isSelected = isSelected;
    this.selectionRing.visible = isSelected;
    this.bodyGroup.position.y = isSelected ? this.baseHeight + 0.08 : this.baseHeight;
  }

  update(time) {
    if (!this.selectionRing.visible) {
      this.selectionRing.scale.setScalar(1);
      this.selectionRing.material.opacity = 0.7;
      return;
    }

    const pulse = 1 + Math.sin(time * 0.004) * 0.04;
    this.selectionRing.scale.setScalar(pulse);
    this.selectionRing.material.opacity = 0.55 + Math.sin(time * 0.0035) * 0.12;
    this.bodyGroup.position.y = this.baseHeight + 0.08 + Math.sin(time * 0.004) * 0.01;
  }
}
