export class SelectionManager {
  constructor(boardState, turnManager, highlightManager, animationManager, onMoveComplete) {
    this.boardState = boardState;
    this.turnManager = turnManager;
    this.highlightManager = highlightManager;
    this.animationManager = animationManager;
    this.onMoveComplete = onMoveComplete;
    this.selectedPiece = null;
  }

  selectPiece(piece) {
    if (this.animationManager.isAnimating) {
      return false;
    }

    if (!piece) {
      this.clearSelection();
      return false;
    }

    if (!this.turnManager.canMove(piece.color)) {
      return false;
    }

    this.clearSelection();
    this.selectedPiece = piece;
    piece.setSelected(true);
    this.highlightManager.showForPiece(piece);
    return true;
  }

  clearSelection() {
    if (this.selectedPiece) {
      this.selectedPiece.setSelected(false);
    }

    this.selectedPiece = null;
    this.highlightManager.clearHighlights();
  }

  handleSquareSelection(row, column) {
    if (!this.selectedPiece || this.animationManager.isAnimating) {
      return false;
    }

    const move = this.highlightManager.getMoveAt(row, column);
    if (!move) {
      this.clearSelection();
      return false;
    }

    const piece = this.selectedPiece;
    const capturedPiece = this.boardState.getPieceAt(row, column, piece.board);
    const fromRow = piece.row;
    const fromColumn = piece.column;
    this.clearSelection();
    this.animationManager.animateMove(piece, row, column, () => {
      if (capturedPiece && capturedPiece !== piece) {
        capturedPiece.root.removeFromParent();
      }
      this.boardState.movePiece(piece, row, column);
      this.onMoveComplete?.(piece, capturedPiece, fromRow, fromColumn, row, column);
      this.turnManager.advanceTurn();
    });

    return true;
  }
}
