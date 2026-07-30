import { Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { BOARD_SIZE, SQUARE_SIZE } from './constants.js';
import { boardX, boardZ } from './BoardCoordinates.js';

const cloneMove = (move) => ({
  fromFloor: move.fromFloor,
  fromRow: move.fromRow,
  fromColumn: move.fromColumn,
  toFloor: move.toFloor,
  toRow: move.toRow,
  toColumn: move.toColumn,
});

/**
 * Owns the two persistent visual markers for the most recently completed move.
 * The meshes are reused and are deliberately excluded from raycasting.
 */
export class LastMoveHighlightManager {
  constructor(floors) {
    this.floors = new Map(floors.map((floor) => [floor.key, floor]));
    this.lastMove = null;

    const geometry = new PlaneGeometry(SQUARE_SIZE * 0.96, SQUARE_SIZE * 0.96);
    const material = new MeshBasicMaterial({
      color: 0xd6a72d,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });

    this.highlights = [new Mesh(geometry, material), new Mesh(geometry, material)];
    this.highlights.forEach((highlight) => {
      highlight.rotation.x = -Math.PI / 2;
      highlight.position.y = 0.1;
      highlight.renderOrder = 0;
      highlight.visible = false;
      highlight.raycast = () => {};
    });
  }

  clearLastMove() {
    this.highlights.forEach((highlight) => {
      highlight.visible = false;
      highlight.removeFromParent();
    });
    this.lastMove = null;
  }

  showLastMove(move) {
    if (!move) {
      this.clearLastMove();
      return;
    }

    this.clearLastMove();
    this.lastMove = cloneMove(move);
    this.placeHighlight(this.highlights[0], move.fromFloor, move.fromRow, move.fromColumn);
    this.placeHighlight(this.highlights[1], move.toFloor, move.toRow, move.toColumn);
  }

  placeHighlight(highlight, floorKey, row, column) {
    const floor = this.floors.get(floorKey);
    if (!floor || !Number.isInteger(row) || !Number.isInteger(column)) return;

    highlight.position.set(
      boardX(column),
      0.1,
      boardZ(row),
    );
    floor.board.group.add(highlight);
    highlight.visible = true;
  }
}
