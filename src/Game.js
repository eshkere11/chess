import { BoxGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry } from 'three';
import { Floor } from './Floor.js';
import { Renderer } from './Renderer.js';
import { CameraController } from './CameraController.js';
import { FloorManager } from './FloorManager.js';
import { FLOOR_COUNT } from './constants.js';
import { BoardState } from './BoardState.js';
import { PieceFactory } from './PieceFactory.js';
import { MoveGenerator } from './MoveGenerator.js';
import { HighlightManager } from './HighlightManager.js';
import { TurnManager } from './TurnManager.js';
import { SelectionManager } from './SelectionManager.js';
import { InputManager } from './InputManager.js';
import { AnimationManager } from './AnimationManager.js';
import { ELEVATOR_STATES } from './ElevatorPlatform.js';

export class Game {
  constructor(container) {
    this.renderer = new Renderer(container);
    this.cameraController = new CameraController(this.renderer.camera, this.renderer.renderer.domElement);
    this.startupState = 'menu';

    this.createWorld();
  }

  createWorld() {
    this.floors = [];
    for (let index = 0; index < FLOOR_COUNT; index += 1) {
      const floor = new Floor(index, this.renderer.scene);
      this.floors.push(floor);
    }

    this.floorManager = new FloorManager(this.floors);

    this.middleFloor = this.floors.find((floor) => floor.key === 'middle');
    this.middleBoardGroup = this.middleFloor?.board?.group;

    this.boardState = new BoardState();
    this.turnManager = new TurnManager();
    this.elevatorCooldowns = { white: 0, black: 0 };
    this.elevatorCooldownFloors = { white: null, black: null };
    this.animationManager = new AnimationManager();
    this.pieceFactory = new PieceFactory(this.middleBoardGroup);
    this.moveGenerator = new MoveGenerator(this.boardState);
    this.highlightManager = new HighlightManager(this.middleBoardGroup);
    this.highlightManager.setMoveGenerator(this.moveGenerator);
    this.selectionManager = new SelectionManager(
      this.boardState,
      this.turnManager,
      this.highlightManager,
      this.animationManager,
      (piece, capturedPiece, fromRow, fromColumn, toRow, toColumn) => {
        this.getFloor(piece.board).updateElevatorsForMove(piece, capturedPiece, fromRow, fromColumn, toRow, toColumn);
        this.consumeElevatorCooldownMove(piece.color);
      },
    );
    this.inputManager = new InputManager(
      this.renderer,
      this.middleBoardGroup,
      this.selectionManager,
      this.boardState,
      (piece) => this.openElevatorSelection(piece),
    );
    this.inputManager.setEnabled(false);
    this.cameraController.setEnabled(false);
    this.cameraController.setFloorFocusHandler((floorIndex) => this.setFocusedInputFloor(floorIndex));
    this.cameraController.setFloorNavigationHandler(() => this.getOccupiedFloorCycle());
    this.cameraController.focusFloor(this.middleFloor.baseY);
    this.createDestinationOverlay();
    this.pieces = [];
    this.loadStartingPosition();

    const island = new Mesh(
      new BoxGeometry(60, 8, 40),
      new MeshStandardMaterial({ color: 0x3a2b22, roughness: 0.96, metalness: 0.06 }),
    );
    island.position.set(0, -60, -30);
    island.receiveShadow = true;
    this.renderer.scene.add(island);

    const islandCap = new Mesh(
      new SphereGeometry(24, 24, 20),
      new MeshStandardMaterial({ color: 0x53453a, roughness: 0.94, metalness: 0.04 }),
    );
    islandCap.scale.set(1.0, 0.28, 1.0);
    islandCap.position.set(0, -57, -30);
    islandCap.receiveShadow = true;
    this.renderer.scene.add(islandCap);

    const skyGeometry = new BoxGeometry(220, 220, 220);
    const skyMaterial = new MeshBasicMaterial({
      color: 0x87ceeb,
      side: 2,
    });
    const sky = new Mesh(skyGeometry, skyMaterial);
    this.renderer.scene.add(sky);
  }

  async loadStartingPosition() {
    try {
      this.pieces = await this.pieceFactory.createStartingPosition(this.boardState);
      this.middleFloor.initializeElevators(this.boardState);
    } catch (error) {
      console.error('Unable to load chess piece models.', error);
    }
  }

