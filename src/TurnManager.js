export class TurnManager {
  constructor() {
    this.currentTurn = 'white';
    this.turnNumber = 0;
    this.turnListeners = new Set();
  }

  canMove(color) {
    return color === this.currentTurn;
  }

  advanceTurn() {
    this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';
    this.turnNumber += 1;
    this.turnListeners.forEach((listener) => listener(this.turnNumber, this.currentTurn));
  }

  onTurnAdvanced(listener) {
    this.turnListeners.add(listener);
    return () => this.turnListeners.delete(listener);
  }
}
