import { Floor } from './Floor.js';
import { Renderer } from './Renderer.js';
import { CameraController } from './CameraController.js';
import { FloorManager } from './FloorManager.js';
import { FLOOR_COUNT } from './constants.js';
import { BoardState } from './BoardState.js';
import { PieceFactory } from './PieceFactory.js';
import { MoveGenerator } from './MoveGenerator.js';
import { ChessRules } from './ChessRules.js';
import { HighlightManager } from './HighlightManager.js';
import { LastMoveHighlightManager } from './LastMoveHighlightManager.js';
import { TurnManager } from './TurnManager.js';
import { SelectionManager } from './SelectionManager.js';
import { InputManager } from './InputManager.js';
import { AnimationManager } from './AnimationManager.js';
import { ELEVATOR_STATES } from './ElevatorPlatform.js';
import { GameStateEngine } from './GameStateEngine.js';
import { SkyChessMoveProvider } from './SkyChessMoveProvider.js';
import { SkyEnvironment } from './SkyEnvironment.js';
import { AudioManager } from './AudioManager.js';

export class Game {
  constructor(container) {
    this.renderer = new Renderer(container);
    this.cameraController = new CameraController(this.renderer.camera, this.renderer.renderer.domElement);
    this.audioManager = new AudioManager();
    this.startupState = 'menu';
    this.playerColor = 'white';
    this.aiColor = null;

    this.createWorld();
  }

  createWorld() {
    this.floors = [];
    for (let index = 0; index < FLOOR_COUNT; index += 1) {
      const floor = new Floor(index, this.renderer.scene);
      this.floors.push(floor);
    }

    this.floorManager = new FloorManager(this.floors);

    this.middleFloor = this.floors.find((floor) => floor.key === 'middle');
    this.middleBoardGroup = this.middleFloor?.board?.group;

    this.boardState = new BoardState();
    this.turnManager = new TurnManager();
    this.moveHistory = [];
    this.snapshots = [];
    this.replaySnapshots = [];
    this.replayIndex = 0;
    this.isReplayMode = false;
    this.replaySpeed = 1;
    this.replayTimer = null;
    this.elevatorCooldowns = { white: 0, black: 0 };
    this.elevatorCooldownFloors = { white: null, black: null };
    this.capturedPieces = { white: [], black: [] };
    this.animationManager = new AnimationManager();
    this.pieceFactory = new PieceFactory(this.middleBoardGroup);
    this.moveGenerator = new MoveGenerator(this.boardState);
    this.chessRules = new ChessRules(this.boardState, this.moveGenerator);
    this.highlightManager = new HighlightManager(this.middleBoardGroup);
    this.highlightManager.setMoveGenerator(this.chessRules);
    this.lastMoveHighlightManager = new LastMoveHighlightManager(this.floors);
    this.selectionManager = new SelectionManager(
      this.boardState,
      this.turnManager,
      this.highlightManager,
      this.animationManager,
      (piece, capturedPiece, fromRow, fromColumn, toRow, toColumn, move) => {
        if (move.type === 'en-passant' && capturedPiece) {
          capturedPiece.root.removeFromParent();
          this.boardState.removePiece(capturedPiece, piece.board);
        }
        if (capturedPiece) this.addCapturedPiece(capturedPiece, piece.color);
        let castleAnimation = null;
        if (move.type === 'castle') {
          const rook = this.boardState.getPieceAt(fromRow, move.rookColumn, piece.board);
          if (rook) {
            const rookStart = rook.root.position.clone();
            this.boardState.movePiece(rook, fromRow, move.rookTargetColumn, piece.board);
            rook.root.position.copy(rookStart);
            castleAnimation = new Promise((resolve) => this.animationManager.animateMove(rook, fromRow, move.rookTargetColumn, resolve));
          }
        }
        const movedTwoSquares = piece.type === 'pawn' && Math.abs(toRow - fromRow) === 2;
        this.boardState.halfmoveClock = piece.type === 'pawn' || capturedPiece
          ? 0
          : this.boardState.halfmoveClock + 1;
        this.boardState.setEnPassantTarget(movedTwoSquares ? {
          row: (fromRow + toRow) / 2,
          column: fromColumn,
          floor: piece.board,
        } : null);
        this.getFloor(piece.board).updateElevatorsForMove(piece, capturedPiece, fromRow, fromColumn, toRow, toColumn);
          this.consumeElevatorCooldownMove(piece.color);
          if (move.type === 'castle') this.audioManager.playCastle();
          else if (capturedPiece) this.audioManager.playCapture();
          else this.audioManager.playMove();
          this.recordNormalMove(piece, capturedPiece, fromRow, fromColumn, toRow, toColumn);
          this.lastMoveHighlightManager.showLastMove({
            fromFloor: piece.board,
            fromRow,
            fromColumn,
            toFloor: piece.board,
            toRow,
            toColumn,
          });
          const promotion = piece.type === 'pawn' && (toRow === 0 || toRow === 7)
          ? this.requestPromotion(piece, move.promotion)
          : Promise.resolve();
        return Promise.all([castleAnimation, promotion]);
      },
      () => this.captureSnapshot(),
    );
    this.selectionManager.canControlPiece = (piece) => this.players?.[piece.color]?.type === 'human';
    this.turnManager.onTurnAdvanced(() => {
      this.recordPosition();
      this.evaluateGameState();
      this.recordReplaySnapshot();
      if (this.players?.[this.turnManager.currentTurn]?.type === 'human' && !this.gameOver) this.inputManager.setEnabled(true);
      this.requestComputerMove();
    });
    this.inputManager = new InputManager(
      this.renderer,
      this.middleBoardGroup,
      this.selectionManager,
      this.boardState,
      (piece) => this.openElevatorSelection(piece),
    );
    this.inputManager.setEnabled(false);
    this.cameraController.setEnabled(false);
    this.cameraController.setFloorFocusHandler((floorIndex) => this.setFocusedInputFloor(floorIndex));
    this.cameraController.setFloorNavigationHandler(() => this.getOccupiedFloorCycle());
    window.addEventListener('IntroHalfway', () => this.audioManager.fadeOutIntroWind(3000));
    window.addEventListener('IntroFinished', () => this.audioManager.fadeOutIntroWind(700));
    this.cameraController.focusFloor(this.middleFloor.baseY);
    this.createDestinationOverlay();
    this.createGameStatusUI();
    this.createPromotionDialog();
    this.pieces = [];
    this.stateEngine = new GameStateEngine(this);
    this.loadStartingPosition();

    this.skyEnvironment = new SkyEnvironment(this.renderer.scene);
  }