  getFloor(key) {
    return this.floors.find((floor) => floor.key === key);
  }

  activateFloor(key) {
    const floor = this.getFloor(key);
    if (!floor) return;
    this.floorManager.setActiveFloor(key);
    this.boardState.setActiveFloor(key);
    this.inputManager.setBoardGroup(floor.board.group);
    this.highlightManager.setBoardGroup(floor.board.group);
    this.cameraController.focusFloor(floor.baseY);
  }

  setFocusedInputFloor(floorIndex) {
    const floor = this.floors[floorIndex];
    if (!floor) return;
    this.floorManager.setActiveFloor(floor.key);
    this.boardState.setActiveFloor(floor.key);
    this.inputManager.setBoardGroup(floor.board.group);
    this.highlightManager.setBoardGroup(floor.board.group);
  }

  getOccupiedFloorCycle() {
    const cycle = [this.floors.indexOf(this.middleFloor)];
    const upperFloor = this.getFloor('upper');
    const lowerFloor = this.getFloor('lower');

    if (this.boardState.getPieceCount(upperFloor.key) > 0) {
      cycle.push(this.floors.indexOf(upperFloor), this.floors.indexOf(this.middleFloor));
    }
    if (this.boardState.getPieceCount(lowerFloor.key) > 0) {
      cycle.push(this.floors.indexOf(lowerFloor));
    }
    return cycle;
  }

  refreshElevatorCooldowns() {
    this.floors.forEach((floor) => {
      const floorIsCoolingDown = Object.keys(this.elevatorCooldowns).some((color) => (
        this.elevatorCooldowns[color] > 0 && this.elevatorCooldownFloors[color] === floor.key
      ));
      floor.elevators.forEach((elevator) => elevator.setCooldownActive(floorIsCoolingDown));
    });
  }

  startElevatorCooldown(color, floorKey) {
    this.elevatorCooldowns[color] = 2;
    this.elevatorCooldownFloors[color] = floorKey;
    this.refreshElevatorCooldowns();
  }

  consumeElevatorCooldownMove(color) {
    if (this.elevatorCooldowns[color] === 0) return;
    this.elevatorCooldowns[color] -= 1;
    if (this.elevatorCooldowns[color] === 0) this.elevatorCooldownFloors[color] = null;
    this.refreshElevatorCooldowns();
  }

  createDestinationOverlay() {
    this.destinationOverlay = document.createElement('div');
    this.destinationOverlay.className = 'elevator-destination-menu';
    this.destinationOverlay.innerHTML = `
      <div class="elevator-destination-menu__panel" role="dialog" aria-label="Elevator destination"></div>`;
    this.renderer.container.appendChild(this.destinationOverlay);
    this.destinationOverlay.addEventListener('click', (event) => {
      const destination = event.target.closest('button')?.dataset.destination;
      if (!destination) return;
      if (destination === 'stay' || destination === 'close') {
        this.closeDestinationOverlay();
        return;
      }
      this.teleportTo(destination);
    });
  }

  openElevatorSelection(piece) {
    const sourceFloor = this.getFloor(piece.board);
    if (!sourceFloor || this.elevatorCooldowns[piece.color] > 0 || !piece.elevator?.canUse(piece)) return;

    this.pendingTeleportPiece = piece;
    const sourceIndex = this.floors.indexOf(sourceFloor);
    const destinationKeys = this.floors
      .filter((floor, index) => Math.abs(index - sourceIndex) === 1)
      .map((floor) => floor.key);
    if (sourceFloor.key === 'middle') destinationKeys.splice(1, 0, 'stay');

    const labels = { upper: 'Upper Floor', middle: 'Middle Floor', lower: 'Lower Floor', stay: 'Stay' };
    const panel = this.destinationOverlay.querySelector('.elevator-destination-menu__panel');
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'elevator-destination-menu__close';
    closeButton.dataset.destination = 'close';
    closeButton.setAttribute('aria-label', 'Close elevator menu');
    closeButton.textContent = '×';
    panel.replaceChildren(closeButton, ...destinationKeys.map((key) => {
      const status = key === 'stay' ? { state: 'available', label: 'Available' } : this.getDestinationStatus(piece, key);
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.destination = key;
      button.disabled = status.state !== 'available';
      button.className = `elevator-destination-menu__option is-${status.state}`;
      const title = document.createElement('span');
      title.textContent = labels[key];
      const detail = document.createElement('span');
      detail.className = 'elevator-destination-menu__status';
      detail.textContent = status.label;
      button.append(title, detail);
      return button;
    }));
    this.destinationOverlay.classList.add('is-visible');
  }

