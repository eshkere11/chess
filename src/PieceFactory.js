import { ModelManager } from './ModelManager.js';
import { Piece } from './Piece.js';

export class PieceFactory {
  constructor(boardGroup) {
    this.boardGroup = boardGroup;
    this.modelManager = new ModelManager();
  }

  async create(type, color, row, column) {
    const modelMesh = await this.modelManager.clonePiece(color, type);
    const piece = new Piece(type, color, this.boardGroup, modelMesh);
    piece.setBoard(row, column);
    return piece;
  }

  async createStartingPosition(boardState) {
    const setup = [
      { type: 'rook', color: 'white', row: 7, column: 0 },
      { type: 'knight', color: 'white', row: 7, column: 1 },
      { type: 'bishop', color: 'white', row: 7, column: 2 },
      { type: 'queen', color: 'white', row: 7, column: 3 },
      { type: 'king', color: 'white', row: 7, column: 4 },
      { type: 'bishop', color: 'white', row: 7, column: 5 },
      { type: 'knight', color: 'white', row: 7, column: 6 },
      { type: 'rook', color: 'white', row: 7, column: 7 },
      ...Array.from({ length: 8 }, (_, column) => ({ type: 'pawn', color: 'white', row: 6, column })),
      { type: 'rook', color: 'black', row: 0, column: 0 },
      { type: 'knight', color: 'black', row: 0, column: 1 },
      { type: 'bishop', color: 'black', row: 0, column: 2 },
      { type: 'queen', color: 'black', row: 0, column: 3 },
      { type: 'king', color: 'black', row: 0, column: 4 },
      { type: 'bishop', color: 'black', row: 0, column: 5 },
      { type: 'knight', color: 'black', row: 0, column: 6 },
      { type: 'rook', color: 'black', row: 0, column: 7 },
      ...Array.from({ length: 8 }, (_, column) => ({ type: 'pawn', color: 'black', row: 1, column })),
    ];

    const pieces = await Promise.all(setup.map(async (definition) => {
      const piece = await this.create(definition.type, definition.color, definition.row, definition.column);
      boardState.placePiece(piece, definition.row, definition.column);
      return piece;
    }));

    return pieces;
  }
}