  async loadStartingPosition() {
    try {
      this.pieces = await this.pieceFactory.createStartingPosition(this.boardState);
      this.pieces.forEach((piece) => this.stateEngine.assignPieceId(piece));
      this.middleFloor.initializeElevators(this.boardState);
      this.recordPosition();
      this.refreshElevatorOccupancy();
      this.recordReplaySnapshot();
      this.updateSidebar();
    } catch (error) {
      console.error('Unable to load chess piece models.', error);
    }
  }

  getFloor(key) {
    return this.floors.find((floor) => floor.key === key);
  }

  activateFloor(key) {
    const floor = this.getFloor(key);
    if (!floor) return;
    this.floorManager.setActiveFloor(key);
    this.boardState.setActiveFloor(key);
    this.inputManager.setBoardGroup(floor.board.group);
    this.highlightManager.setBoardGroup(floor.board.group);
    this.cameraController.focusFloor(floor.baseY);
  }

  setFocusedInputFloor(floorIndex) {
    const floor = this.floors[floorIndex];
    if (!floor) return;
    this.floorManager.setActiveFloor(floor.key);
    this.boardState.setActiveFloor(floor.key);
    this.inputManager.setBoardGroup(floor.board.group);
    this.highlightManager.setBoardGroup(floor.board.group);
    this.highlightManager.setMoveGenerator(this.chessRules);
    this.updateSidebar();
  }

  getOccupiedFloorCycle() {
    const cycle = [this.floors.indexOf(this.middleFloor)];
    const upperFloor = this.getFloor('upper');
    const lowerFloor = this.getFloor('lower');

    if (this.boardState.getPieceCount(upperFloor.key) > 0) {
      cycle.push(this.floors.indexOf(upperFloor), this.floors.indexOf(this.middleFloor));
    }
    if (this.boardState.getPieceCount(lowerFloor.key) > 0) {
      cycle.push(this.floors.indexOf(lowerFloor));
    }
    return cycle;
  }

  refreshElevatorCooldowns() {
    this.floors.forEach((floor) => {
      const floorIsCoolingDown = Object.keys(this.elevatorCooldowns).some((color) => (
        this.elevatorCooldowns[color] > 0 && this.elevatorCooldownFloors[color] === floor.key
      ));
      floor.elevators.forEach((elevator) => elevator.setCooldownActive(floorIsCoolingDown));
    });
  }

  refreshElevatorOccupancy() {
    this.floors.forEach((floor) => {
      floor.elevators.forEach((elevator) => {
        const localPiece = this.boardState.getPieceAt(elevator.row, elevator.column, floor.key);
        const floorIndex = this.floors.indexOf(floor);
        const destinations = this.floors.filter((linkedFloor, index) => Math.abs(index - floorIndex) === 1);
        const occupiedDestinationCount = destinations.filter((destinationFloor) => (
          Boolean(this.boardState.getPieceAt(elevator.row, elevator.column, destinationFloor.key))
        )).length;
        const everyDestinationIsOccupied = destinations.length > 0 && occupiedDestinationCount === destinations.length;
        const middlePortalIsOccupied = Boolean(this.boardState.getPieceAt(elevator.row, elevator.column, 'middle'));
        const homeRookIsBlocking = floor.key === 'middle' && localPiece === elevator.homeRook;
        elevator.syncOccupant(localPiece);
        // Middle portals show route availability; upper/lower portals are blocked
        // when their matching middle-floor destination is occupied.
        elevator.setVisualOccupied(floor.key === 'middle'
          ? homeRookIsBlocking || (Boolean(localPiece) && everyDestinationIsOccupied)
          : middlePortalIsOccupied);
        elevator.setPartialActive(floor.key === 'middle' && occupiedDestinationCount === 1);
      });
    });
  }

