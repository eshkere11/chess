const cloneAndFreeze = (value) => deepFreeze(JSON.parse(JSON.stringify(value)));

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
};

export class GameStateEngine {
  constructor(game) {
    this.game = game;
    this.nextPieceId = 1;
    this.isRestoring = false;
  }

  assignPieceId(piece) {
    if (!piece.id) piece.id = `piece-${this.nextPieceId++}`;
    return piece.id;
  }

  serialize() {
    const { game } = this;
    game.pieces.forEach((piece) => this.assignPieceId(piece));
    const capturedBy = new Map();
    Object.entries(game.capturedPieces).forEach(([color, pieces]) => pieces.forEach((piece) => capturedBy.set(piece.id, color)));
    const pieces = game.pieces.map((piece) => ({
      id: piece.id,
      type: piece.type,
      color: piece.color,
      board: piece.board,
      row: piece.row,
      column: piece.column,
      hasMoved: piece.hasMoved,
      inPlay: Boolean(piece.root.parent),
      capturedBy: capturedBy.get(piece.id) || null,
    }));
    const elevators = Object.fromEntries(game.floors.map((floor) => [floor.key, floor.elevators.map((elevator) => ({
      row: elevator.row,
      column: elevator.column,
      homeRookId: elevator.homeRook?.id || null,
      occupantId: elevator.occupant?.id || null,
      cooldownActive: elevator.cooldownActive,
    }))]));
    const camera = game.cameraController.getGameplayTransform();
    return cloneAndFreeze({
      version: 1,
      pieces,
      capturedPieces: Object.fromEntries(Object.entries(game.capturedPieces).map(([color, entries]) => [color, entries.map((piece) => piece.id)])),
      board: {
        activeFloorKey: game.boardState.activeFloorKey,
        enPassantTarget: game.boardState.enPassantTarget,
        halfmoveClock: game.boardState.halfmoveClock,
        positionHistory: game.boardState.positionHistory,
        castlingRights: Object.fromEntries(['white', 'black'].map((color) => [color, game.pieces
          .filter((piece) => piece.color === color && (piece.type === 'king' || piece.type === 'rook'))
          .map((piece) => ({ id: piece.id, hasMoved: piece.hasMoved }))])),
      },
      turn: { currentTurn: game.turnManager.currentTurn, turnNumber: game.turnManager.turnNumber },
      elevators,
      cooldowns: game.elevatorCooldowns,
      cooldownFloors: game.elevatorCooldownFloors,
      camera: {
        position: camera.position.toArray(),
        target: camera.target.toArray(),
        quaternion: camera.quaternion.toArray(),
      },
      sidebar: { history: game.moveHistory, material: game.getMaterialScore() },
      lastMove: game.lastMoveHighlightManager?.lastMove ? { ...game.lastMoveHighlightManager.lastMove } : null,
      selection: { selectedPieceId: game.selectionManager.selectedPiece?.id || null },
      game: { gameOver: Boolean(game.gameOver), gameResult: game.gameResult, startupState: game.startupState },
    });
  }

  capture() {
    return this.serialize();
  }

  async restore(snapshot) {
    if (!snapshot?.version) throw new Error('Invalid game-state snapshot.');
    const { game } = this;
    this.isRestoring = true;
    game.inputManager.setEnabled(false);
    game.selectionManager.clearSelection();
    game.closeDestinationOverlay();
    game.pieces.forEach((piece) => piece.root.removeFromParent());
    Object.keys(game.boardState.grids).forEach((key) => { game.boardState.grids[key] = game.boardState.createGrid(); });

    const pieces = await Promise.all(snapshot.pieces.map(async (state) => {
      const piece = await game.pieceFactory.create(state.type, state.color, state.row, state.column);
      piece.id = state.id;
      piece.setFloor(state.board);
      piece.setBoard(state.row, state.column);
      piece.hasMoved = state.hasMoved;
      piece.setSelected(false);
      if (!state.inPlay) piece.root.removeFromParent();
      else {
        game.getFloor(state.board).board.group.add(piece.root);
        game.boardState.grids[state.board][state.row][state.column] = piece;
      }
      return piece;
    }));
    game.pieces = pieces;
    this.nextPieceId = Math.max(this.nextPieceId, ...pieces.map((piece) => Number(piece.id.split('-')[1]) + 1).filter(Number.isFinite));
    const piecesById = new Map(pieces.map((piece) => [piece.id, piece]));
    game.capturedPieces = Object.fromEntries(Object.entries(snapshot.capturedPieces).map(([color, ids]) => [color, ids.map((id) => piecesById.get(id)).filter(Boolean)]));
    game.boardState.enPassantTarget = snapshot.board.enPassantTarget ? { ...snapshot.board.enPassantTarget } : null;
    game.boardState.halfmoveClock = snapshot.board.halfmoveClock;
    game.boardState.positionHistory = [...snapshot.board.positionHistory];
    game.boardState.setActiveFloor(snapshot.board.activeFloorKey);
    game.turnManager.currentTurn = snapshot.turn.currentTurn;
    game.turnManager.turnNumber = snapshot.turn.turnNumber;
    game.elevatorCooldowns = { ...snapshot.cooldowns };
    game.elevatorCooldownFloors = { ...snapshot.cooldownFloors };
    game.moveHistory = snapshot.sidebar.history.map((entry) => ({ ...entry }));
    game.lastMoveHighlightManager?.showLastMove(snapshot.lastMove || null);
    game.gameOver = snapshot.game.gameOver;
    game.gameResult = snapshot.game.gameResult ? { ...snapshot.game.gameResult } : null;

    game.floors.forEach((floor) => floor.elevators.forEach((elevator) => {
      const state = snapshot.elevators[floor.key].find((entry) => entry.row === elevator.row && entry.column === elevator.column);
      elevator.homeRook = state?.homeRookId ? piecesById.get(state.homeRookId) || null : null;
      elevator.clearOccupant();
    }));
    game.refreshElevatorCooldowns();
    game.refreshElevatorOccupancy();
    game.setFocusedInputFloor(game.floors.indexOf(game.getFloor(snapshot.board.activeFloorKey)));
    game.cameraController.restoreTransform(snapshot.camera);
    game.gameStatusUI.querySelector('.game-status-ui__end').classList.toggle('is-visible', game.gameOver);
    game.gameStatusUI.querySelector('.game-status-ui__check').classList.toggle('is-visible', game.chessRules.isKingInCheck(game.turnManager.currentTurn) && !game.gameOver);
    const selectedPiece = snapshot.selection.selectedPieceId ? piecesById.get(snapshot.selection.selectedPieceId) : null;
    if (!game.isReplayMode && selectedPiece?.root.parent) game.selectionManager.selectPiece(selectedPiece);
    game.inputManager.setEnabled(!game.gameOver && game.startupState === 'playing' && !game.isReplayMode);
    game.updateSidebar();
    this.isRestoring = false;
  }
}
