import { Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import { BOARD_SIZE, SQUARE_SIZE } from './constants.js';

export class HighlightManager {
  constructor(boardGroup) {
    this.boardGroup = boardGroup;
    this.highlights = [];
    this.moveMap = new Map();
    this.createHighlightMeshes();
  }

  createHighlightMeshes() {
    const geometry = new PlaneGeometry(SQUARE_SIZE * 0.86, SQUARE_SIZE * 0.86);
    const greenMaterial = new MeshStandardMaterial({ color: 0x22c55e, transparent: true, opacity: 0.82, depthWrite: false });
    const redMaterial = new MeshStandardMaterial({ color: 0xef4444, transparent: true, opacity: 0.82, depthWrite: false });

    this.greenHighlight = new Mesh(geometry, greenMaterial);
    this.greenHighlight.rotation.x = -Math.PI / 2;
    this.greenHighlight.position.y = 0.1;

    this.redHighlight = new Mesh(geometry, redMaterial);
    this.redHighlight.rotation.x = -Math.PI / 2;
    this.redHighlight.position.y = 0.1;
  }

  showForPiece(piece) {
    this.clearHighlights();
    const moves = piece && this.moveGenerator ? this.moveGenerator.generateLegalMoves(piece) : [];
    moves.forEach((move) => {
      const mesh = move.type === 'capture' ? this.redHighlight : this.greenHighlight;
      const highlight = mesh.clone();
      highlight.position.set(
        (move.column - (BOARD_SIZE - 1) / 2) * SQUARE_SIZE,
        0.1,
        ((BOARD_SIZE - 1) / 2 - move.row) * SQUARE_SIZE,
      );
      this.boardGroup.add(highlight);
      this.highlights.push(highlight);
      this.moveMap.set(`${move.row}-${move.column}`, move);
    });
  }

  clearHighlights() {
    this.moveMap.clear();
    this.highlights.forEach((highlight) => {
      if (highlight && highlight.parent) {
        highlight.parent.remove(highlight);
      }
    });
    this.highlights = [];
  }

  getMoveAt(row, column) {
    return this.moveMap.get(`${row}-${column}`) || null;
  }

  setMoveGenerator(moveGenerator) {
    this.moveGenerator = moveGenerator;
  }

  setBoardGroup(boardGroup) {
    this.clearHighlights();
    this.boardGroup = boardGroup;
    this.createHighlightMeshes();
  }
}
