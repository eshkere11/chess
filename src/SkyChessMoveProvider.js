import stockfishScriptUrl from 'stockfish/bin/stockfish-18-lite-single.js?url';
import stockfishWasmUrl from 'stockfish/bin/stockfish-18-lite-single.wasm?url';

const DIFFICULTY_PROFILES = {
  300: { skillLevel: 0, engineElo: 1320 },
  800: { skillLevel: 4, engineElo: 1320 },
  1300: { skillLevel: 8, engineElo: 1320 },
  1800: { skillLevel: 14, engineElo: 1800 },
  2300: { skillLevel: 20, engineElo: 2300 },
};

export class SkyChessMoveProvider {
  constructor({ color, skillLevel, onStatus }) {
    this.color = color;
    this.targetElo = skillLevel;
    this.difficulty = DIFFICULTY_PROFILES[skillLevel] || DIFFICULTY_PROFILES[1300];
    this.skillLevel = this.difficulty.skillLevel;
    this.onStatus = onStatus;
    this.debug = true;
    this.searchDepth = 8;
    this.searchTimeoutMs = 5000;
    this.protocolTimeoutMs = 20000;
    this.engine = null;
    this.engineReady = null;
  }

  async chooseMove(game) {
    this.log('turn started', {
      color: this.color,
      skyChessBoardState: this.getSkyChessBoardState(game),
    });
    const normalMoves = game.floors.flatMap((floor) => game.chessRules.getPieces(floor.key)
      .filter((piece) => piece.color === this.color)
      .flatMap((piece) => game.chessRules.generateLegalMoves(piece).map((move) => ({ type: 'normal', piece, move }))));
    const teleports = game.getLegalTeleportMoves(this.color);
    const stockfishMove = await this.getStockfishMove(game, normalMoves);
    if (stockfishMove) {
      this.lastDecisionReason = 'Stockfish';
      this.log('final move selected', { reason: 'Stockfish', move: this.describeDecision(stockfishMove) });
      return stockfishMove;
    }
    const fallback = [...normalMoves, ...teleports];
    const decision = fallback.length ? fallback[Math.floor(Math.random() * fallback.length)] : null;
    this.lastDecisionReason = decision?.type === 'teleport' ? 'Fallback (teleport move)' : 'Fallback';
    this.log('fallback move generator', {
      used: Boolean(decision),
      normalMoveCount: normalMoves.length,
      teleportMoveCount: teleports.length,
      finalMove: this.describeDecision(decision),
      reason: this.lastDecisionReason,
    });
    return decision;
  }

  async getStockfishMove(game, normalMoves) {
    const floor = game.floors.find((candidateFloor) => {
      const pieces = game.chessRules.getPieces(candidateFloor.key);
      return pieces.some((piece) => piece.type === 'king' && piece.color === 'white')
        && pieces.some((piece) => piece.type === 'king' && piece.color === 'black');
    });
    if (!floor) {
      this.log('Stockfish skipped', { reason: 'No single floor contains both kings, so no standard-chess FEN can be evaluated.' });
      return null;
    }
    try {
      this.onStatus('thinking');
      const fen = this.toFen(game, floor.key);
      this.log('Stockfish request', {
        floor: floor.key,
        fen,
        targetElo: this.targetElo,
        skillLevel: this.skillLevel,
        engineElo: this.difficulty.engineElo,
        depth: this.searchDepth,
        timeLimitMs: this.searchTimeoutMs,
      });
      const engine = await this.getEngine();
      const uciMove = await this.requestBestMove(engine, fen);
      this.log('Stockfish raw move', { uciMove });
      if (!uciMove) {
        this.log('Stockfish validation', { accepted: false, reason: 'Engine timed out or returned no UCI bestmove.' });
        return null;
      }
      const fromColumn = uciMove.charCodeAt(0) - 97;
      const fromRow = 8 - Number(uciMove[1]);
      const toColumn = uciMove.charCodeAt(2) - 97;
      const toRow = 8 - Number(uciMove[3]);
      const promotion = ({ q: 'queen', r: 'rook', b: 'bishop', n: 'knight' })[uciMove[4]] || null;
      const validatedMove = normalMoves.find(({ piece, move }) => piece.board === floor.key && piece.row === fromRow && piece.column === fromColumn && move.row === toRow && move.column === toColumn) || null;
      this.log('Stockfish validation', validatedMove
        ? { accepted: true, move: this.describeDecision(validatedMove) }
        : { accepted: false, reason: 'The UCI move is not present in the current Sky Chess legal normal-move list.', uciMove });
      return validatedMove && promotion ? { ...validatedMove, move: { ...validatedMove.move, promotion } } : validatedMove;
    } catch (error) {
      this.log('Stockfish initialized', { initialized: false, error: error?.message || String(error) });
      this.onStatus('error');
      return null;
    }
  }