  startElevatorCooldown(color, floorKey) {
    this.elevatorCooldowns[color] = 2;
    this.elevatorCooldownFloors[color] = floorKey;
    this.refreshElevatorCooldowns();
  }

  consumeElevatorCooldownMove(color) {
    if (this.elevatorCooldowns[color] === 0) return;
    this.elevatorCooldowns[color] -= 1;
    if (this.elevatorCooldowns[color] === 0) this.elevatorCooldownFloors[color] = null;
    this.refreshElevatorCooldowns();
  }

  createGameStatusUI() {
    this.gameStatusUI = document.createElement('div');
    this.gameStatusUI.className = 'game-status-ui';
    this.gameStatusUI.innerHTML = `
      <div class="game-status-ui__check" aria-live="polite">CHECK</div>
      <div class="game-status-ui__turn-intro" aria-live="polite"></div>
      <div class="game-status-ui__end-backdrop"></div>
      <div class="game-status-ui__end" role="dialog" aria-live="assertive">
        <strong></strong><span></span>
        <div class="game-status-ui__end-actions">
          <button type="button" data-end-action="play-again">Play Again</button>
          <button type="button" data-end-action="replay">Replay Game</button>
          <button type="button" data-end-action="main-menu">Return to Main Menu</button>
        </div>
      </div>`;
    this.gameStatusUI.addEventListener('click', (event) => {
      const action = event.target.closest('[data-end-action]')?.dataset.endAction;
      if (action === 'play-again') this.restartGame();
      if (action === 'replay') this.replayCompletedGame();
      if (action === 'main-menu') this.returnToMainMenu();
    });
    this.renderer.container.appendChild(this.gameStatusUI);
  }

  createPromotionDialog() {
    this.promotionDialog = document.createElement('div');
    this.promotionDialog.className = 'promotion-dialog';
    this.promotionDialog.innerHTML = '<div><strong>Promote Pawn</strong><span>Choose a piece</span><section><button data-piece="queen">Queen</button><button data-piece="rook">Rook</button><button data-piece="bishop">Bishop</button><button data-piece="knight">Knight</button></section></div>';
    this.promotionDialog.addEventListener('click', (event) => {
      const type = event.target.closest('button')?.dataset.piece;
      if (type) this.completePromotion(type);
    });
    this.renderer.container.appendChild(this.promotionDialog);
  }

  requestPromotion(piece, preferredType = null) {
    const automaticType = preferredType || (this.players?.[piece.color]?.type === 'stockfish' ? 'queen' : null);
    if (automaticType) {
      this.pendingPromotion = piece;
      return this.completePromotion(automaticType, false);
    }
    this.inputManager.setEnabled(false);
    this.pendingPromotion = piece;
    this.promotionDialog.classList.add('is-visible');
    return new Promise((resolve) => { this.resolvePromotion = resolve; });
  }

  async completePromotion(type, restoreInput = true) {
    const pawn = this.pendingPromotion;
    if (!pawn) return;
    const floor = this.getFloor(pawn.board);
    const promoted = await this.pieceFactory.create(type, pawn.color, pawn.row, pawn.column);
    this.stateEngine.assignPieceId(promoted);
    promoted.root.removeFromParent();
    promoted.setFloor(pawn.board);
    promoted.setBoard(pawn.row, pawn.column);
    promoted.hasMoved = true;
    floor.board.group.add(promoted.root);
    this.boardState.grids[pawn.board][pawn.row][pawn.column] = promoted;
    pawn.root.removeFromParent();
    this.pieces = this.pieces.filter((piece) => piece !== pawn);
    this.pieces.push(promoted);
    this.promotionDialog.classList.remove('is-visible');
    this.pendingPromotion = null;
    this.audioManager.playPromotion();
    if (restoreInput) this.inputManager.setEnabled(true);
    this.resolvePromotion?.();
    this.resolvePromotion = null;
  }

  addCapturedPiece(piece, capturerColor) {
    const pieces = this.capturedPieces[capturerColor];
    pieces.push(piece);
    piece.root.removeFromParent();
    this.updateSidebar();
  }

