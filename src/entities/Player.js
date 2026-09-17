import Phaser from 'phaser';

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player_knight');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Physics body adjustments for 2.5D / top-down movement
    this.body.setSize(22, 18);
    this.body.setOffset(13, 26);
    this.setCollideWorldBounds(true);

    // Movement attributes - tuned for Soulsborne weight and response
    this.baseSpeed = 180;
    this.sprintSpeed = 260;
    this.currentSpeed = this.baseSpeed;
    this.body.setMaxVelocity(this.sprintSpeed);

    // Player Stats
    this.maxHealth = 100;
    this.health = 100;
    this.maxStamina = 100;
    this.stamina = 100;
    this.staminaRegenRate = 25; // per second
    this.staminaSprintCost = 18; // per second
    this.isSprinting = false;

    // Movement direction vector
    this.moveVector = new Phaser.Math.Vector2(0, 0);
    this.facingAngle = 0;
    this.isMoving = false;

    // Bobbing / walk animation timer
    this.walkCycle = 0;

    // Setup input keys
    this.keys = {
      W: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      SHIFT: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      // Arrow keys backup for convenience
      UP: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      DOWN: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      LEFT: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      RIGHT: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
    };

    // Dust particle emitter for footsteps
    this.dustEmitter = scene.add.particles(0, 0, 'dust_puff', {
      speed: { min: 8, max: 24 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 350,
      frequency: -1, // Manual trigger
    });
    this.dustTimer = 0;

    // Point light around player (Dark Souls 3 dynamic torchlight aura)
    if (scene.add.pointlight && scene.game.renderer.type === Phaser.WEBGL) {
      this.lightSource = scene.add.pointlight(x, y, 0xff7722, 160, 0.45, 0.05);
    } else {
      this.lightSource = null;
    }
  }

  update(time, delta) {
    const dt = delta / 1000;
    this.handleInput(dt);
    this.handleMovement(dt);
    this.handleAnimation(dt);
    this.updateLight();
  }

  handleInput(dt) {
    let dx = 0;
    let dy = 0;

    // 8-directional input polling (WASD and Arrow keys)
    if (this.keys.W.isDown || this.keys.UP.isDown) dy -= 1;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) dy += 1;
    if (this.keys.A.isDown || this.keys.LEFT.isDown) dx -= 1;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) dx += 1;

    this.moveVector.set(dx, dy);
    this.isMoving = dx !== 0 || dy !== 0;

    // Sprinting logic with Stamina check
    const wantSprint = this.keys.SHIFT.isDown && this.isMoving;
    if (wantSprint && this.stamina > 5) {
      this.isSprinting = true;
      this.currentSpeed = this.sprintSpeed;
      this.stamina = Math.max(0, this.stamina - this.staminaSprintCost * dt);
    } else {
      this.isSprinting = false;
      this.currentSpeed = this.baseSpeed;
      // Regenerate stamina
      this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegenRate * dt);
    }
  }

  handleMovement(dt) {
    if (this.isMoving) {
      // Normalize vector so diagonal movement isn't 1.41x faster!
      this.moveVector.normalize();

      // Set velocity smoothly
      const targetVx = this.moveVector.x * this.currentSpeed;
      const targetVy = this.moveVector.y * this.currentSpeed;

      this.body.setVelocity(
        Phaser.Math.Linear(this.body.velocity.x, targetVx, 0.25),
        Phaser.Math.Linear(this.body.velocity.y, targetVy, 0.25)
      );

      // Facing orientation: flip sprite horizontally when moving left vs right
      if (this.moveVector.x < -0.1) {
        this.setFlipX(true);
      } else if (this.moveVector.x > 0.1) {
        this.setFlipX(false);
      }

      // Footstep dust puff
      this.dustTimer += dt;
      const dustInterval = this.isSprinting ? 0.12 : 0.22;
      if (this.dustTimer >= dustInterval) {
        this.dustTimer = 0;
        this.dustEmitter.emitParticleAt(this.x, this.y + 16, 2);
      }
    } else {
      // Natural deceleration to stop with snappy zero threshold
      const nextVx = Phaser.Math.Linear(this.body.velocity.x, 0, 0.25);
      const nextVy = Phaser.Math.Linear(this.body.velocity.y, 0, 0.25);
      this.body.setVelocity(
        Math.abs(nextVx) < 1 ? 0 : nextVx,
        Math.abs(nextVy) < 1 ? 0 : nextVy
      );
    }
  }

  handleAnimation(dt) {
    if (this.isMoving) {
      // Walking bob effect (slight vertical squash & subtle tilt to simulate heavy armor footsteps)
      const animSpeed = this.isSprinting ? 16 : 10;
      this.walkCycle += dt * animSpeed;
      
      const tilt = Math.cos(this.walkCycle) * 0.06;
      this.setRotation(tilt);
      this.scaleY = 1 + Math.sin(this.walkCycle * 2) * 0.04;
    } else {
      // Return gently to neutral stance
      this.walkCycle = 0;
      this.setRotation(Phaser.Math.Linear(this.rotation, 0, 0.2));
      this.scaleY = 1;
    }
  }

  updateLight() {
    if (this.lightSource) {
      this.lightSource.x = this.x;
      this.lightSource.y = this.y + 4;
      // Slight flickering light
      const flicker = 0.45 + Math.sin(this.scene.time.now * 0.008) * 0.04;
      this.lightSource.intensity = flicker;
    }
  }

  destroy(fromScene) {
    if (this.lightSource) {
      this.lightSource.destroy();
    }
    if (this.dustEmitter) {
      this.dustEmitter.destroy();
    }
    super.destroy(fromScene);
  }
}
