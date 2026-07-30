import {
  CircleGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  RingGeometry,
  SphereGeometry,
} from 'three';

export const ELEVATOR_STATES = Object.freeze({
  AVAILABLE: 'available',
  PARTIAL: 'partial',
  OCCUPIED: 'occupied',
  COOLDOWN: 'cooldown',
  BUSY: 'busy',
});

const STATE_VISUALS = {
  [ELEVATOR_STATES.AVAILABLE]: { color: 0x15803d, emissive: 0x166534, intensity: 1.15, ring: 0x86efac, opacity: 0.9 },
  [ELEVATOR_STATES.PARTIAL]: { color: 0x7e22ce, emissive: 0x581c87, intensity: 1.2, ring: 0xd8b4fe, opacity: 0.92 },
  [ELEVATOR_STATES.OCCUPIED]: { color: 0xb91c1c, emissive: 0x7f1d1d, intensity: 0.72, ring: 0xfca5a5, opacity: 0.68 },
  [ELEVATOR_STATES.COOLDOWN]: { color: 0xca8a04, emissive: 0x854d0e, intensity: 1.0, ring: 0xfde047, opacity: 0.86 },
  [ELEVATOR_STATES.BUSY]: { color: 0xc2410c, emissive: 0x9a3412, intensity: 1.55, ring: 0xfbbf24, opacity: 1 },
};

export class ElevatorPlatform {
  constructor(floorGroup, boardPosition, boardCoordinate, ownerColor, floorKey) {
    this.row = boardCoordinate.row;
    this.column = boardCoordinate.column;
    this.ownerColor = ownerColor;
    this.floorKey = floorKey;
    this.state = ELEVATOR_STATES.AVAILABLE;
    this.occupant = null;
    this.homeRook = null;
    this.cooldownActive = false;
    this.visualOccupied = false;
    this.partialActive = false;
    this.visual = STATE_VISUALS[this.state];
    this.group = new Group();
    this.group.position.set(boardPosition.x, 0.35, boardPosition.z);

    // The glowing base is a circular platform that can later host movement logic.
    const platformGeometry = new CircleGeometry(0.5, 24);
    const platformMaterial = new MeshStandardMaterial({
      color: 0x1d4ed8,
      emissive: 0x113a8a,
      emissiveIntensity: 0.85,
      roughness: 0.22,
      metalness: 0.3,
    });
    this.platform = new Mesh(platformGeometry, platformMaterial);
    this.platform.rotation.x = -Math.PI / 2;
    this.platform.castShadow = true;
    this.platform.receiveShadow = true;
    this.group.add(this.platform);

    // A subtle ring gives the platform a clearer elevator identity.
    const ringGeometry = new RingGeometry(0.28, 0.52, 32);
    const ringMaterial = new MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.95,
      transparent: true,
      opacity: 0.9,
      side: 2,
    });
    this.ring = new Mesh(ringGeometry, ringMaterial);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.04;
    this.group.add(this.ring);

    // A small core makes the platform feel more alive and readable in motion.
    const coreGeometry = new SphereGeometry(0.16, 16, 16);
    const coreMaterial = new MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.3,
    });
    this.core = new Mesh(coreGeometry, coreMaterial);
    this.core.position.y = 0.08;
    this.group.add(this.core);

    this.pointLight = new PointLight(0x38bdf8, 1.1, 4.5, 1.8);
    this.pointLight.position.y = 0.9;
    this.group.add(this.pointLight);

    floorGroup.add(this.group);
    this.baseScale = 1;
    this.flashStartedAt = 0;
    this.applyVisualState(true);
  }

  setHomeRook(piece) {
    this.homeRook = piece;
    this.occupy(piece);
  }

  occupy(piece, preserveBusy = false) {
    this.occupant = piece;
    piece.setElevator(this);
    this.visualOccupied = true;
    if (!preserveBusy) this.refreshState();
  }

  release(piece) {
    if (this.occupant !== piece) {
      return false;
    }

    this.clearOccupant();
    return true;
  }

  clearOccupant() {
    const previousOccupant = this.occupant;
    this.occupant = null;
    previousOccupant?.setElevator(null);
    this.visualOccupied = false;
    if (this.state === ELEVATOR_STATES.BUSY) this.setState(ELEVATOR_STATES.AVAILABLE);
    this.refreshState();
  }

  setBusy() {
    this.setState(ELEVATOR_STATES.BUSY);
  }

  finishBusy() {
    if (this.state === ELEVATOR_STATES.BUSY) this.setState(ELEVATOR_STATES.AVAILABLE);
    this.refreshState();
  }

  flash() {
    this.flashStartedAt = performance.now();
  }

  setCooldownActive(active) {
    this.cooldownActive = active;
    this.refreshState();
  }

  syncOccupant(piece) {
    if (this.occupant !== piece) {
      this.occupant?.setElevator(null);
      this.occupant = piece || null;
      piece?.setElevator(this);
    }
    this.setVisualOccupied(Boolean(piece));
  }

  setVisualOccupied(occupied) {
    this.visualOccupied = occupied;
    this.refreshState();
  }

  setPartialActive(active) {
    this.partialActive = active;
    this.refreshState();
  }

  isOnCooldown() {
    return this.cooldownActive;
  }

  canUse(piece) {
    return this.occupant === piece
      && piece !== this.homeRook
      && this.state !== ELEVATOR_STATES.BUSY;
  }

  refreshState() {
    if (this.state === ELEVATOR_STATES.BUSY) return;
    if (this.cooldownActive) {
      this.setState(ELEVATOR_STATES.COOLDOWN);
      return;
    }
    if (this.visualOccupied) {
      this.setState(ELEVATOR_STATES.OCCUPIED);
      return;
    }
    if (this.partialActive) {
      this.setState(ELEVATOR_STATES.PARTIAL);
      return;
    }
    this.setState(ELEVATOR_STATES.AVAILABLE);
  }

  setState(state) {
    this.state = state;
    this.visual = STATE_VISUALS[state];
  }

  applyVisualState(immediate = false) {
    const blend = (color, value) => immediate ? color.set(value) : color.lerp({ r: ((value >> 16) & 255) / 255, g: ((value >> 8) & 255) / 255, b: (value & 255) / 255 }, 0.16);
    blend(this.platform.material.color, this.visual.color);
    blend(this.platform.material.emissive, this.visual.emissive);
    blend(this.ring.material.color, this.visual.ring);
    blend(this.ring.material.emissive, this.visual.ring);
    blend(this.core.material.emissive, this.visual.ring);
    blend(this.pointLight.color, this.visual.ring);
  }

  update(time) {
    this.applyVisualState();
    const pulseRange = this.state === ELEVATOR_STATES.BUSY ? 0.16 : 0.08;
    const pulse = 0.9 + Math.sin(time * 0.003) * pulseRange;
    const flashProgress = Math.max(0, 1 - (time - this.flashStartedAt) / 260);
    const flash = flashProgress * flashProgress;
    this.group.scale.setScalar(pulse);
    this.platform.material.emissiveIntensity = this.visual.intensity * (0.85 + pulse * 0.15);
    this.ring.material.opacity += (Math.min(1, this.visual.opacity * (0.9 + pulse * 0.1) + flash * 0.35) - this.ring.material.opacity) * 0.2;
    this.ring.scale.setScalar(1 + flash * 0.7);
    this.core.scale.setScalar(1 + flash * 0.4);
    this.pointLight.intensity = this.visual.intensity * (0.75 + pulse * 0.25) + flash * 1.25;
  }
}
