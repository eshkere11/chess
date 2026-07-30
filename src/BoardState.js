export class BoardState {
  constructor(size = 8, floorKeys = ['lower', 'middle', 'upper']) {
    this.size = size;
    this.grids = Object.fromEntries(floorKeys.map((key) => [key, this.createGrid()]));
    this.activeFloorKey = 'middle';
    this.grid = this.grids[this.activeFloorKey];
    this.enPassantTarget = null;
    this.halfmoveClock = 0;
    this.positionHistory = [];
  }

  createGrid() {
    return Array.from({ length: this.size }, () => Array(this.size).fill(null));
  }

  setActiveFloor(key) {
    if (!this.grids[key]) {
      throw new Error(`Unknown board floor: ${key}`);
    }
    this.activeFloorKey = key;
    this.grid = this.grids[key];
  }

  getGrid(key = this.activeFloorKey) {
    return this.grids[key];
  }

  placePiece(piece, row, column, floorKey = piece.board || this.activeFloorKey) {
    const grid = this.getGrid(floorKey);
    if (piece.row >= 0 && piece.column >= 0 && piece.row < this.size && piece.column < this.size) {
      const previousGrid = this.getGrid(piece.board);
      previousGrid[piece.row][piece.column] = null;
    }

    grid[row][column] = piece;
    piece.setFloor(floorKey);
    piece.setBoard(row, column);
    return piece;
  }

  movePiece(piece, row, column, floorKey = piece.board || this.activeFloorKey) {
    const grid = this.getGrid(floorKey);
    const fromRow = piece.row;
    const fromColumn = piece.column;

    if (fromRow >= 0 && fromColumn >= 0 && fromRow < this.size && fromColumn < this.size) {
      grid[fromRow][fromColumn] = null;
    }

    grid[row][column] = piece;
    piece.setBoard(row, column);
    piece.hasMoved = true;
    return piece;
  }

  setEnPassantTarget(target) {
    this.enPassantTarget = target ? { ...target } : null;
  }

  removePiece(piece, floorKey = piece.board) {
    const grid = this.getGrid(floorKey);
    if (piece.row >= 0 && piece.column >= 0 && piece.row < this.size && piece.column < this.size) {
      grid[piece.row][piece.column] = null;
    }
  }

  getPieceAt(row, column, floorKey = this.activeFloorKey) {
    if (row < 0 || row >= this.size || column < 0 || column >= this.size) {
      return null;
    }

    return this.getGrid(floorKey)[row][column];
  }

  isEmpty(row, column, floorKey = this.activeFloorKey) {
    return this.getPieceAt(row, column, floorKey) === null;
  }

  getPieceCount(floorKey) {
    return this.getGrid(floorKey).flat().filter(Boolean).length;
  }
}
