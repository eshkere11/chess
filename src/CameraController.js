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
    this.transitionDuration = 500;
    this.smoothMovement = true;
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

  setEnabled(enabled) {
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

  playIntro(onComplete) {
    this.focusTransition = null;
    const gameplayTransform = this.getGameplayTransform();
    const introPosition = new Vector3(0, FLOOR_HEIGHT * 3.9, -42);
    const introTarget = new Vector3(0, FLOOR_HEIGHT + 0.5, 0);
    this.camera.position.copy(introPosition);
    this.controls.target.copy(introTarget);
    this.controls.update();
    this.introTransition = {
      startPosition: introPosition,
      startTarget: introTarget,
      endPosition: gameplayTransform.position,
      endTarget: gameplayTransform.target,
      endQuaternion: gameplayTransform.quaternion,
      started: performance.now(),
      pause: 700,
      duration: 1600,
      onComplete,
    };
  }

  skipIntro() {
    if (!this.introTransition) return false;
    this.finishIntro();
    return true;
  }

  finishIntro() {
    const { endPosition, endTarget, endQuaternion, onComplete } = this.introTransition;
    this.camera.position.copy(endPosition);
    this.controls.target.copy(endTarget);
    this.introTransition = null;
    this.controls.update();
    this.camera.quaternion.copy(endQuaternion);
    onComplete?.();
  }

  onKeyDown(event) {
    if (!this.controls.enabled || this.introTransition) return;
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
      const { startPosition, startTarget, endPosition, endTarget, started, pause, duration } = this.introTransition;
      const elapsed = performance.now() - started;
      if (elapsed > pause) {
        const progress = Math.min(1, (elapsed - pause) / duration);
        const eased = progress * progress * (3 - 2 * progress);
        this.camera.position.lerpVectors(startPosition, endPosition, eased);
        this.controls.target.lerpVectors(startTarget, endTarget, eased);
        if (progress === 1) this.finishIntro();
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