  getDestinationStatus(piece, destinationKey) {
    const destinationFloor = this.getFloor(destinationKey);
    const destinationElevator = piece.elevator && destinationFloor?.getElevatorAt(piece.elevator.row, piece.elevator.column);

    if (!destinationFloor?.isUnlocked) {
      return { state: 'locked', label: 'Locked' };
    }
    if (this.animationManager.isAnimating || destinationElevator?.state === ELEVATOR_STATES.BUSY) {
      return { state: 'busy', label: 'Busy' };
    }
    if (destinationElevator?.occupant) {
      return { state: 'occupied', label: 'Occupied' };
    }
    if (this.elevatorCooldowns[piece.color] > 0) {
      return { state: 'cooldown', label: 'Cooldown' };
    }
    return { state: 'available', label: 'Available' };
  }

  closeDestinationOverlay() {
    this.destinationOverlay.classList.remove('is-visible');
    this.pendingTeleportPiece = null;
  }

  teleportTo(destinationKey) {
    const piece = this.pendingTeleportPiece;
    const sourceFloor = piece && this.getFloor(piece.board);
    const destinationFloor = this.getFloor(destinationKey);
    const sourceElevator = piece?.elevator;
    const destinationElevator = sourceElevator && destinationFloor?.getElevatorAt(sourceElevator.row, sourceElevator.column);

    if (!piece || !sourceFloor || !destinationFloor || !destinationFloor.isUnlocked || !sourceElevator.canUse(piece) || this.elevatorCooldowns[piece.color] > 0 || destinationElevator.occupant) {
      this.closeDestinationOverlay();
      return;
    }

    const row = piece.row;
    const column = piece.column;
    this.closeDestinationOverlay();
    this.selectionManager.clearSelection();
    sourceElevator.setBusy();
    destinationElevator.setBusy();
    this.animationManager.animateTeleport(
      piece,
      destinationFloor.board.group,
      () => sourceElevator.flash(),
      () => {
        sourceFloor.updateElevatorsForMove(piece, null, row, column, -1, -1);
        this.boardState.removePiece(piece, sourceFloor.key);
        this.boardState.placePiece(piece, row, column, destinationFloor.key);
        destinationElevator.occupy(piece, true);
        destinationElevator.flash();
        this.cameraController.focusFloor(destinationFloor.baseY);
      },
      () => {
        this.turnManager.advanceTurn();
        destinationElevator.finishBusy();
        this.startElevatorCooldown(piece.color, destinationFloor.key);
      },
    );
  }

  start() {
    this.renderer.onFrame = () => this.update();
    this.renderer.start();
  }

  beginGame(settings) {
    if (this.startupState !== 'menu') return;
    this.startupState = 'intro';
    this.startupSettings = settings;
    this.cameraController.setTransitionDuration(settings.camera.transitionDuration);
    this.cameraController.setSmoothMovement(settings.camera.smooth);
    this.boundIntroSkip = (event) => {
      if (event.key === 'Escape' || event.code === 'Space') {
        event.preventDefault();
        this.cameraController.skipIntro();
      }
    };
    window.addEventListener('keydown', this.boundIntroSkip);
    this.cameraController.playIntro(() => this.finishStartup());
  }

  finishStartup() {
    if (this.startupState !== 'intro') return;
    this.startupState = 'playing';
    window.removeEventListener('keydown', this.boundIntroSkip);
    this.setFocusedInputFloor(this.floors.indexOf(this.middleFloor));
    this.cameraController.setEnabled(true);
    this.inputManager.setEnabled(true);
  }

  update() {
    this.cameraController.update();
    this.floors?.forEach((floor) => floor.update(performance.now()));
    this.floorManager?.update(this.boardState);
    this.pieces?.forEach((piece) => piece.update(performance.now()));
  }
}
