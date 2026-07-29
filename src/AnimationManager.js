import { BOARD_SIZE, SQUARE_SIZE } from './constants.js';

export class AnimationManager {
  constructor() {
    this.activeAnimations = [];
    this.isAnimating = false;
  }

  animateMove(piece, row, column, onComplete) {
    const targetX = (column - (BOARD_SIZE - 1) / 2) * SQUARE_SIZE;
    const targetZ = ((BOARD_SIZE - 1) / 2 - row) * SQUARE_SIZE;
    const startX = piece.root.position.x;
    const startZ = piece.root.position.z;

    const startTime = performance.now();
    const duration = 350;
    this.isAnimating = true;

    const tick = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      piece.root.position.x = startX + (targetX - startX) * eased;
      piece.root.position.z = startZ + (targetZ - startZ) * eased;

      if (progress < 1) {
        window.requestAnimationFrame(tick);
      } else {
        piece.root.position.x = targetX;
        piece.root.position.z = targetZ;
        this.isAnimating = false;
        onComplete?.();
      }
    };

    window.requestAnimationFrame(tick);
  }

  animateTeleport(piece, destinationGroup, onDepart, onTransfer, onComplete) {
    const startY = piece.root.position.y;
    const sinkDepth = 0.65;
    const materials = [];
    piece.root.traverse((child) => {
      if (!child.isMesh) return;
      const original = child.material;
      const clones = (Array.isArray(original) ? original : [original]).map((material) => material.clone());
      child.material = Array.isArray(original) ? clones : clones[0];
      materials.push({ child, original, clones });
    });
    this.isAnimating = true;

    const setOpacity = (opacity) => materials.forEach(({ clones }) => clones.forEach((material) => {
      material.transparent = true;
      material.opacity = opacity;
    }));
    const phase = (from, to, duration, callback) => new Promise((resolve) => {
      const started = performance.now();
      const tick = (now) => {
        const progress = Math.min(1, (now - started) / duration);
        callback(from + (to - from) * (1 - Math.pow(1 - progress, 3)));
        if (progress < 1) window.requestAnimationFrame(tick);
        else resolve();
      };
      window.requestAnimationFrame(tick);
    });

    new Promise((resolve) => window.setTimeout(resolve, 300)).then(() => phase(startY, startY - sinkDepth, 400, (value) => {
      piece.root.position.y = value;
      setOpacity(1 - (startY - value) / sinkDepth);
    })).then(() => {
      onDepart?.();
      return new Promise((resolve) => window.setTimeout(resolve, 200));
    }).then(() => {
      destinationGroup.add(piece.root);
      piece.root.position.y = startY - sinkDepth;
      onTransfer?.();
      return phase(startY - sinkDepth, startY, 400, (value) => {
        piece.root.position.y = value;
        setOpacity((value - (startY - sinkDepth)) / sinkDepth);
      });
    }).then(() => new Promise((resolve) => window.setTimeout(resolve, 200))).then(() => {
      materials.forEach(({ child, original }) => { child.material = original; });
      this.isAnimating = false;
      onComplete?.();
    });
  }
}