  getMaterialScore() {
    const values = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };
    const score = { white: 0, black: 0 };
    Object.values(this.boardState.grids).flatMap((grid) => grid.flat()).filter(Boolean).forEach((piece) => { score[piece.color] += values[piece.type]; });
    const difference = score.white - score.black;
    return difference === 0 ? 'Equal' : difference > 0 ? `White +${difference}` : `Black +${-difference}`;
  }

  getPositionKey() {
    const board = Object.keys(this.boardState.grids).map((floor) => this.boardState.getGrid(floor).flat().map((piece) => piece ? `${piece.color[0]}${piece.type[0]}` : '--').join('')).join('|');
    return `${board}:${this.turnManager.currentTurn}`;
  }

  recordPosition() {
    this.boardState.positionHistory.push(this.getPositionKey());
  }

  hasInsufficientMaterial() {
    const pieces = Object.values(this.boardState.grids).flatMap((grid) => grid.flat()).filter((piece) => piece && piece.type !== 'king');
    return pieces.length === 0 || (pieces.length === 1 && ['bishop', 'knight'].includes(pieces[0].type));
  }

  setSidebar(sidebar) {
    this.sidebar = sidebar;
    this.sidebar.setIntroVisible(this.startupState === 'playing');
    window.requestAnimationFrame(() => this.renderer.resize());
    window.setTimeout(() => this.renderer.resize(), 600);
    this.updateSidebar();
  }

  updateSidebar() {
    if (!this.sidebar) return;
    const floor = this.getFloor(this.floorManager?.activeFloorKey || 'middle');
    const status = this.gameResult?.title || (this.chessRules?.isKingInCheck(this.turnManager.currentTurn) ? 'Check' : 'Normal');
    this.sidebar.update({
      turn: `${this.turnManager?.currentTurn === 'black' ? 'Black' : 'White'} to Move`,
      floor: floor ? `${floor.key[0].toUpperCase()}${floor.key.slice(1)} Floor` : 'Middle Floor',
      status,
      material: this.getMaterialScore(),
      history: this.moveHistory || [],
      captured: this.capturedPieces,
      canUndo: Boolean(this.snapshots?.length) && !this.animationManager?.isAnimating && !this.gameOver,
      replay: {
        active: this.isReplayMode,
        index: this.replayIndex,
        total: Math.max(0, this.replaySnapshots.length - 1),
        speed: this.replaySpeed,
        playing: Boolean(this.replayTimer),
      },
      players: this.players,
      aiStatus: this.aiStatus || 'ready',
    });
  }

  formatSquare(row, column) {
    return `${String.fromCharCode(97 + column)}${8 - row}`;
  }

  formatPiece(piece) {
    return piece.type[0].toUpperCase() + piece.type.slice(1);
  }

  recordNormalMove(piece, capturedPiece, fromRow, fromColumn, toRow, toColumn) {
    const origin = this.formatSquare(fromRow, fromColumn);
    const destination = this.formatSquare(toRow, toColumn);
    const text = capturedPiece
      ? `${this.formatPiece(piece)} × ${this.formatPiece(capturedPiece)} (${origin}–${destination})`
      : `${this.formatPiece(piece)} ${origin}–${destination}`;
    this.moveHistory.push({
      type: 'move', piece: piece.type, color: piece.color, origin, destination,
      capture: capturedPiece?.type || null, floor: piece.board, turnNumber: this.turnManager.turnNumber + 1, text,
    });
    this.updateSidebar();
  }

  recordTeleport(piece, sourceFloor, destinationFloor, row, column, turnNumber) {
    const square = this.formatSquare(row, column);
    this.moveHistory.push({
      type: 'teleport', piece: piece.type, color: piece.color, origin: square, destination: square,
      sourceFloor: sourceFloor.key, destinationFloor: destinationFloor.key, turnNumber,
      text: `Teleport: ${this.formatPiece(piece)} ${sourceFloor.key[0].toUpperCase()}${sourceFloor.key.slice(1)} → ${destinationFloor.key[0].toUpperCase()}${destinationFloor.key.slice(1)}`,
    });
    this.updateSidebar();
  }

  captureSnapshot() {
    if (this.animationManager.isAnimating || !this.pieces.length || this.stateEngine.isRestoring) return;
    this.snapshots.push(this.stateEngine.capture());
  }

  recordReplaySnapshot() {
    if (this.stateEngine.isRestoring || !this.pieces.length) return;
    this.replaySnapshots.push(this.stateEngine.capture());
    this.replayIndex = this.replaySnapshots.length - 1;
  }

  async enterReplay(index = this.replaySnapshots.length - 1) {
    if (!this.replaySnapshots.length || this.animationManager.isAnimating) return;
    this.pauseReplay();
    this.isReplayMode = true;
    this.selectionManager.clearSelection();
    this.inputManager.setEnabled(false);
    await this.restoreReplaySnapshot(index);
  }

  async restoreReplaySnapshot(index) {
    if (!this.isReplayMode || !this.replaySnapshots.length || this.stateEngine.isRestoring) return;
    this.replayIndex = Math.max(0, Math.min(index, this.replaySnapshots.length - 1));
    await this.stateEngine.restore(this.replaySnapshots[this.replayIndex]);
    this.highlightReplayMove(this.replayIndex);
    this.updateSidebar();
  }

  highlightReplayMove(index) {
    if (index === 0) {
      this.highlightManager.clearHighlights();
      return;
    }
    const entry = this.moveHistory[index - 1];
    if (!entry) return;
    this.highlightManager.showReplayMove(entry);
    if (entry.type === 'teleport') {
      const [, file, rank] = /^([a-h])(\d)$/.exec(entry.origin) || [];
      if (file && rank) {
        const row = 8 - Number(rank);
        const column = file.charCodeAt(0) - 97;
        this.getFloor(entry.sourceFloor)?.getElevatorAt(row, column)?.flash();
        this.getFloor(entry.destinationFloor)?.getElevatorAt(row, column)?.flash();
      }
    }
  }

  handleReplayControl(action, value) {
    if (action === 'history') return this.enterReplay(Number(value) + 1);
    if (action === 'enter') return this.enterReplay();
    if (!this.isReplayMode && action !== 'exit') return undefined;
    if (action === 'first') return this.restoreReplaySnapshot(0);
    if (action === 'previous') return this.restoreReplaySnapshot(this.replayIndex - 1);
    if (action === 'next') return this.restoreReplaySnapshot(this.replayIndex + 1);
    if (action === 'last') return this.restoreReplaySnapshot(this.replaySnapshots.length - 1);
    if (action === 'play') return this.playReplay();
    if (action === 'pause') return this.pauseReplay();
    if (action === 'toggle') return this.replayTimer ? this.pauseReplay() : this.playReplay();
    if (action === 'speed') {
      this.replaySpeed = Number(value);
      this.updateSidebar();
      return undefined;
    }
    if (action === 'exit') return this.exitReplay();
    return undefined;
  }

  playReplay() {
    if (!this.isReplayMode || this.replayIndex >= this.replaySnapshots.length - 1) return;
    this.pauseReplay();
    this.replayTimer = window.setInterval(() => {
      if (this.replayIndex >= this.replaySnapshots.length - 1) {
        this.pauseReplay();
        return;
      }
      this.restoreReplaySnapshot(this.replayIndex + 1);
    }, 1000 / this.replaySpeed);
    this.updateSidebar();
  }

  pauseReplay() {
    if (this.replayTimer) window.clearInterval(this.replayTimer);
    this.replayTimer = null;
    this.updateSidebar();
  }

  async exitReplay() {
    this.pauseReplay();
    this.isReplayMode = false;
    this.replayIndex = this.replaySnapshots.length - 1;
    await this.stateEngine.restore(this.replaySnapshots[this.replayIndex]);
    this.highlightManager.clearHighlights();
    this.inputManager.setEnabled(!this.gameOver && this.startupState === 'playing' && this.players?.[this.turnManager.currentTurn]?.type === 'human');
    this.updateSidebar();
  }

  async undoMove() {
    if (this.animationManager.isAnimating || !this.snapshots.length) return;
    const snapshot = this.snapshots.pop();
    await this.stateEngine.restore(snapshot);
  }

  restartGame() {
    if (this.startupSettings) sessionStorage.setItem('skyChessStartupSettings', JSON.stringify(this.startupSettings));
    sessionStorage.setItem('skyChessAutoStartAfterRestart', 'true');
    window.location.reload();
  }

  returnToMainMenu() {
    if (this.startupSettings) sessionStorage.setItem('skyChessStartupSettings', JSON.stringify(this.startupSettings));
    sessionStorage.removeItem('skyChessAutoStartAfterRestart');
    this.renderer.container.classList.add('is-returning-menu');
    window.setTimeout(() => window.location.reload(), 360);
  }

  replayCompletedGame() {
    this.gameStatusUI.querySelector('.game-status-ui__end').classList.remove('is-visible');
    this.gameStatusUI.querySelector('.game-status-ui__end-backdrop').classList.remove('is-visible');
    this.cameraController.setEndGameViewing(false);
    this.enterReplay(0);
  }

  endGame(title, detail) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.gameResult = { title, detail };
    this.selectionManager.clearSelection();
    this.inputManager.setEnabled(false);
    this.gameStatusUI.querySelector('.game-status-ui__check').classList.remove('is-visible');
    const lastMove = this.lastMoveHighlightManager?.lastMove;
    const finalFloor = this.getFloor(lastMove?.toFloor || this.boardState.activeFloorKey) || this.middleFloor;
    this.cameraController.startEndGameOrbit(finalFloor.baseY);
    this.cameraController.setEndGameViewing(true);
    if (title === 'CHECKMATE') this.highlightEndgameKings(this.turnManager.currentTurn);
    this.audioManager.fadeOutGameplayMusic(850);
    if (title === 'CHECKMATE') {
      this.audioManager.playCheckmate();
      const winner = this.turnManager.currentTurn === 'white' ? 'black' : 'white';
      window.setTimeout(() => {
        if (winner === this.playerColor) this.audioManager.playVictory();
        else this.audioManager.playDefeat();
      }, 2200);
    }
    this.emitEndGameEvent(title, detail);
    this.showEndGamePresentation(title, detail);
    this.updateSidebar();
  }

  async showEndGamePresentation(title, detail) {
    await this.delay(500);
    const endPanel = this.gameStatusUI.querySelector('.game-status-ui__end');
    const displayTitle = title === 'RESIGNED' ? `${detail.split(' ')[0].toUpperCase()} RESIGNS` : title;
    endPanel.querySelector('strong').textContent = displayTitle;
    endPanel.querySelector('span').textContent = detail;
    this.gameStatusUI.querySelector('.game-status-ui__end-backdrop').classList.add('is-visible');
    endPanel.classList.add('is-visible');
  }

  highlightEndgameKings(losingColor) {
    const winnerColor = losingColor === 'white' ? 'black' : 'white';
    this.pieces.filter((piece) => piece.type === 'king' && piece.root.parent).forEach((king) => {
      king.selectionRing.visible = true;
      king.selectionRing.material.color.set(king.color === winnerColor ? 0xf3c96b : 0xdc5b58);
      king.selectionRing.material.opacity = king.color === winnerColor ? 0.82 : 0.66;
    });
  }

  emitEndGameEvent(title, detail) {
    if (title === 'DRAW' || title === 'STALEMATE') {
      window.dispatchEvent(new CustomEvent('GameDraw', { detail: { title, detail } }));
      return;
    }
    const winner = title === 'CHECKMATE'
      ? (this.turnManager.currentTurn === 'white' ? 'black' : 'white')
      : (detail.startsWith('White') ? 'black' : 'white');
    window.dispatchEvent(new CustomEvent(winner === this.playerColor ? 'GameWon' : 'GameLost', { detail: { title, detail, winner } }));
  }

  resign() {
    const color = this.turnManager.currentTurn;
    this.endGame('RESIGNED', `${color === 'white' ? 'White' : 'Black'} Resigned`);
    this.recordReplaySnapshot();
  }

  offerDraw() {
    return false;
  }

  evaluateGameState() {
    if (this.gameOver) return;
    const color = this.turnManager.currentTurn;
    const inCheck = this.chessRules.isKingInCheck(color);
    this.gameStatusUI.querySelector('.game-status-ui__check').classList.toggle('is-visible', inCheck);
    const checkKey = `${color}:${this.getPositionKey()}`;
    if (inCheck && this.lastCheckAudioKey !== checkKey) {
      this.lastCheckAudioKey = checkKey;
      this.audioManager.playCheck();
    }
    if (!inCheck) this.lastCheckAudioKey = null;

    const repetitions = this.boardState.positionHistory.filter((key) => key === this.getPositionKey()).length;
    if (repetitions >= 3) return this.endGame('DRAW', 'Draw by Threefold Repetition');
    if (this.boardState.halfmoveClock >= 100) return this.endGame('DRAW', 'Draw by Fifty-Move Rule');
    if (this.hasInsufficientMaterial()) return this.endGame('DRAW', 'Draw by Insufficient Material');

    const hasNormalMove = this.chessRules.getAllLegalMoves(color).length > 0;
    const hasTeleport = this.hasLegalTeleport(color);
    if (hasNormalMove || hasTeleport) {
      this.updateSidebar();
      return;
    }

    this.endGame(inCheck ? 'CHECKMATE' : 'STALEMATE', inCheck ? `${color === 'white' ? 'Black' : 'White'} Wins` : 'Draw by Stalemate');
  }

  hasLegalTeleport(color) {
    return this.floors.some((floor) => this.chessRules.getPieces(floor.key)
      .filter((piece) => piece.color === color && piece.elevator)
      .some((piece) => this.getTeleportDestinations(piece).some((destination) => this.canTeleportTo(piece, destination.key))));
  }

  getLegalTeleportMoves(color) {
    return this.floors.flatMap((floor) => this.chessRules.getPieces(floor.key)
      .filter((piece) => piece.color === color && piece.elevator)
      .flatMap((piece) => this.getTeleportDestinations(piece)
        .filter((destination) => this.canTeleportTo(piece, destination.key))
        .map((destination) => ({ type: 'teleport', piece, destinationKey: destination.key }))));
  }

  getTeleportDestinations(piece) {
    const sourceFloor = this.getFloor(piece.board);
    const sourceIndex = this.floors.indexOf(sourceFloor);
    return this.floors.filter((floor, index) => Math.abs(index - sourceIndex) === 1);
  }

  canTeleportTo(piece, destinationKey) {
    const sourceFloor = this.getFloor(piece.board);
    const destinationFloor = this.getFloor(destinationKey);
    const sourceElevator = piece.elevator;
    const destinationElevator = sourceElevator && destinationFloor?.getElevatorAt(sourceElevator.row, sourceElevator.column);
    return Boolean(
      sourceFloor
      && destinationFloor?.isUnlocked
      && sourceElevator?.canUse(piece)
      && this.elevatorCooldowns[piece.color] === 0
      && destinationElevator
      && !destinationElevator.occupant
      && !this.chessRules.wouldLeaveKingInCheckAfterTeleport(piece, destinationFloor.key),
    );
  }

  createDestinationOverlay() {
    this.destinationOverlay = document.createElement('div');
    this.destinationOverlay.className = 'elevator-destination-menu';
    this.destinationOverlay.innerHTML = `
      <div class="elevator-destination-menu__panel" role="dialog" aria-label="Elevator destination"></div>`;
    this.renderer.container.appendChild(this.destinationOverlay);
    this.destinationOverlay.addEventListener('click', (event) => {
      const destination = event.target.closest('button')?.dataset.destination;
      if (!destination) return;
      if (destination === 'stay' || destination === 'close') {
        this.closeDestinationOverlay();
        return;
      }
      this.teleportTo(destination);
    });
  }

  openElevatorSelection(piece) {
    const sourceFloor = this.getFloor(piece.board);
    if (!sourceFloor || this.elevatorCooldowns[piece.color] > 0 || !piece.elevator?.canUse(piece)) return;

    this.pendingTeleportPiece = piece;
    const sourceIndex = this.floors.indexOf(sourceFloor);
    const destinationKeys = this.getTeleportDestinations(piece).map((floor) => floor.key);
    if (sourceFloor.key === 'middle') destinationKeys.splice(1, 0, 'stay');

    const labels = { upper: 'Upper Floor', middle: 'Middle Floor', lower: 'Lower Floor', stay: 'Stay' };
    const panel = this.destinationOverlay.querySelector('.elevator-destination-menu__panel');
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'elevator-destination-menu__close';
    closeButton.dataset.destination = 'close';
    closeButton.setAttribute('aria-label', 'Close elevator menu');
    closeButton.textContent = '×';
    panel.replaceChildren(closeButton, ...destinationKeys.map((key) => {
      const status = key === 'stay' ? { state: 'available', label: 'Available' } : this.getDestinationStatus(piece, key);
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.destination = key;
      button.disabled = status.state !== 'available';
      button.className = `elevator-destination-menu__option is-${status.state}`;
      const title = document.createElement('span');
      title.textContent = labels[key];
      const detail = document.createElement('span');
      detail.className = 'elevator-destination-menu__status';
      detail.textContent = status.label;
      button.append(title, detail);
      return button;
    }));
    this.destinationOverlay.classList.add('is-visible');
  }

  getDestinationStatus(piece, destinationKey) {
    const destinationFloor = this.getFloor(destinationKey);
    const destinationElevator = piece.elevator && destinationFloor?.getElevatorAt(piece.elevator.row, piece.elevator.column);

    if (!destinationFloor?.isUnlocked) {
      return { state: 'locked', label: 'Locked' };
    }
    if (this.animationManager.isAnimating || destinationElevator?.state === ELEVATOR_STATES.BUSY) {
      return { state: 'busy', label: 'Busy' };
    }
    if (destinationElevator?.occupant) {
      return { state: 'occupied', label: 'Occupied' };
    }
    if (this.chessRules.wouldLeaveKingInCheckAfterTeleport(piece, destinationFloor.key)) {
      return { state: 'locked', label: 'King in Check' };
    }
    if (this.elevatorCooldowns[piece.color] > 0) {
      return { state: 'cooldown', label: 'Cooldown' };
    }
    return { state: 'available', label: 'Available' };
  }

  closeDestinationOverlay() {
    this.destinationOverlay.classList.remove('is-visible');
    this.pendingTeleportPiece = null;
  }

  teleportTo(destinationKey) {
    const piece = this.pendingTeleportPiece;
    const sourceFloor = piece && this.getFloor(piece.board);
    const destinationFloor = this.getFloor(destinationKey);
    const sourceElevator = piece?.elevator;
    const destinationElevator = sourceElevator && destinationFloor?.getElevatorAt(sourceElevator.row, sourceElevator.column);

    if (!piece || !sourceFloor || !destinationFloor || !this.canTeleportTo(piece, destinationKey)) {
      this.closeDestinationOverlay();
      return;
    }

    const row = piece.row;
    const column = piece.column;
    this.captureSnapshot();
    this.boardState.halfmoveClock += 1;
    this.closeDestinationOverlay();
    this.selectionManager.clearSelection();
    sourceElevator.setBusy();
    destinationElevator.setBusy();
    this.animationManager.animateTeleport(
      piece,
      destinationFloor.board.group,
      () => sourceElevator.flash(),
      () => {
        sourceFloor.updateElevatorsForMove(piece, null, row, column, -1, -1);
        this.boardState.removePiece(piece, sourceFloor.key);
        this.boardState.placePiece(piece, row, column, destinationFloor.key);
        destinationElevator.occupy(piece, true);
        destinationElevator.flash();
        this.cameraController.focusFloor(destinationFloor.baseY);
      },
      () => {
          destinationElevator.finishBusy();
          this.startElevatorCooldown(piece.color, destinationFloor.key);
          this.audioManager.playTeleport();
          this.recordTeleport(piece, sourceFloor, destinationFloor, row, column, this.turnManager.turnNumber);
          this.lastMoveHighlightManager.showLastMove({
            fromFloor: sourceFloor.key,
            fromRow: row,
            fromColumn: column,
            toFloor: destinationFloor.key,
            toRow: row,
            toColumn: column,
          });
          this.turnManager.advanceTurn();
      },
    );
  }

  start() {
    this.renderer.onFrame = () => this.update();
    this.renderer.start();
  }

  startMenuMusic() {
    this.audioManager.startMenuMusic();
  }

  beginGame(settings) {
    if (this.startupState !== 'menu') return;
    this.startupState = 'intro';
    this.startupSettings = settings;
    this.audioManager.configure(settings);
    this.audioManager.startIntroWind();
    this.configurePlayers(settings);
    this.cameraController.setTransitionDuration(settings.camera.transitionDuration);
    this.cameraController.setSmoothMovement(settings.camera.smooth);
    this.introWasSkipped = false;
    this.boundIntroSkip = (event) => {
      if (event.key === 'Escape' || event.code === 'Space') {
        event.preventDefault();
        this.introWasSkipped = this.cameraController.skipIntro() || this.introWasSkipped;
      }
    };
    this.boundIntroPointerSkip = (event) => {
      if (event.button !== 0) return;
      this.introWasSkipped = this.cameraController.skipIntro() || this.introWasSkipped;
    };
    window.addEventListener('keydown', this.boundIntroSkip);
    this.renderer.renderer.domElement.addEventListener('pointerdown', this.boundIntroPointerSkip);
    this.cameraController.playIntro(() => this.finishStartup());
  }

  async finishStartup() {
    if (this.startupState !== 'intro') return;
    window.removeEventListener('keydown', this.boundIntroSkip);
    this.renderer.renderer.domElement.removeEventListener('pointerdown', this.boundIntroPointerSkip);
    this.setFocusedInputFloor(this.floors.indexOf(this.middleFloor));
    this.audioManager.startGameplayAmbience();
    await this.delay(this.introWasSkipped ? 0 : 300);
    await this.playIntroPieceAppearance(this.introWasSkipped ? 220 : 520);
    this.sidebar?.setIntroVisible(true);
    window.setTimeout(() => this.renderer.resize(), 600);
    await this.delay(this.introWasSkipped ? 220 : 580);
    await this.showIntroTurnNotice(this.introWasSkipped ? 500 : 2000);
    this.startupState = 'playing';
    this.cameraController.setEnabled(true);
    this.inputManager.setEnabled(this.players?.[this.turnManager.currentTurn]?.type === 'human');
    this.requestComputerMove();
  }

  delay(duration) {
    return new Promise((resolve) => window.setTimeout(resolve, duration));
  }

  playIntroPieceAppearance(duration) {
    const pieces = this.pieces.filter((piece) => piece.root.parent);
    if (!pieces.length) return Promise.resolve();
    const stagger = Math.min(22, duration / Math.max(1, pieces.length));
    const totalDuration = duration + stagger * (pieces.length - 1);
    const started = performance.now();
    pieces.forEach((piece) => {
      piece.root.position.y = -0.22;
      piece.root.scale.setScalar(0.93);
    });

    return new Promise((resolve) => {
      const tick = (now) => {
        pieces.forEach((piece, index) => {
          const progress = Math.min(1, Math.max(0, (now - started - index * stagger) / duration));
          const eased = 1 - Math.pow(1 - progress, 3);
          piece.root.position.y = -0.22 * (1 - eased);
          piece.root.scale.setScalar(0.93 + eased * 0.07);
        });
        if (now - started < totalDuration) window.requestAnimationFrame(tick);
        else {
          pieces.forEach((piece) => {
            piece.root.position.y = 0;
            piece.root.scale.setScalar(1);
          });
          resolve();
        }
      };
      window.requestAnimationFrame(tick);
    });
  }

  async showIntroTurnNotice(duration) {
    const notice = this.gameStatusUI?.querySelector('.game-status-ui__turn-intro');
    if (!notice) return;
    notice.textContent = `${this.turnManager.currentTurn === 'black' ? 'Black' : 'White'} to Move`;
    notice.classList.add('is-visible');
    await this.delay(duration);
    notice.classList.remove('is-visible');
    await this.delay(300);
  }

  configurePlayers(settings) {
    this.playerColor = settings.humanColor === 'black' ? 'black' : 'white';
    this.aiColor = null;
    this.players = { white: { type: 'human' }, black: { type: 'human' } };
    this.cameraController.setPlayerColor(this.playerColor);
    this.floors.forEach((floor) => floor.setCoordinatePerspective(this.playerColor));
    if (settings.opponent !== 'stockfish') return;
    this.aiColor = this.playerColor === 'white' ? 'black' : 'white';
    this.players[this.aiColor] = { type: 'stockfish' };
    this.computerProvider = new SkyChessMoveProvider({
      color: this.aiColor,
      skillLevel: settings.stockfishSkill,
      onStatus: (status) => { this.aiStatus = status; this.updateSidebar(); },
    });
  }

  async requestComputerMove() {
    if (!this.computerProvider || this.gameOver || this.isReplayMode || this.startupState !== 'playing') return;
    const color = this.turnManager.currentTurn;
    if (this.players?.[color]?.type !== 'stockfish' || this.aiThinking) return;
    this.aiThinking = true;
    this.aiStatus = 'thinking';
    this.inputManager.setEnabled(false);
    this.updateSidebar();
    const decision = await this.computerProvider.chooseMove(this);
    if (this.turnManager.currentTurn === color && decision) {
      console.info('[SkyChess AI] executing final move', {
        reason: this.computerProvider.lastDecisionReason,
        type: decision.type,
        piece: decision.piece.type,
        color: decision.piece.color,
        floor: decision.piece.board,
      });
      if (decision.type === 'teleport') {
        this.pendingTeleportPiece = decision.piece;
        this.teleportTo(decision.destinationKey);
      } else this.selectionManager.executeMove(decision.piece, decision.move);
    }
    this.aiThinking = false;
    this.aiStatus = decision ? 'ready' : 'error';
    if (!decision && this.turnManager.currentTurn === color) this.inputManager.setEnabled(true);
    this.updateSidebar();
  }

  update() {
    const time = performance.now();
    this.cameraController.update();
    this.skyEnvironment?.update(time, this.cameraController);
    this.floors?.forEach((floor) => floor.update(time));
    this.floorManager?.update(this.boardState);
    this.refreshElevatorOccupancy();
    this.pieces?.forEach((piece) => piece.update(performance.now()));
  }
}
