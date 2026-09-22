import Phaser from 'phaser';

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player_knight');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Scale for authentic pixel-art character presence
    this.baseScale = 2.2;
    this.setScale(this.baseScale);

    // Physics body adjustments for 2.5D / top-down movement
    this.body.setSize(14, 12);
    this.body.setOffset(9, 16);
    this.setCollideWorldBounds(true);

    // Play default idle animation
    this.play('player_idle');

    // Movement attributes - tuned for Soulsborne weight and response
    this.baseSpeed = 180;
    this.sprintSpeed = 260;
    this.rollSpeed = 400;
    this.currentSpeed = this.baseSpeed;
    this.body.setMaxVelocity(this.rollSpeed);

    // Player Stats
    this.maxHealth = 100;
    this.health = 100;
    this.maxStamina = 100;
    this.stamina = 100;
    this.souls = 2450;
    this.staminaRegenRate = 25; // per second
    this.staminaSprintCost = 18; // per second
    this.rollStaminaCost = Math.round(this.maxStamina * 0.15); // 15% stamina cost (15 points)
    this.staminaRegenDelayTimer = 0; // Pauses regen after rolling/sprinting
    this.isSprinting = false;

    // Dodge Roll attributes
    this.isRolling = false;
    this.isInvulnerable = false;
    this.rollTimer = 0;
    this.rollDuration = 0.42; // seconds
    this.rollDirection = new Phaser.Math.Vector2(0, 1);
    this.lastFacingVector = new Phaser.Math.Vector2(0, 1); // default facing forward
    this.afterimageTimer = 0;

    // Colossal Warhammer equipped in Right Hand (slightly larger than player)
    this.hammerScale = 2.8;
    this.hammer = scene.add.sprite(x, y, 'hammer');
    this.hammer.setOrigin(0.18, 0.82); // Grip pivot
    this.hammer.setScale(this.hammerScale);
    this.hammer.setDepth(this.depth + 1);

    // Hammer Attack attributes (Heavy overhead smash)
    this.isAttacking = false;
    this.attackTimer = 0;
    this.attackDuration = 0.44; // seconds (colossal hammer swing timing)
    this.attackStaminaCost = 22; // 22% stamina cost
    this.attackAngle = 0;
    this.attackRange = 78; // Extended reach for colossal hammer
    this.attackArc = Phaser.Math.DegToRad(110); // 110-degree sweep cone
    this.attackCooldownTimer = 0;
    this.currentSwingId = 0;
    this.hasTriggeredSmash = false;

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
      SPACE: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      // Arrow keys backup for convenience
      UP: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      DOWN: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      LEFT: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      RIGHT: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
    };

    // Listen to mouse pointer click for sword attack
    this.pointerDownListener = (pointer) => {
      if (pointer.leftButtonDown() || pointer.button === 0) {
        this.tryAttack(pointer);
      }
    };
    scene.input.on('pointerdown', this.pointerDownListener);

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

    // Update stamina delay timer
    if (this.staminaRegenDelayTimer > 0) {
      this.staminaRegenDelayTimer -= dt;
    }

    // Update attack cooldown timer
    if (this.attackCooldownTimer > 0) {
      this.attackCooldownTimer -= dt;
    }

    if (this.isRolling) {
      this.updateRoll(dt);
    } else if (this.isAttacking) {
      this.updateAttack(dt);
    } else {
      this.handleInput(dt);
      this.handleMovement(dt);
      this.handleAnimation(dt);
      this.updateWeapon(dt);
    }

    this.updateLight();
  }

  handleInput(dt) {
    // Check for Dodge Roll trigger (SPACE)
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      if (this.stamina >= this.rollStaminaCost && !this.isRolling) {
        this.performRoll();
        return;
      }
    }

    let dx = 0;
    let dy = 0;

    // 8-directional input polling (WASD and Arrow keys)
    if (this.keys.W.isDown || this.keys.UP.isDown) dy -= 1;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) dy += 1;
    if (this.keys.A.isDown || this.keys.LEFT.isDown) dx -= 1;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) dx += 1;

    this.moveVector.set(dx, dy);
    this.isMoving = dx !== 0 || dy !== 0;

    if (this.isMoving) {
      this.lastFacingVector.set(dx, dy).normalize();
    }

    // Sprinting logic with Stamina check
    const wantSprint = this.keys.SHIFT.isDown && this.isMoving;
    if (wantSprint && this.stamina > 5) {
      this.isSprinting = true;
      this.currentSpeed = this.sprintSpeed;
      this.stamina = Math.max(0, this.stamina - this.staminaSprintCost * dt);
      this.staminaRegenDelayTimer = 0.3; // brief pause after sprinting
    } else {
      this.isSprinting = false;
      this.currentSpeed = this.baseSpeed;
      // Regenerate stamina if delay cooldown has passed
      if (this.staminaRegenDelayTimer <= 0) {
        this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegenRate * dt);
      }
    }
  }

  performRoll() {
    this.isRolling = true;
    this.isInvulnerable = true;
    this.rollTimer = 0;
    this.afterimageTimer = 0;
    this.isSprinting = false;

    // Consume 15% stamina
    this.stamina = Math.max(0, this.stamina - this.rollStaminaCost);
    // Pause stamina regeneration for 0.6 seconds
    this.staminaRegenDelayTimer = 0.6;

    // Determine roll direction: current movement or last facing direction
    if (this.isMoving && this.moveVector.lengthSq() > 0) {
      this.rollDirection.copy(this.moveVector).normalize();
    } else {
      this.rollDirection.copy(this.lastFacingVector).normalize();
    }

    // Orientation flip
    if (this.rollDirection.x < -0.1) {
      this.setFlipX(true);
    } else if (this.rollDirection.x > 0.1) {
      this.setFlipX(false);
    }

    // Initial roll velocity impulse
    this.body.setVelocity(
      this.rollDirection.x * this.rollSpeed,
      this.rollDirection.y * this.rollSpeed
    );

    // Initial roll dust puff
    this.dustEmitter.emitParticleAt(this.x, this.y + 16, 5);
    this.createAfterimage();
  }

  updateRoll(dt) {
    this.rollTimer += dt;
    const progress = Math.min(1, this.rollTimer / this.rollDuration);

    // i-Frames active during first 75% of roll
    this.isInvulnerable = progress < 0.75;

    // Deceleration curve from rollSpeed towards baseSpeed
    const currentRollSpeed = Phaser.Math.Linear(
      this.rollSpeed,
      this.baseSpeed * 0.7,
      Math.pow(progress, 1.3)
    );

    this.body.setVelocity(
      this.rollDirection.x * currentRollSpeed,
      this.rollDirection.y * currentRollSpeed
    );

    // 360-degree somersault spin in roll direction
    const spinDir = this.rollDirection.x < 0 ? -1 : 1;
    this.setRotation(spinDir * progress * Math.PI * 2);

    // Ball tuck / squash effect
    const tuck = 1 - 0.22 * Math.sin(progress * Math.PI);
    this.setScale(this.baseScale * tuck, this.baseScale * tuck);

    // Spawn afterimage trail
    this.afterimageTimer += dt;
    if (this.afterimageTimer >= 0.07) {
      this.afterimageTimer = 0;
      this.createAfterimage();
    }

    // Conclude roll
    if (this.rollTimer >= this.rollDuration) {
      this.isRolling = false;
      this.isInvulnerable = false;
      this.setRotation(0);
      this.setScale(this.baseScale, this.baseScale);
      this.dustEmitter.emitParticleAt(this.x, this.y + 16, 4);

      // Decelerate smoothly
      this.body.setVelocity(
        this.rollDirection.x * this.baseSpeed * 0.5,
        this.rollDirection.y * this.baseSpeed * 0.5
      );
    }
  }

  createAfterimage() {
    const frameIndex = this.anims.currentFrame ? this.anims.currentFrame.textureFrame : 0;
    const ghost = this.scene.add.sprite(this.x, this.y, 'player_knight', frameIndex);
    ghost.setFlipX(this.flipX);
    ghost.setRotation(this.rotation);
    ghost.setScale(this.scaleX, this.scaleY);
    ghost.setAlpha(0.5);
    ghost.setTint(0x7799bb); // Ghostly phantom tint
    ghost.setDepth(this.depth - 1);

    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      scaleX: ghost.scaleX * 0.9,
      scaleY: ghost.scaleY * 0.9,
      duration: 250,
      ease: 'Sine.easeOut',
      onComplete: () => {
        ghost.destroy();
      },
    });

    if (this.hammer) {
      const ghostHammer = this.scene.add.sprite(this.hammer.x, this.hammer.y, 'hammer');
      ghostHammer.setOrigin(this.hammer.originX, this.hammer.originY);
      ghostHammer.setRotation(this.hammer.rotation);
      ghostHammer.setScale(this.hammer.scaleX, this.hammer.scaleY);
      ghostHammer.setAlpha(0.45);
      ghostHammer.setTint(0x7799bb);
      ghostHammer.setDepth(this.hammer.depth - 1);

      this.scene.tweens.add({
        targets: ghostHammer,
        alpha: 0,
        duration: 250,
        ease: 'Sine.easeOut',
        onComplete: () => {
          ghostHammer.destroy();
        },
      });
    }
  }

  tryAttack(pointer) {
    if (this.isRolling || this.isAttacking || this.attackCooldownTimer > 0) {
      return;
    }

    if (this.stamina < this.attackStaminaCost) {
      return;
    }

    this.performAttack(pointer);
  }

  performAttack(pointer) {
    this.isAttacking = true;
    this.attackTimer = 0;
    this.isSprinting = false;
    this.currentSwingId++;
    this.hasTriggeredSmash = false;

    // Deduct stamina and pause regen
    this.stamina = Math.max(0, this.stamina - this.attackStaminaCost);
    this.staminaRegenDelayTimer = 0.6;

    // Calculate angle towards mouse world position
    const targetX = pointer.worldX;
    const targetY = pointer.worldY;
    this.attackAngle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);

    // Face orientation towards mouse
    const isFacingLeft = Math.cos(this.attackAngle) < 0;
    this.setFlipX(isFacingLeft);
    this.lastFacingVector.set(Math.cos(this.attackAngle), Math.sin(this.attackAngle));

    // Initial forward lunge impulse
    const lungeSpeed = 160;
    this.body.setVelocity(
      Math.cos(this.attackAngle) * lungeSpeed,
      Math.sin(this.attackAngle) * lungeSpeed
    );

    // Dust at feet from forceful footwork
    this.dustEmitter.emitParticleAt(this.x, this.y + 16, 3);
  }

  triggerHammerImpact() {
    // Calculate impact epicenter at the hammer head's landing position
    const impactDist = 48;
    const impactX = this.x + Math.cos(this.attackAngle) * impactDist;
    const impactY = this.y + Math.sin(this.attackAngle) * impactDist;

    // Expanding stone fracture shockwave ring
    const wave = this.scene.add.sprite(impactX, impactY, 'hammer_shockwave');
    wave.setScale(0.25);
    wave.setAlpha(0.95);
    wave.setDepth(this.depth - 1);
    this.scene.tweens.add({
      targets: wave,
      scaleX: 1.25,
      scaleY: 1.25,
      alpha: 0,
      duration: 320,
      ease: 'Cubic.easeOut',
      onComplete: () => wave.destroy(),
    });

    // Dust explosion at impact site
    this.dustEmitter.emitParticleAt(impactX, impactY, 8);

    // Fiery cinders / sparks from crushed stone
    const sparkCount = 8;
    for (let i = 0; i < sparkCount; i++) {
      const sparkAngle = this.attackAngle + (Math.random() - 0.5) * 1.6;
      const speed = Phaser.Math.Between(70, 180);
      const spark = this.scene.add.particles(impactX, impactY, 'ember_spark', {
        speed: { min: speed * 0.6, max: speed },
        angle: { min: Phaser.Math.RadToDeg(sparkAngle) - 15, max: Phaser.Math.RadToDeg(sparkAngle) + 15 },
        scale: { start: 1.1, end: 0 },
        alpha: { start: 0.95, end: 0 },
        lifespan: 260,
        frequency: -1,
      });
      spark.emitParticle(1);
      spark.setDepth(this.depth + 3);
      this.scene.time.delayedCall(280, () => spark.destroy());
    }

    // Heavy Soulsborne ground slam screen shake
    this.scene.cameras.main.shake(120, 0.0055);
  }

  updateAttack(dt) {
    this.attackTimer += dt;
    const progress = Math.min(1, this.attackTimer / this.attackDuration);

    // Decelerate lunge smoothly
    const currentLunge = Phaser.Math.Linear(160, 0, Math.pow(progress, 1.2));
    this.body.setVelocity(
      Math.cos(this.attackAngle) * currentLunge,
      Math.sin(this.attackAngle) * currentLunge
    );

    const isFacingLeft = Math.cos(this.attackAngle) < 0;
    const sign = isFacingLeft ? -1 : 1;

    // Anchor hammer at right hand
    const handX = this.x + (isFacingLeft ? -8 : 8);
    const handY = this.y + 1;
    this.hammer.setPosition(handX, handY);
    this.hammer.setDepth(this.depth + 2);

    if (progress < 0.35) {
      // Phase 1: Heavy Wind-up (hammer raised high behind player)
      const p = progress / 0.35;
      const startAngle = isFacingLeft ? 2.45 : -0.75;
      const windupAngle = this.attackAngle - (sign * 1.5);
      const curAim = Phaser.Math.Angle.Lerp(startAngle, windupAngle, p);
      this.hammer.setRotation(curAim + Math.PI / 4);
      this.hammer.setScale(isFacingLeft ? -this.hammerScale : this.hammerScale, this.hammerScale);

      // Player leans back under the weight
      this.setRotation(-sign * p * 0.12);
      this.setScale(this.baseScale, this.baseScale);
    } else if (progress < 0.65) {
      // Phase 2: Downward Smash (accelerates towards the ground)
      const p = (progress - 0.35) / 0.30;
      const easePow = Math.pow(p, 2.2);
      const windupAngle = this.attackAngle - (sign * 1.5);
      const endSmashAngle = this.attackAngle + (sign * 0.45);
      const curAim = Phaser.Math.Angle.Lerp(windupAngle, endSmashAngle, easePow);
      this.hammer.setRotation(curAim + Math.PI / 4);
      this.hammer.setScale(isFacingLeft ? -this.hammerScale : this.hammerScale, this.hammerScale);

      // Player lunges forward with the swing
      this.setRotation(sign * Math.sin(p * Math.PI) * 0.18);
      this.setScale(this.baseScale, this.baseScale);

      // Ground impact at apex of swing
      if (progress >= 0.52 && !this.hasTriggeredSmash) {
        this.hasTriggeredSmash = true;
        this.triggerHammerImpact();
      }
    } else {
      // Phase 3: Recovery (hammer rests on the ground then rises)
      const p = (progress - 0.65) / 0.35;
      const restAngle = this.attackAngle + (sign * 0.45);
      const readyAngle = isFacingLeft ? 2.45 : -0.75;
      const curAim = Phaser.Math.Angle.Lerp(restAngle, readyAngle, p);
      this.hammer.setRotation(curAim + Math.PI / 4);
      this.hammer.setScale(isFacingLeft ? -this.hammerScale : this.hammerScale, this.hammerScale);

      this.setRotation(Phaser.Math.Linear(sign * 0.15, 0, p));
      this.setScale(this.baseScale, this.baseScale);
    }

    if (this.attackTimer >= this.attackDuration) {
      this.isAttacking = false;
      this.setRotation(0);
      this.setScale(this.baseScale, this.baseScale);
      this.attackCooldownTimer = 0.12; // Recovery window before next attack
    }
  }

  isPointInAttackCone(targetX, targetY) {
    if (!this.isAttacking || this.attackTimer < this.attackDuration * 0.40) return false;

    const dist = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);
    if (dist > this.attackRange) return false;

    const targetAngle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
    let diff = Phaser.Math.Angle.Wrap(targetAngle - this.attackAngle);
    return Math.abs(diff) <= this.attackArc / 2;
  }

  takeDamage(amount) {
    if (this.isInvulnerable || this.health <= 0) {
      return false; // Dodged via i-frames or already dead!
    }

    this.health = Math.max(0, this.health - amount);

    // Red damage tint
    this.setTint(0xff2222);
    this.scene.time.delayedCall(160, () => {
      if (this.health > 0) this.clearTint();
    });

    // Sparks / blood puff
    this.scene.add.particles(this.x, this.y + 8, 'ember_spark', {
      speed: { min: 60, max: 150 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.9, end: 0 },
      lifespan: 220,
      quantity: 6,
      blendMode: 'ADD',
    });

    // Soulsborne camera shake on hit
    this.scene.cameras.main.shake(160, 0.007);

    return true;
  }

  addSouls(amount) {
    this.souls += amount;
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
      this.anims.play('player_walk', true);
      this.anims.timeScale = this.isSprinting ? 1.4 : 1.0;

      // Walking bob effect (slight vertical squash & subtle tilt to simulate heavy armor footsteps)
      const animSpeed = this.isSprinting ? 16 : 10;
      this.walkCycle += dt * animSpeed;
      
      const tilt = Math.cos(this.walkCycle) * 0.04;
      this.setRotation(tilt);
      this.setScale(this.baseScale, this.baseScale * (1 + Math.sin(this.walkCycle * 2) * 0.03));
    } else {
      // Return gently to neutral stance
      this.walkCycle = 0;
      this.anims.play('player_idle', true);
      this.setRotation(Phaser.Math.Linear(this.rotation, 0, 0.2));
      this.setScale(this.baseScale, this.baseScale);
    }
  }

  updateWeapon(dt) {
    if (!this.hammer) return;

    if (this.isRolling) {
      const spinDir = this.rollDirection.x < 0 ? -1 : 1;
      this.hammer.setPosition(this.x, this.y);
      this.hammer.setRotation(this.rotation - (spinDir * 0.4));
      const tuck = 1 - 0.22 * Math.sin((this.rollTimer / this.rollDuration) * Math.PI);
      const dirScale = this.rollDirection.x < 0 ? -this.hammerScale : this.hammerScale;
      this.hammer.setScale(dirScale * tuck, this.hammerScale * tuck);
      this.hammer.setDepth(this.depth + 1);
    } else if (!this.isAttacking) {
      const handOffsetX = this.flipX ? -8 : 8;
      const handOffsetY = 1;
      this.hammer.setPosition(this.x + handOffsetX, this.y + handOffsetY);
      
      const idleBaseAngle = this.flipX ? 2.45 : -0.75;
      const sway = this.isMoving
        ? Math.sin(this.walkCycle) * 0.14
        : Math.sin(this.scene.time.now * 0.003) * 0.05;
      
      this.hammer.setRotation(idleBaseAngle + sway);
      this.hammer.setScale(this.flipX ? -this.hammerScale : this.hammerScale, this.hammerScale);
      this.hammer.setDepth(this.depth + 1);
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
    if (this.scene && this.scene.input && this.pointerDownListener) {
      this.scene.input.off('pointerdown', this.pointerDownListener);
    }
    if (this.hammer) {
      this.hammer.destroy();
    }
    if (this.lightSource) {
      this.lightSource.destroy();
    }
    if (this.dustEmitter) {
      this.dustEmitter.destroy();
    }
    super.destroy(fromScene);
  }
}
