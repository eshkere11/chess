export class GameSidebar {
  constructor(container, actions) {
    this.container = container;
    this.root = document.createElement('aside');
    this.root.className = 'game-sidebar';
    this.root.innerHTML = `
      <div class="game-sidebar__brand">SKY CHESS</div>
      <section><span>Current Turn</span><strong data-turn></strong></section>
      <section><span>Current Floor</span><strong data-floor></strong></section>
      <section><span>Game Status</span><strong data-status></strong></section>
      <section class="game-sidebar__players"><span>Players</span><strong data-white-player></strong><strong data-black-player></strong><small data-ai-status></small></section>
      <section class="game-sidebar__captures"><span>Captured Pieces</span><div data-captured="white"><small>White</small><div class="game-sidebar__captured-icons"></div><strong data-captured-score="white"></strong></div><div data-captured="black"><small>Black</small><div class="game-sidebar__captured-icons"></div><strong data-captured-score="black"></strong></div></section>
      <section class="game-sidebar__replay"><span>Replay</span><strong data-replay-indicator></strong><div class="game-sidebar__replay-controls"><button type="button" data-replay="first" aria-label="First move">⏮</button><button type="button" data-replay="previous" aria-label="Previous move">◀</button><button type="button" class="game-sidebar__replay-toggle" data-replay="toggle" aria-label="Play replay">▶</button><button type="button" data-replay="next" aria-label="Next move">▶</button><button type="button" data-replay="last" aria-label="Last move">⏭</button></div><label class="game-sidebar__replay-speed"><small>Playback Speed</small><select data-replay-speed aria-label="Replay speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label><button type="button" class="game-sidebar__replay-entry" data-replay="enter">Enter Replay</button><button type="button" class="game-sidebar__replay-entry" data-replay="exit">Exit Replay</button></section>
      <section class="game-sidebar__history-section"><span>Move History</span><ol data-history></ol></section>
      <div class="game-sidebar__actions">
        <button type="button" data-action="undo">Undo Move</button>
        <button type="button" data-action="restart">Restart Game</button>
        <button type="button" data-action="draw">Offer Draw</button>
        <button type="button" class="is-danger" data-action="resign">Resign</button>
      </div>`;
    container.appendChild(this.root);
    this.root.addEventListener('click', (event) => {
      const action = event.target.closest('button')?.dataset.action;
      if (action) actions[action]?.();
      const replay = event.target.closest('button[data-replay]')?.dataset.replay;
      if (replay) actions.replay?.(replay);
      const historyIndex = event.target.closest('button[data-history-index]')?.dataset.historyIndex;
      if (historyIndex !== undefined) actions.replay?.('history', historyIndex);
    });
    this.root.querySelector('[data-replay-speed]').addEventListener('change', (event) => actions.replay?.('speed', event.target.value));
  }

  setIntroVisible(visible) {
    if (!visible) {
      this.root.classList.add('is-intro-hidden');
      this.container.classList.remove('is-intro-opening');
      this.container.classList.add('is-intro-hidden');
      return;
    }
    this.container.classList.remove('is-intro-hidden');
    this.container.classList.add('is-intro-opening');
    void this.container.offsetWidth;
    window.requestAnimationFrame(() => {
      this.container.classList.remove('is-intro-opening');
      this.root.classList.remove('is-intro-hidden');
    });
  }

  update({ turn, floor, status, material = 'Equal', history, captured = { white: [], black: [] }, canUndo, replay = {}, players, aiStatus }) {
    this.root.querySelector('[data-turn]').textContent = turn;
    this.root.querySelector('[data-floor]').textContent = floor;
    this.root.querySelector('[data-status]').textContent = status;
    this.root.querySelector('[data-white-player]').textContent = `White — ${players?.white?.type === 'stockfish' ? 'Stockfish' : 'Human'}`;
    this.root.querySelector('[data-black-player]').textContent = `Black — ${players?.black?.type === 'stockfish' ? 'Stockfish' : 'Human'}`;
    this.root.querySelector('[data-ai-status]').textContent = players && Object.values(players).some((player) => player.type === 'stockfish') ? `Stockfish: ${aiStatus === 'thinking' ? 'Thinking…' : aiStatus === 'error' ? 'Error — fallback used' : 'Ready'}` : '';
    this.root.querySelector('[data-action="undo"]').disabled = !canUndo;
    const replayActive = Boolean(replay.active);
    const replayTotal = replay.total || 0;
    this.root.classList.toggle('is-replaying', replayActive);
    this.root.querySelector('[data-replay-indicator]').textContent = replayActive ? `Move ${replay.index || 0} / ${replayTotal}` : `Move ${replayTotal} / ${replayTotal}`;
    this.root.querySelectorAll('[data-replay]').forEach((button) => { button.disabled = !replayActive; });
    this.root.querySelector('[data-replay="enter"]').disabled = replayActive;
    this.root.querySelector('[data-replay="exit"]').disabled = !replayActive;
    this.root.querySelector('[data-replay="first"]').disabled = !replayActive || replay.index === 0;
    this.root.querySelector('[data-replay="previous"]').disabled = !replayActive || replay.index === 0;
    this.root.querySelector('[data-replay="next"]').disabled = !replayActive || replay.index >= replayTotal;
    this.root.querySelector('[data-replay="last"]').disabled = !replayActive || replay.index >= replayTotal;
    const toggle = this.root.querySelector('[data-replay="toggle"]');
    toggle.textContent = replay.playing ? '❚❚' : '▶';
    toggle.setAttribute('aria-label', replay.playing ? 'Pause replay' : 'Play replay');
    toggle.disabled = !replayActive || replay.index >= replayTotal;
    this.root.querySelector('[data-replay-speed]').value = String(replay.speed || 1);
    this.root.querySelector('[data-replay-speed]').disabled = !replayActive;
    this.root.querySelector('[data-replay="enter"]').hidden = replayActive;
    this.root.querySelector('[data-replay="exit"]').hidden = !replayActive;
    this.root.querySelectorAll('[data-action]').forEach((button) => { button.disabled = replayActive || (button.dataset.action === 'undo' && !canUndo); });
    this.renderCapturedPieces('white', captured.white);
    this.renderCapturedPieces('black', captured.black);

    const historyList = this.root.querySelector('[data-history]');
    historyList.replaceChildren(...history.map((entry, index) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.historyIndex = index;
      button.className = index + 1 === replay.index && replayActive ? 'is-replay-selected' : '';
      button.textContent = entry.text;
      item.appendChild(button);
      return item;
    }));
    historyList.scrollTop = historyList.scrollHeight;
  }

  renderCapturedPieces(capturerColor, pieces) {
    const container = this.root.querySelector(`[data-captured="${capturerColor}"]`);
    const iconContainer = container.querySelector('.game-sidebar__captured-icons');
    const values = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };
    const symbols = {
      white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
      black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' },
    };
    const piecesInDisplayOrder = ['queen', 'rook', 'bishop', 'knight', 'pawn']
      .flatMap((type) => pieces.filter((piece) => piece.type === type));
    iconContainer.replaceChildren(...piecesInDisplayOrder.map((piece) => {
      const icon = document.createElement('i');
      icon.className = `game-sidebar__captured-piece is-${piece.color}`;
      icon.textContent = symbols[piece.color][piece.type];
      icon.title = `${piece.color} ${piece.type}`;
      return icon;
    }));
    container.querySelector('[data-captured-score]').textContent = `+${pieces.reduce((total, piece) => total + values[piece.type], 0)}`;
  }
}
