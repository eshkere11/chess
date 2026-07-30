import { MOUSE, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FLOOR_HEIGHT } from './constants.js';

export class CameraController {
  constructor(camera, domElement) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 9;
    this.controls.maxDistance = 66;
    this.controls.minAzimuthAngle = Math.PI - 0.55;
    this.controls.maxAzimuthAngle = Math.PI + 0.55;
    this.controls.minPolarAngle = 0.3;
    this.controls.maxPolarAngle = 1.22;
    this.controls.target = new Vector3(0, FLOOR_HEIGHT + 0.5, 0);
    this.controls.mouseButtons = {
      LEFT: MOUSE.PAN,
      MIDDLE: MOUSE.DOLLY,
      RIGHT: MOUSE.ROTATE,
    };
    this.controls.update();
    this.focusTransition = null;
    this.introTransition = null;
    this.endGameOrbit = null;
    this.endGameViewing = false;
    this.transitionDuration = 500;
    this.smoothMovement = true;
    this.playerColor = 'white';
    this.floorFocusCycle = [1, 2, 1, 0];
    this.floorFocusCycleIndex = -1;
    this.boundKeyHandler = this.onKeyDown.bind(this);
    window.addEventListener('keydown', this.boundKeyHandler);
  }

  focusFloor(floorY) {
    this.onFloorFocus?.(Math.round(floorY / FLOOR_HEIGHT));
    const target = new Vector3(0, floorY + 0.5, 0);
    const verticalDelta = target.y - this.controls.target.y;
    this.focusTransition = {
      start: this.controls.target.clone(),
      target,
      cameraStart: this.camera.position.clone(),
      cameraTarget: this.camera.position.clone().add(new Vector3(0, verticalDelta, 0)),
      started: performance.now(),
      duration: this.smoothMovement ? this.transitionDuration : 0,
    };
  }

  setFloorFocusHandler(handler) {
    this.onFloorFocus = handler;
  }

  setFloorNavigationHandler(handler) {
    this.getFloorFocusCycle = handler;
  }

  setTransitionDuration(duration) {
    this.transitionDuration = duration;
  }

  setSmoothMovement(enabled) {
    this.smoothMovement = enabled;
  }

  setPlayerColor(color) {
    const nextColor = color === 'black' ? 'black' : 'white';
    if (this.playerColor !== nextColor) {
      const offset = this.camera.position.clone().sub(this.controls.target);
      offset.x *= -1;
      offset.z *= -1;
      this.camera.position.copy(this.controls.target).add(offset);
    }
    this.playerColor = nextColor;
    const azimuthCenter = nextColor === 'black' ? 0 : Math.PI;
    this.controls.minAzimuthAngle = azimuthCenter - 0.55;
    this.controls.maxAzimuthAngle = azimuthCenter + 0.55;
    this.controls.update();
  }

  setEnabled(enabled) {
    this.controls.enabled = enabled;
  }

  startEndGameOrbit(floorY) {
    this.focusTransition = null;
    const target = new Vector3(0, floorY + 0.5, 0);
    const verticalDelta = target.y - this.controls.target.y;
    this.endGameOrbit = {
      phase: 'focus',
      target,
      targetStart: this.controls.target.clone(),
      cameraStart: this.camera.position.clone(),
      cameraTarget: this.camera.position.clone().add(new Vector3(0, verticalDelta, 0)),
      started: performance.now(),
      duration: 520,
      pause: 500,
      orbitDuration: 4200,
      offset: null,
    };
  }

  setEndGameViewing(enabled) {
    this.endGameViewing = enabled;
    this.controls.enabled = enabled;
  }

  getGameplayTransform() {
    this.controls.update();
    return {
      position: this.camera.position.clone(),
      target: this.controls.target.clone(),
      quaternion: this.camera.quaternion.clone(),
    };
  }

  restoreTransform({ position, target, quaternion }) {
    this.focusTransition = null;
    this.introTransition = null;
    this.endGameOrbit = null;
    this.camera.position.fromArray(position);
    this.controls.target.fromArray(target);
    this.controls.update();
    if (quaternion) this.camera.quaternion.fromArray(quaternion);
  }

  playIntro(onComplete) {
    this.focusTransition = null;
    const gameplayTransform = this.getGameplayTransform();
    const direction = this.playerColor === 'black' ? 1 : -1;
    const centerTarget = new Vector3(0, FLOOR_HEIGHT + 0.5, 0);
    const introPosition = new Vector3(0, FLOOR_HEIGHT * 5.6, direction * 62);
    const sceneOneEnd = new Vector3(0, FLOOR_HEIGHT * 4.0, direction * 50);
    const orbitPosition = new Vector3(-34, FLOOR_HEIGHT * 3.0, direction * 38);
    const approachPosition = new Vector3(-8, FLOOR_HEIGHT * 2.15, direction * 23);

    this.camera.position.copy(introPosition);
    this.controls.target.copy(centerTarget);
    this.controls.update();
    this.introTransition = {
      frames: [
        { position: introPosition, target: centerTarget, duration: 2000 },
        { position: sceneOneEnd, target: centerTarget, duration: 2000 },
        { position: orbitPosition, target: centerTarget, duration: 2000 },
        { position: approachPosition, target: gameplayTransform.target, duration: 1400 },
        { position: gameplayTransform.position, target: gameplayTransform.target, duration: 0 },
      ],
      endPosition: gameplayTransform.position,
      endTarget: gameplayTransform.target,
      endQuaternion: gameplayTransform.quaternion,
      started: performance.now(),
      frameIndex: 0,
      halfwayEmitted: false,
      onComplete,
    };
    this.emitIntroEvent('IntroStarted');
  }

  skipIntro() {
    if (!this.introTransition) return false;
    const currentPosition = this.camera.position.clone();
    const currentTarget = this.controls.target.clone();
    this.introTransition.frames = [
      { position: currentPosition, target: currentTarget, duration: 0 },
      { position: this.introTransition.endPosition, target: this.introTransition.endTarget, duration: 420 },
    ];
    this.introTransition.frameIndex = 0;
    this.introTransition.started = performance.now();
    return true;
  }

  emitIntroEvent(name) {
    window.dispatchEvent(new CustomEvent(name));
  }

  finishIntro() {
    const { endPosition, endTarget, endQuaternion, onComplete } = this.introTransition;
    this.camera.position.copy(endPosition);
    this.controls.target.copy(endTarget);
    this.introTransition = null;
    this.controls.update();
    this.camera.quaternion.copy(endQuaternion);
    this.emitIntroEvent('IntroFinished');
    onComplete?.();
  }

  onKeyDown(event) {
    if (!this.controls.enabled || this.introTransition || this.endGameViewing) return;
    if (event.key.toLowerCase() !== 'q' || event.repeat) {
      return;
    }

    const availableFloors = this.getFloorFocusCycle?.();
    if (availableFloors?.length) {
      this.floorFocusCycle = availableFloors;
    }
    this.floorFocusCycleIndex = (this.floorFocusCycleIndex + 1) % this.floorFocusCycle.length;
    this.focusFloor(this.floorFocusCycle[this.floorFocusCycleIndex] * FLOOR_HEIGHT);
  }

  update() {
    if (this.introTransition) {
      const transition = this.introTransition;
      const { frames } = transition;
      const currentFrame = frames[transition.frameIndex];
      const nextFrame = frames[transition.frameIndex + 1];
      if (!nextFrame) {
        this.finishIntro();
        return;
      }
      const duration = currentFrame.duration;
      const progress = duration === 0 ? 1 : Math.min(1, (performance.now() - transition.started) / duration);
      const eased = progress * progress * (3 - 2 * progress);
      this.camera.position.lerpVectors(currentFrame.position, nextFrame.position, eased);
      this.controls.target.lerpVectors(currentFrame.target, nextFrame.target, eased);
      if (transition.frameIndex === 1 && !transition.halfwayEmitted && progress >= 0.5) {
        transition.halfwayEmitted = true;
        this.emitIntroEvent('IntroHalfway');
      }
      if (progress === 1) {
        transition.frameIndex += 1;
        transition.started = performance.now();
        if (transition.frameIndex >= frames.length - 1) this.finishIntro();
      }
      this.controls.update();
      return;
    }
    if (this.endGameOrbit) {
      const transition = this.endGameOrbit;
      const elapsed = performance.now() - transition.started;
      if (transition.phase === 'focus') {
        const progress = Math.min(1, elapsed / transition.duration);
        const eased = progress * progress * (3 - 2 * progress);
        this.controls.target.lerpVectors(transition.targetStart, transition.target, eased);
        this.camera.position.lerpVectors(transition.cameraStart, transition.cameraTarget, eased);
        if (progress === 1) {
          transition.phase = 'pause';
          transition.started = performance.now();
        }
      } else if (transition.phase === 'pause' && elapsed >= transition.pause) {
        transition.phase = 'orbit';
        transition.started = performance.now();
        transition.offset = this.camera.position.clone().sub(this.controls.target);
      } else if (transition.phase === 'orbit') {
        const progress = Math.min(1, elapsed / transition.orbitDuration);
        const eased = progress * progress * (3 - 2 * progress);
        const angle = 0.28 * eased;
        const offset = transition.offset.clone().applyAxisAngle(new Vector3(0, 1, 0), angle);
        this.camera.position.copy(this.controls.target).add(offset);
        if (progress === 1) this.endGameOrbit = null;
      }
      this.controls.update();
      return;
    }
    if (this.focusTransition) {
      const { start, target, cameraStart, cameraTarget, started, duration } = this.focusTransition;
      const progress = Math.min(1, (performance.now() - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.controls.target.lerpVectors(start, target, eased);
      this.camera.position.lerpVectors(cameraStart, cameraTarget, eased);
      if (progress === 1) this.focusTransition = null;
    }
    this.controls.update();
  }

  dispose() {
    window.removeEventListener('keydown', this.boundKeyHandler);
  }
}
