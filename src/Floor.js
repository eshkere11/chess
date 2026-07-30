import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { Board } from './Board.js';
import { ElevatorPlatform } from './ElevatorPlatform.js';
import { BOARD_FRAME_WIDTH, COLORS, FLOOR_HEIGHT, BOARD_SIZE, SQUARE_SIZE } from './constants.js';
import { boardX, boardZ } from './BoardCoordinates.js';

export class Floor {
  constructor(index, scene) {
    this.group = new Group();
    this.baseY = index * FLOOR_HEIGHT;
    this.group.position.y = this.baseY;
    this.key = index === 0 ? 'lower' : index === 1 ? 'middle' : 'upper';
    this.isUnlocked = true;
    this.floatAmplitude = 0.10;
    this.floatPhase = this.key === 'lower' ? Math.PI / 2 : 0;
    this.floatPeriod = this.key === 'upper' ? 6 : this.key === 'lower' ? 7 : 1;

    // The platform base is made thicker and more solid so each floor feels like a floating battlefield.
    const baseGeometry = new BoxGeometry(
      BOARD_SIZE * SQUARE_SIZE + BOARD_FRAME_WIDTH,
      0.65,
      BOARD_SIZE * SQUARE_SIZE + BOARD_FRAME_WIDTH,
    );
    const baseMaterial = new MeshStandardMaterial({ color: COLORS.boardBase, roughness: 0.9, metalness: 0.18 });
    this.base = new Mesh(baseGeometry, baseMaterial);
    this.base.position.y = -0.2;
    this.base.castShadow = true;
    this.base.receiveShadow = true;
    this.group.add(this.base);

    this.board = new Board(this.base);
    this.board.group.position.y = 0.15;
    this.group.add(this.board.group);

    // Four visually distinct elevator stations are placed on each floor for future movement support.
    const elevatorPositions = [
      { x: boardX(0), z: boardZ(0), row: 0, column: 0 },
      { x: boardX(BOARD_SIZE - 1), z: boardZ(0), row: 0, column: BOARD_SIZE - 1 },
      { x: boardX(0), z: boardZ(BOARD_SIZE - 1), row: BOARD_SIZE - 1, column: 0 },
      { x: boardX(BOARD_SIZE - 1), z: boardZ(BOARD_SIZE - 1), row: BOARD_SIZE - 1, column: BOARD_SIZE - 1 },
    ];

    this.elevators = elevatorPositions.map((position) => {
      const ownerColor = position.row < BOARD_SIZE / 2 ? 'black' : 'white';
      return new ElevatorPlatform(this.group, position, position, ownerColor, this.key);
    });

    scene.add(this.group);
  }

  initializeElevators(boardState) {
    this.elevators.forEach((elevator) => {
      const piece = boardState.getPieceAt(elevator.row, elevator.column, this.key);
      if (piece) {
        elevator.setHomeRook(piece);
      }
    });
  }

  setCoordinatePerspective(perspective) {
    this.board.setCoordinatePerspective(perspective);
  }

  updateElevatorsForMove(piece, capturedPiece, fromRow, fromColumn, toRow, toColumn) {
    const fromElevator = this.getElevatorAt(fromRow, fromColumn);
    const toElevator = this.getElevatorAt(toRow, toColumn);

    if (fromElevator) {
      // The move coordinates are authoritative: clear any stale occupancy cache
      // as soon as a piece leaves an elevator square.
      fromElevator.clearOccupant();
    }

    if (toElevator) {
      if (capturedPiece) {
        toElevator.clearOccupant();
      }
      toElevator.occupy(piece);
    }
  }

  getElevatorAt(row, column) {
    return this.elevators.find((elevator) => elevator.row === row && elevator.column === column) || null;
  }

  setVisualState(hasPieces) {
    const isOpaque = hasPieces;

    this.base.material.transparent = true;
    this.base.material.opacity = isOpaque ? 1.0 : 0.5;
    this.base.material.depthWrite = isOpaque;
    this.base.material.needsUpdate = true;

    this.board?.squares?.forEach((square) => {
      square.material.transparent = true;
      square.material.opacity = isOpaque ? 1.0 : 0.5;
      square.material.depthWrite = isOpaque;
      square.material.needsUpdate = true;
    });

    this.elevators?.forEach((platform) => {
      platform.ring.material.depthWrite = isOpaque;
      platform.ring.material.needsUpdate = true;
    });

    if (this.board?.group) {
      this.board.group.children.forEach((child) => {
        if (child.isSprite) {
          child.material.opacity = isOpaque ? 1.0 : 0.42;
          child.material.needsUpdate = true;
        }
      });
    }
  }

  update(time) {
    this.elevators?.forEach((platform) => platform.update(time));

    if (this.key === 'middle') {
      this.group.position.y = this.baseY;
      return;
    }

    const elapsedSeconds = time / 1000;
    const oscillation = this.floatAmplitude * Math.sin((elapsedSeconds / this.floatPeriod) * Math.PI * 2 + this.floatPhase);
    this.group.position.y = this.baseY + oscillation;
  }
}
