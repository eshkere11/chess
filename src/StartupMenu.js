export class StartupMenu {
  constructor(container, onStart, onFirstInteraction = null) {
    this.container = container;
    this.onStart = onStart;
    this.onFirstInteraction = onFirstInteraction;
    this.root = document.createElement('section');
    this.root.className = 'startup-menu';
    this.root.innerHTML = `
      <div class="startup-menu__panel" role="dialog" aria-label="Three-Level Chess startup menu">
        <div class="startup-menu__brand">
          <p class="startup-menu__eyebrow">A vertical chess experience</p>
          <div class="startup-menu__logo" role="img" aria-label="Sky Chess crest">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <defs>
              <linearGradient id="sky-chess-gold" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stop-color="#fff2c9" /><stop offset="0.45" stop-color="#dca45d" /><stop offset="1" stop-color="#8b542c" />
              </linearGradient>
              <radialGradient id="sky-chess-halo"><stop stop-color="#fff4d2" stop-opacity=".55" /><stop offset="1" stop-color="#d89a51" stop-opacity="0" /></radialGradient>
            </defs>
            <circle class="startup-menu__logo-halo" cx="60" cy="60" r="52" fill="url(#sky-chess-halo)" />
            <circle cx="60" cy="60" r="42" fill="none" stroke="url(#sky-chess-gold)" stroke-width="1.5" opacity=".82" />
            <path d="M24 68c8 9 20 14 36 14s28-5 36-14" fill="none" stroke="url(#sky-chess-gold)" stroke-width="2" stroke-linecap="round" opacity=".8" />
            <path d="M31 55c7-8 15-11 23-10M89 55c-7-8-15-11-23-10" fill="none" stroke="#f9e4ba" stroke-width="1.5" stroke-linecap="round" opacity=".78" />
            <path d="M49 43h22l-3 10 7 9-8 6H53l-8-6 7-9z" fill="url(#sky-chess-gold)" opacity=".95" />
            <path d="M54 39h12M60 33v12M53 74h14M49 80h22" fill="none" stroke="#fff1c8" stroke-width="2" stroke-linecap="round" />
            <path d="M36 86c9 4 39 4 48 0l-6 8H42z" fill="url(#sky-chess-gold)" opacity=".85" />
          </svg>
          </div>
        </div>
        <h1>Sky Chess</h1>

        <div class="startup-menu__group">
          <label>Opponent</label>
          <div class="startup-menu__segmented" data-control="opponent">
            <button type="button" class="is-selected" data-value="human">Human</button>
            <button type="button" data-value="stockfish">Stockfish</button>
          </div>
          <label class="startup-menu__field is-hidden" data-stockfish-options>
            <span>Difficulty</span><select data-stockfish-skill><option value="300">Beginner — 300 Elo</option><option value="800">Easy — 800 Elo</option><option value="1300" selected>Medium — 1300 Elo</option><option value="1800">Hard — 1800 Elo</option><option value="2300">Maximum — 2300 Elo</option></select>
            <span>Play as</span><select data-human-color><option value="white" selected>White</option><option value="black">Black</option>
          </label>
        </div>

        <div class="startup-menu__group startup-menu__options">
          <label class="startup-menu__toggle"><span>Music</span><input data-music-enabled type="checkbox" checked /></label>
          <label class="startup-menu__field"><span>Music volume</span><input data-music-volume type="range" min="0" max="100" value="60" /></label>
          <label class="startup-menu__toggle"><span>Sound effects</span><input data-sound-enabled type="checkbox" checked /></label>
          <label class="startup-menu__field"><span>Sound volume</span><input data-sound-volume type="range" min="0" max="100" value="70" /></label>
          <label class="startup-menu__toggle"><span>Smooth camera movement</span><input data-smooth-camera type="checkbox" checked /></label>
          <label class="startup-menu__field"><span>Camera transition speed</span><select data-camera-speed><option value="0">Instant</option><option value="250">Fast</option><option value="500" selected>Normal</option><option value="900">Slow</option><option value="1400">Very Slow</option></select></label>
          <label class="startup-menu__toggle startup-menu__placeholder"><span>Invert Q/E floor controls <em>Coming soon</em></span><input type="checkbox" disabled /></label>
        </div>

        <button type="button" class="startup-menu__start" data-start>Start Game</button>
        <p class="startup-menu__hint">Press <kbd>Space</kbd> or <kbd>Esc</kbd> to skip the introduction.</p>
      </div>`;
    this.container.appendChild(this.root);
    this.restoreSavedSettings();
    this.bindEvents();
    this.root.addEventListener('pointerdown', () => this.onFirstInteraction?.(), { once: true });
  }

  restoreSavedSettings() {
    try {
      const settings = JSON.parse(sessionStorage.getItem('skyChessStartupSettings') || 'null');
      if (!settings) return;
      this.root.querySelector('[data-stockfish-skill]').value = String(settings.stockfishSkill);
      this.root.querySelector('[data-human-color]').value = settings.humanColor || 'white';
      this.root.querySelector('[data-music-enabled]').checked = settings.music?.enabled ?? true;
      this.root.querySelector('[data-music-volume]').value = Math.round((settings.music?.volume ?? 0.6) * 100);
      this.root.querySelector('[data-sound-enabled]').checked = settings.sound?.enabled ?? true;
      this.root.querySelector('[data-sound-volume]').value = Math.round((settings.sound?.volume ?? 0.7) * 100);
      this.root.querySelector('[data-smooth-camera]').checked = settings.camera?.smooth ?? true;
      this.root.querySelector('[data-camera-speed]').value = String(settings.camera?.transitionDuration ?? 500);
      const selected = this.root.querySelector(`[data-control="opponent"] button[data-value="${settings.opponent}"]`);
      if (selected) {
        this.root.querySelectorAll('[data-control="opponent"] button').forEach((button) => button.classList.toggle('is-selected', button === selected));
        this.root.querySelector('[data-stockfish-options]').classList.toggle('is-hidden', settings.opponent !== 'stockfish');
      }
    } catch {
      sessionStorage.removeItem('skyChessStartupSettings');
    }
  }

  bindEvents() {
    const opponentControl = this.root.querySelector('[data-control="opponent"]');
    opponentControl.addEventListener('click', (event) => {
      const option = event.target.closest('button[data-value]');
      if (!option) return;
      opponentControl.querySelectorAll('button').forEach((button) => button.classList.toggle('is-selected', button === option));
      this.root.querySelector('[data-stockfish-options]').classList.toggle('is-hidden', option.dataset.value !== 'stockfish');
    });

    this.root.querySelector('[data-start]').addEventListener('click', () => this.start());
  }

  getSettings() {
    const selectedOpponent = this.root.querySelector('[data-control="opponent"] .is-selected').dataset.value;
    return {
      opponent: selectedOpponent,
      stockfishSkill: Number(this.root.querySelector('[data-stockfish-skill]').value),
      humanColor: this.root.querySelector('[data-human-color]').value,
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
