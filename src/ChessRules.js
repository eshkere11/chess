export class ChessRules {
  constructor(boardState, moveGenerator) {
    this.boardState = boardState;
    this.moveGenerator = moveGenerator;
    this.floorKeys = Object.keys(boardState.grids);
  }

  generateLegalMoves(piece) {
    return this.moveGenerator.generateLegalMoves(piece)
      .filter((move) => {
        const target = this.boardState.getPieceAt(move.row, move.column, piece.board);
        return target?.type !== 'king'
          && (move.type !== 'castle' || this.isCastleLegal(piece, move))
          && !this.wouldLeaveKingInCheck(piece, move.row, move.column);
      });
  }

  isCastleLegal(king, move) {
    if (this.isKingInCheck(king.color)) return false;
    const opponent = king.color === 'white' ? 'black' : 'white';
    const step = Math.sign(move.column - king.column);
    return !this.isSquareAttacked(king.row, king.column + step, king.board, opponent)
      && !this.isSquareAttacked(king.row, move.column, king.board, opponent);
  }

  getAllLegalMoves(color) {
    return this.floorKeys.flatMap((floorKey) => this.getPieces(floorKey)
      .filter((piece) => piece.color === color)
      .flatMap((piece) => this.generateLegalMoves(piece)));
  }

  isKingInCheck(color) {
    const king = this.findKing(color);
    return king ? this.isSquareAttacked(king.row, king.column, king.board, color === 'white' ? 'black' : 'white') : false;
  }

  wouldLeaveKingInCheck(piece, row, column) {
    return this.isKingInCheckAfterSimulation(piece.color, {
      piece,
      sourceFloor: piece.board,
      destinationFloor: piece.board,
      fromRow: piece.row,
      fromColumn: piece.column,
      toRow: row,
      toColumn: column,
    });
  }

  wouldLeaveKingInCheckAfterTeleport(piece, destinationFloor) {
    return this.isKingInCheckAfterSimulation(piece.color, {
      piece,
      sourceFloor: piece.board,
      destinationFloor,
      fromRow: piece.row,
      fromColumn: piece.column,
      toRow: piece.row,
      toColumn: piece.column,
    });
  }

  isKingInCheckAfterSimulation(color, simulation) {
    const king = this.findKing(color, simulation);
    return king ? this.isSquareAttacked(king.row, king.column, king.board, color === 'white' ? 'black' : 'white', simulation) : false;
  }

  findKing(color, simulation) {
    for (const floorKey of this.floorKeys) {
      for (let row = 0; row < this.boardState.size; row += 1) {
        for (let column = 0; column < this.boardState.size; column += 1) {
          const piece = this.getPieceAt(row, column, floorKey, simulation);
          if (piece?.type === 'king' && piece.color === color) {
            return { ...piece, row, column, board: floorKey };
          }
        }
      }
    }
    return null;
  }

  isSquareAttacked(row, column, floorKey, byColor, simulation) {
    return this.getPieces(floorKey, simulation)
      .some((piece) => piece.color === byColor && this.pieceAttacksSquare(piece, row, column, floorKey, simulation));
  }

  getPieces(floorKey, simulation) {
    if (!simulation) return this.boardState.getGrid(floorKey).flat().filter(Boolean);
    const pieces = [];
    for (let row = 0; row < this.boardState.size; row += 1) {
      for (let column = 0; column < this.boardState.size; column += 1) {
        const piece = this.getPieceAt(row, column, floorKey, simulation);
        if (piece) pieces.push({ ...piece, row, column, board: floorKey });
      }
    }
    return pieces;
  }

  getPieceAt(row, column, floorKey, simulation) {
    if (!simulation) return this.boardState.getPieceAt(row, column, floorKey);
    const { piece, sourceFloor, destinationFloor, fromRow, fromColumn, toRow, toColumn } = simulation;

    if (floorKey === sourceFloor && row === fromRow && column === fromColumn) return null;
    if (floorKey === destinationFloor && row === toRow && column === toColumn) return piece;
    return this.boardState.getPieceAt(row, column, floorKey);
  }

  pieceAttacksSquare(piece, targetRow, targetColumn, floorKey, simulation) {
    const rowDelta = targetRow - piece.row;
    const columnDelta = targetColumn - piece.column;

    if (piece.type === 'pawn') {
      const direction = piece.color === 'white' ? -1 : 1;
      return rowDelta === direction && Math.abs(columnDelta) === 1;
    }
    if (piece.type === 'knight') {
      return Math.abs(rowDelta) * Math.abs(columnDelta) === 2;
    }
    if (piece.type === 'king') {
      return Math.max(Math.abs(rowDelta), Math.abs(columnDelta)) === 1;
    }

    const isStraight = rowDelta === 0 || columnDelta === 0;
    const isDiagonal = Math.abs(rowDelta) === Math.abs(columnDelta);
    const canSlide = (piece.type === 'rook' && isStraight)
      || (piece.type === 'bishop' && isDiagonal)
      || (piece.type === 'queen' && (isStraight || isDiagonal));
    if (!canSlide || (rowDelta === 0 && columnDelta === 0)) return false;

    const rowStep = Math.sign(rowDelta);
    const columnStep = Math.sign(columnDelta);
    let row = piece.row + rowStep;
    let column = piece.column + columnStep;
    while (row !== targetRow || column !== targetColumn) {
      if (this.getPieceAt(row, column, floorKey, simulation)) return false;
      row += rowStep;
      column += columnStep;
    }
    return true;
  }
}
