export class StartupMenu {
  constructor(container, onStart) {
    this.container = container;
    this.onStart = onStart;
    this.root = document.createElement('section');
    this.root.className = 'startup-menu';
    this.root.innerHTML = `
      <div class="startup-menu__panel" role="dialog" aria-label="Three-Level Chess startup menu">
        <p class="startup-menu__eyebrow">A vertical chess experience</p>
        <h1>Sky Chess</h1>

        <div class="startup-menu__group">
          <label>Opponent</label>
          <div class="startup-menu__segmented" data-control="opponent">
            <button type="button" class="is-selected" data-value="human">Human</button>
            <button type="button" data-value="stockfish">Stockfish</button>
          </div>
          <label class="startup-menu__field is-hidden" data-stockfish-options>
            <span>Engine strength <output data-elo-output>1600 Elo</output></span>
            <input data-elo type="range" min="0" max="14" value="6" step="1" />
          </label>
        </div>

        <div class="startup-menu__group startup-menu__options">
          <label class="startup-menu__toggle"><span>Music</span><input data-music-enabled type="checkbox" checked /></label>
          <label class="startup-menu__field"><span>Music volume</span><input data-music-volume type="range" min="0" max="100" value="60" /></label>
          <label class="startup-menu__toggle"><span>Sound effects</span><input data-sound-enabled type="checkbox" checked /></label>
          <label class="startup-menu__field"><span>Sound volume</span><input data-sound-volume type="range" min="0" max="100" value="70" /></label>
          <label class="startup-menu__toggle"><span>Smooth camera movement</span><input data-smooth-camera type="checkbox" checked /></label>
          <label class="startup-menu__field"><span>Camera transition speed</span><select data-camera-speed><option value="350">Fast</option><option value="500" selected>Normal</option><option value="750">Slow</option></select></label>
          <label class="startup-menu__toggle startup-menu__placeholder"><span>Invert Q/E floor controls <em>Coming soon</em></span><input type="checkbox" disabled /></label>
        </div>

        <button type="button" class="startup-menu__start" data-start>Start Game</button>
        <p class="startup-menu__hint">Press <kbd>Space</kbd> or <kbd>Esc</kbd> to skip the introduction.</p>
      </div>`;
    this.container.appendChild(this.root);

    this.elos = [400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000, 3200];
    this.bindEvents();
  }

  bindEvents() {
    const opponentControl = this.root.querySelector('[data-control="opponent"]');
    opponentControl.addEventListener('click', (event) => {
      const option = event.target.closest('button[data-value]');
      if (!option) return;
      opponentControl.querySelectorAll('button').forEach((button) => button.classList.toggle('is-selected', button === option));
      this.root.querySelector('[data-stockfish-options]').classList.toggle('is-hidden', option.dataset.value !== 'stockfish');
    });

    const elo = this.root.querySelector('[data-elo]');
    const eloOutput = this.root.querySelector('[data-elo-output]');
    elo.addEventListener('input', () => {
      eloOutput.value = `${this.elos[Number(elo.value)]} Elo`;
    });

    this.root.querySelector('[data-start]').addEventListener('click', () => this.start());
  }

  getSettings() {
    const selectedOpponent = this.root.querySelector('[data-control="opponent"] .is-selected').dataset.value;
    return {
      opponent: selectedOpponent,
      engineElo: this.elos[Number(this.root.querySelector('[data-elo]').value)],
      music: { enabled: this.root.querySelector('[data-music-enabled]').checked, volume: Number(this.root.querySelector('[data-music-volume]').value) / 100 },
      sound: { enabled: this.root.querySelector('[data-sound-enabled]').checked, volume: Number(this.root.querySelector('[data-sound-volume]').value) / 100 },
      camera: {
        smooth: this.root.querySelector('[data-smooth-camera]').checked,
        transitionDuration: Number(this.root.querySelector('[data-camera-speed]').value),
      },
    };
  }

  start() {
    this.onStart(this.getSettings());
    this.root.classList.add('is-leaving');
    window.setTimeout(() => this.root.remove(), 650);
  }
}
