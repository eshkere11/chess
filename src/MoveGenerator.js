export class MoveGenerator {
  constructor(boardState) {
    this.boardState = boardState;
  }

  generateLegalMoves(piece) {
    if (!piece) {
      return [];
    }

    switch (piece.type) {
      case 'pawn':
        return this.generatePawnMoves(piece);
      case 'rook':
        return this.generateRookMoves(piece);
      case 'knight':
        return this.generateKnightMoves(piece);
      case 'bishop':
        return this.generateBishopMoves(piece);
      case 'queen':
        return this.generateQueenMoves(piece);
      case 'king':
        return this.generateKingMoves(piece);
      default:
        return [];
    }
  }

  generatePawnMoves(piece) {
    const moves = [];
    const direction = piece.color === 'white' ? -1 : 1;
    const startRow = piece.color === 'white' ? 6 : 1;

    const oneStepRow = piece.row + direction;
    if (oneStepRow >= 0 && oneStepRow < 8) {
      if (this.boardState.isEmpty(oneStepRow, piece.column, piece.board)) {
        moves.push({ row: oneStepRow, column: piece.column, type: 'move' });

        const twoStepRow = piece.row + direction * 2;
        if (piece.row === startRow && this.boardState.isEmpty(twoStepRow, piece.column, piece.board)) {
          moves.push({ row: twoStepRow, column: piece.column, type: 'move' });
        }
      }
    }

    [-1, 1].forEach((delta) => {
      const targetColumn = piece.column + delta;
      const targetRow = piece.row + direction;
      if (targetRow < 0 || targetRow >= 8 || targetColumn < 0 || targetColumn >= 8) {
        return;
      }

      const targetPiece = this.boardState.getPieceAt(targetRow, targetColumn, piece.board);
      if (targetPiece && targetPiece.color !== piece.color) {
        moves.push({ row: targetRow, column: targetColumn, type: 'capture' });
      }
    });

    const target = this.boardState.enPassantTarget;
    if (target && target.floor === piece.board && target.row === piece.row + direction && Math.abs(target.column - piece.column) === 1) {
      moves.push({ row: target.row, column: target.column, type: 'en-passant', capturedRow: piece.row, capturedColumn: target.column });
    }

    return moves;
  }

  generateRookMoves(piece) {
    return this.generateSlidingMoves(piece, [
      { row: -1, column: 0 },
      { row: 1, column: 0 },
      { row: 0, column: -1 },
      { row: 0, column: 1 },
    ]);
  }

  generateBishopMoves(piece) {
    return this.generateSlidingMoves(piece, [
      { row: -1, column: -1 },
      { row: -1, column: 1 },
      { row: 1, column: -1 },
      { row: 1, column: 1 },
    ]);
  }

  generateQueenMoves(piece) {
    return this.generateSlidingMoves(piece, [
      { row: -1, column: 0 },
      { row: 1, column: 0 },
      { row: 0, column: -1 },
      { row: 0, column: 1 },
      { row: -1, column: -1 },
      { row: -1, column: 1 },
      { row: 1, column: -1 },
      { row: 1, column: 1 },
    ]);
  }

  generateKnightMoves(piece) {
    return this.generateStepMoves(piece, [
      { row: -2, column: -1 },
      { row: -2, column: 1 },
      { row: -1, column: -2 },
      { row: -1, column: 2 },
      { row: 1, column: -2 },
      { row: 1, column: 2 },
      { row: 2, column: -1 },
      { row: 2, column: 1 },
    ]);
  }

  generateKingMoves(piece) {
    const moves = this.generateStepMoves(piece, [
      { row: -1, column: -1 },
      { row: -1, column: 0 },
      { row: -1, column: 1 },
      { row: 0, column: -1 },
      { row: 0, column: 1 },
      { row: 1, column: -1 },
      { row: 1, column: 0 },
      { row: 1, column: 1 },
    ]);
    if (!piece.hasMoved) {
      [
        { rookColumn: 7, path: [5, 6], target: 6, rookTarget: 5 },
        { rookColumn: 0, path: [3, 2, 1], target: 2, rookTarget: 3 },
      ].forEach((castle) => {
        const rook = this.boardState.getPieceAt(piece.row, castle.rookColumn, piece.board);
        if (rook?.type === 'rook' && rook.color === piece.color && !rook.hasMoved && castle.path.every((column) => this.boardState.isEmpty(piece.row, column, piece.board))) {
          moves.push({ row: piece.row, column: castle.target, type: 'castle', rookColumn: castle.rookColumn, rookTargetColumn: castle.rookTarget });
        }
      });
    }
    return moves;
  }

  generateStepMoves(piece, offsets) {
    const moves = [];

    offsets.forEach((offset) => {
      const row = piece.row + offset.row;
      const column = piece.column + offset.column;
      const targetPiece = this.boardState.getPieceAt(row, column, piece.board);

      if (!targetPiece) {
        if (row >= 0 && row < 8 && column >= 0 && column < 8) {
          moves.push({ row, column, type: 'move' });
        }
      } else if (targetPiece.color !== piece.color) {
        moves.push({ row, column, type: 'capture' });
      }
    });

    return moves;
  }

  generateSlidingMoves(piece, directions) {
    const moves = [];

    directions.forEach((direction) => {
      let nextRow = piece.row + direction.row;
      let nextColumn = piece.column + direction.column;

      while (nextRow >= 0 && nextRow < 8 && nextColumn >= 0 && nextColumn < 8) {
        const targetPiece = this.boardState.getPieceAt(nextRow, nextColumn, piece.board);
        if (!targetPiece) {
          moves.push({ row: nextRow, column: nextColumn, type: 'move' });
        } else {
          if (targetPiece.color !== piece.color) {
            moves.push({ row: nextRow, column: nextColumn, type: 'capture' });
          }
          break;
        }

        nextRow += direction.row;
        nextColumn += direction.column;
      }
    });

    return moves;
  }
}
