import { Raycaster, Vector2 } from 'three';

export class InputManager {
  constructor(renderer, boardGroup, selectionManager, boardState, onElevatorActivate) {
    this.renderer = renderer;
    this.boardGroup = boardGroup;
    this.selectionManager = selectionManager;
    this.boardState = boardState;
    this.onElevatorActivate = onElevatorActivate;
    this.enabled = true;
    this.raycaster = new Raycaster();
    this.pointer = new Vector2();
    this.boundHandler = this.onPointerDown.bind(this);
    this.boundKeyHandler = this.onKeyDown.bind(this);
    this.renderer.renderer.domElement.addEventListener('pointerdown', this.boundHandler);
    window.addEventListener('keydown', this.boundKeyHandler);
  }

  onPointerDown(event) {
    if (!this.enabled) return;
    const rect = this.renderer.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.renderer.camera);
    const intersects = this.raycaster.intersectObjects(this.boardGroup.children, true);

    if (!intersects.length) {
      this.selectionManager.clearSelection();
      return;
    }

    const intersect = intersects.find((entry) => entry.object.userData?.piece);
    if (intersect?.object?.userData?.piece) {
      const piece = intersect.object.userData.piece;
      const row = piece.row;
      const column = piece.column;
      const isSelected = this.selectionManager.selectedPiece === piece;

      if (this.selectionManager.selectedPiece && piece.color !== this.selectionManager.selectedPiece.color) {
        this.selectionManager.handleSquareSelection(row, column);
        return;
      }

      if (isSelected) {
        this.selectionManager.clearSelection();
        return;
      }

      if (this.selectionManager.selectPiece(piece)) {
        return;
      }

      if (row !== undefined && column !== undefined) {
        this.selectionManager.clearSelection();
      }
      return;
    }

    const boardPosition = this.getBoardPositionFromPointer(event);
    if (boardPosition) {
      this.selectionManager.handleSquareSelection(boardPosition.row, boardPosition.column);
    }
  }

  onKeyDown(event) {
    if (!this.enabled) return;
    if (event.key.toLowerCase() !== 'e' || event.repeat) {
      return;
    }

    const piece = this.selectionManager.selectedPiece;
    if (piece?.elevator) {
      this.onElevatorActivate?.(piece);
    }
  }

  setBoardGroup(boardGroup) {
    this.boardGroup = boardGroup;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  getBoardPositionFromPointer(event) {
    const rect = this.renderer.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.renderer.camera);

    const intersects = this.raycaster.intersectObject(this.boardGroup, true);
    const intersection = intersects[0];
    if (!intersection) {
      return null;
    }

    const row = Math.round((3.5 - intersection.point.z / 1.2));
    const column = Math.round(intersection.point.x / 1.2 + 3.5);
    if (row < 0 || row >= 8 || column < 0 || column >= 8) {
      return null;
    }

    return { row, column };
  }

  dispose() {
    this.renderer.renderer.domElement.removeEventListener('pointerdown', this.boundHandler);
    window.removeEventListener('keydown', this.boundKeyHandler);
  }
}
