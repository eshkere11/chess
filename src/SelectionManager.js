export class SelectionManager {
  constructor(boardState, turnManager, highlightManager, animationManager, onMoveComplete, onMoveStart) {
    this.boardState = boardState;
    this.turnManager = turnManager;
    this.highlightManager = highlightManager;
    this.animationManager = animationManager;
    this.onMoveComplete = onMoveComplete;
    this.onMoveStart = onMoveStart;
    this.canControlPiece = null;
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

    if (this.canControlPiece && !this.canControlPiece(piece)) {
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

    return this.executeMove(this.selectedPiece, move);
  }

  executeMove(piece, move) {
    if (!piece || !move || this.animationManager.isAnimating || !this.turnManager.canMove(piece.color)) {
      return false;
    }
    const capturedPiece = move.type === 'en-passant'
      ? this.boardState.getPieceAt(move.capturedRow, move.capturedColumn, piece.board)
      : this.boardState.getPieceAt(move.row, move.column, piece.board);
    const fromRow = piece.row;
    const fromColumn = piece.column;
    this.onMoveStart?.(piece, capturedPiece, fromRow, fromColumn, move.row, move.column);
    this.clearSelection();
    this.animationManager.animateMove(piece, move.row, move.column, () => {
      if (capturedPiece && capturedPiece !== piece) {
        capturedPiece.root.removeFromParent();
      }
      this.boardState.movePiece(piece, move.row, move.column);
      Promise.resolve(this.onMoveComplete?.(piece, capturedPiece, fromRow, fromColumn, move.row, move.column, move))
        .then(() => this.turnManager.advanceTurn());
    });

    return true;
  }
}
