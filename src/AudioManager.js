/**
 * Sky Chess audio integration point.
 *
 * Audio is intentionally disabled while the project transitions from
 * procedural sounds to authored assets. The public methods remain in place so
 * gameplay code and persisted audio settings do not need to change.
 */
export class AudioManager {
  constructor() {
    this.sfxEnabled = true;
    this.musicEnabled = true;
    this.sfxVolume = 0.7;
    this.musicVolume = 0.6;
  }

  configure(settings) {
    this.setSfxEnabled(settings.sound?.enabled ?? true);
    this.setSfxVolume(settings.sound?.volume ?? 0.7);
    this.setMusicEnabled(settings.music?.enabled ?? true);
    this.setMusicVolume(settings.music?.volume ?? 0.6);
  }

  setSfxEnabled(enabled) { this.sfxEnabled = Boolean(enabled); }
  setSfxVolume(volume) { this.sfxVolume = this.clampVolume(volume); }
  setMusicEnabled(enabled) { this.musicEnabled = Boolean(enabled); }
  setMusicVolume(volume) { this.musicVolume = this.clampVolume(volume); }

  clampVolume(volume) {
    return Math.max(0, Math.min(1, Number(volume) || 0));
  }

  // Sound-effect placeholders.
  playMove() { return Promise.resolve(); }
  playCapture() { return Promise.resolve(); }
  playCastle() { return Promise.resolve(); }
  playTeleport() { return Promise.resolve(); }
  playPromotion() { return Promise.resolve(); }
  playCheck() { return Promise.resolve(); }
  playCheckmate() { return Promise.resolve(); }
  playElevatorActivation() { return Promise.resolve(); }
  playReplay() { return Promise.resolve(); }
  playUndo() { return Promise.resolve(); }
  playButtonHover() { return Promise.resolve(); }
  playButtonClick() { return Promise.resolve(); }

  // Music and ambience placeholders.
  startMenuMusic() { return Promise.resolve(); }
  startGameplayAmbience() { return Promise.resolve(); }
  startIntroWind() { return Promise.resolve(); }
  fadeOutIntroWind() {}
  fadeOutGameplayMusic() {}
  playVictory() { return Promise.resolve(); }
  playDefeat() { return Promise.resolve(); }
}