  async getEngine() {
    if (this.engineReady) return this.engineReady;
    this.engine = this.createStockfishWorker();
    this.log('Stockfish initialized', { initialized: true, mode: 'Stockfish 18 lite single-threaded direct engine' });
    this.engineReady = this.engine
      .then((engine) => this.initializeEngine(engine).then(() => engine))
      .catch((error) => {
        this.engine?.then((engine) => engine.terminate());
        this.engine = null;
        this.engineReady = null;
        throw error;
      });
    return this.engineReady;
  }

  createStockfishWorker() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const module = {
        locateFile: (file) => file.endsWith('.wasm') ? stockfishWasmUrl : file,
        listener: () => {},
      };
      script.src = stockfishScriptUrl;
      script.onload = async () => {
        try {
          await script._exports(module);
          resolve({
            uci: (command) => module.ccall('command', null, ['string'], [command], { async: /^go\b/.test(command) }),
            terminate: () => module.ccall('command', null, ['string'], ['quit']),
            set listen(handler) { module.listener = handler; },
            set onError(handler) { module.onAbort = (error) => handler(String(error)); },
          });
        } catch (error) {
          reject(error);
        } finally {
          script.remove();
        }
      };
      script.onerror = () => reject(new Error('Stockfish script failed to load.'));
      document.head.appendChild(script);
    });
  }

  async requestBestMove(engine, fen) {
    engine.uci(`position fen ${fen}`);
    this.log('Stockfish command', { command: `position fen ${fen}` });
    return this.sendAndWait(
      engine,
      `go depth ${this.searchDepth}`,
      (line) => /bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/.test(line),
      'bestmove',
      this.searchTimeoutMs,
      (line) => /bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/.exec(line)?.[1] || null,
    );
  }

  async initializeEngine(engine) {
    engine.onError = (message) => this.log('Stockfish engine error', { message });
    await this.sendAndWait(engine, 'uci', (line) => line.includes('uciok'), 'uciok', this.protocolTimeoutMs);
    engine.uci('setoption name UCI_LimitStrength value true');
    engine.uci(`setoption name UCI_Elo value ${this.difficulty.engineElo}`);
    engine.uci(`setoption name Skill Level value ${this.skillLevel}`);
    this.log('Stockfish difficulty', { targetElo: this.targetElo, engineElo: this.difficulty.engineElo, skillLevel: this.skillLevel });
    await this.sendAndWait(engine, 'isready', (line) => line.includes('readyok'), 'readyok', this.protocolTimeoutMs);
  }

  sendAndWait(engine, command, matches, expectedResponse, timeoutMs = null, extract = () => true) {
    return new Promise((resolve, reject) => {
      const timer = timeoutMs === null ? null : window.setTimeout(() => {
        reject(new Error(`Timed out waiting for Stockfish ${expectedResponse} after ${timeoutMs}ms.`));
      }, timeoutMs);
      engine.listen = (message) => {
        const line = String(message).trim();
        this.log('Stockfish message', { line });
        if (!matches(line)) return;
        if (timer !== null) window.clearTimeout(timer);
        resolve(extract(line));
      };
      this.log('Stockfish command', { command, waitingFor: expectedResponse });
      engine.uci(command);
    });
  }

  getSkyChessBoardState(game) {
    return game.floors.map((floor) => ({
      floor: floor.key,
      pieces: game.chessRules.getPieces(floor.key).map((piece) => ({
        type: piece.type,
        color: piece.color,
        row: piece.row,
        column: piece.column,
      })),
    }));
  }

  describeDecision(decision) {
    if (!decision) return null;
    if (decision.type === 'teleport') return { type: 'teleport', piece: decision.piece.type, color: decision.piece.color, fromFloor: decision.piece.board, destinationFloor: decision.destinationKey };
    return { type: 'normal', piece: decision.piece.type, color: decision.piece.color, floor: decision.piece.board, from: { row: decision.piece.row, column: decision.piece.column }, to: { row: decision.move.row, column: decision.move.column } };
  }

  log(event, details) {
    if (this.debug) console.info(`[SkyChess AI] ${event}`, details);
  }

  toFen(game, floorKey) {
    const symbols = { white: { pawn: 'P', knight: 'N', bishop: 'B', rook: 'R', queen: 'Q', king: 'K' }, black: { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' } };
    const rows = game.boardState.getGrid(floorKey).map((row) => {
      let empty = 0; let value = '';
      row.forEach((piece) => { if (!piece) empty += 1; else { if (empty) value += empty; empty = 0; value += symbols[piece.color][piece.type]; } });
      return value + (empty || '');
    });
    return `${rows.join('/')} ${this.color === 'white' ? 'w' : 'b'} - - 0 1`;
  }
}
