export class FloorManager {
  constructor(floors) {
    this.floors = floors;
    this.activeFloorKey = 'middle';
    this.transitionDuration = 0.5;
    this.transitionStart = 0;

    this.updateFloorVisuals();
  }

  setActiveFloor(key) {
    if (this.activeFloorKey === key) {
      return;
    }

    this.activeFloorKey = key;
    this.transitionStart = performance.now();
  }

  update(boardState) {
    this.updateFloorVisuals(boardState);
  }

  updateFloorVisuals(boardState) {
    if (!boardState) {
      return;
    }

    this.floors.forEach((floor) => floor.setVisualState(boardState.getPieceCount(floor.key) > 0));
  }
}
