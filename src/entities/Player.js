import Phaser from 'phaser';

// Shortest-distance angle interpolation helper
function lerpAngle(a, b, t) {
  const diff = Phaser.Math.Angle.Wrap(b - a);
  return a + diff * t;
}

// Helper to calculate exact sprite rotation for hammer pointing at target angle
function getHammerRotation(targetAngle, isFacingLeft) {
  return isFacingLeft ? (targetAngle + Math.PI * 0.75) : (targetAngle + Math.PI * 0.25);
}

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player_knight');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Scale for authentic character presence (matching enemy knight height ~76px)
    this.baseScale = 0.76;
    this.setScale(this.baseScale);
    this.clearTint();

    // Enhanced visibility: Outline & Rim Light / Contrast (PreFX GPU shader)
    if (this.preFX) {
      // 1.5-2px subtle pale silvery-steel rim outline
      this.glowFX = this.preFX.addGlow(0xe2ecf4, 1.8, 0, false, 0.2, 8);
      // Subtle brightness and contrast enhancement (+8%) so armor details and red tabard pop
      this.colorMatrix = this.preFX.addColorMatrix();
      this.colorMatrix.brightness(1.08);
      this.colorMatrix.contrast(1.08);
    }

    // Ground Drop Shadow directly under feet for physical grounding
    this.shadow = scene.add.image(x, y + 40, 'character_drop_shadow');
    this.shadow.setDepth(Math.max(1, this.depth - 1));
    this.shadow.setScale(1.15, 0.85);
    this.shadow.setAlpha(0.72);

    // Soft warm lantern aura around the player
    if (scene.textures.exists('soft_light_glow')) {
      this.lightSource = scene.add.image(x, y + 6, 'soft_light_glow');
      this.lightSource.setDisplaySize(160, 160);
      this.lightSource.setAlpha(0.20);
      this.lightSource.setDepth(1);
      this.lightSource.setBlendMode(Phaser.BlendModes.ADD);
      this.lightSource.setTint(0xffd599);
    }

    // Physics body adjustments for 2.5D / top-down movement at knight's feet
    this.body.setSize(28, 16);
    this.body.setOffset(42, 98);
    this.setCollideWorldBounds(true);

    // Play default idle animation (Rad 1, frames 0 to 9)
    this.play('player_idle');

    // Movement attributes - runSpeed (260 px/s) standard hastighet hela tiden
    this.runSpeed = 260;
    this.baseSpeed = this.runSpeed;
    this.sprintSpeed = this.runSpeed;
    this.rollSpeed = 400;
    this.currentSpeed = this.runSpeed;
    this.body.setMaxVelocity(this.rollSpeed);

    // Player Stats
    this.maxHealth = 100;
    this.health = 100;
    this.isDead = false;
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

    // Colossal Warhammer is integrated directly in the knight artwork
    this.hammer = scene.add.sprite(x, y, 'hammer');
    this.hammer.setVisible(false);

    // Hammer Attack attributes (Heavy overhead smash)
    this.isAttacking = false;
    this.attackTimer = 0;
    this.attackDuration = 0.67; // seconds (colossal hammer 10-frame overhead strike @ 15fps)
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

    // Crimson Flask attributes (Drink flask healing mechanic on [Q])
    this.flaskCharges = 3;
    this.maxFlaskCharges = 3;
    this.drinkFlaskCooldownTimer = 0;

    // Setup input keys
    this.keys = {
      W: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      SHIFT: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      SPACE: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      Q: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
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

    // Soft radial light glow on the floor underneath player (depth 1, alpha 0.15, radius ~28px)
    this.lightSource = scene.add.image(x, y + 4, 'soft_light_glow');
    this.lightSource.setDisplaySize(56, 56);
    this.lightSource.setAlpha(0.15);
    this.lightSource.setDepth(1);
    this.lightSource.setBlendMode(Phaser.BlendModes.ADD);
  }

  update(time, delta) {
    if (this.health <= 0 || this.isDead) {
      this.body.setVelocity(0, 0);
      return;
    }

    const dt = delta / 1000;

    // Update stamina delay timer
    if (this.staminaRegenDelayTimer > 0) {
      this.staminaRegenDelayTimer -= dt;
    }

    // Update attack cooldown timer
    if (this.attackCooldownTimer > 0) {
      this.attackCooldownTimer -= dt;
    }

    // Update flask drink cooldown timer
    if (this.drinkFlaskCooldownTimer > 0) {
      this.drinkFlaskCooldownTimer -= dt;
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

    // Update ground drop shadow position and dynamics
    if (this.shadow) {
      this.shadow.setPosition(this.x, this.y + 40);
      this.shadow.setDepth(Math.max(1, this.depth - 1));
      if (this.isRolling) {
        const rollT = Math.min(1, this.rollTimer / this.rollDuration);
        const lift = Math.sin(rollT * Math.PI) * 0.35;
        this.shadow.setScale(1.15 * (1 - lift * 0.4), 0.85 * (1 - lift * 0.4));
        this.shadow.setAlpha(0.72 * (1 - lift * 0.3));
      } else {
        this.shadow.setScale(1.15, 0.85);
        this.shadow.setAlpha(0.72);
      }
    }

    this.updateLight();
  }

  handleInput(dt) {
    if (this.health <= 0) return;

    // Check for Drink Flask trigger (Q)
    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) {
      this.drink_flask();
    }

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

    // Spelaren rör sig alltid med full runSpeed (260 px/s) hela tiden
    this.currentSpeed = this.runSpeed;
    this.isSprinting = true;

    // Regenerera uthållighet om pauscooldown har passerat (vanlig förflyttning dränerar inte stamina)
    if (this.staminaRegenDelayTimer <= 0) {
      this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegenRate * dt);
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
      this.play('player_idle', true);

      // Decelerate smoothly
      this.body.setVelocity(
        this.rollDirection.x * this.baseSpeed * 0.5,
        this.rollDirection.y * this.baseSpeed * 0.5
      );
    }
  }

  createAfterimage() {
    const frame = this.anims.currentFrame ? this.anims.currentFrame.textureFrame : 0;
    const ghost = this.scene.add.sprite(this.x, this.y, 'player_knight', frame);
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
  }

  tryAttack(pointer) {
    if (this.health <= 0 || this.isRolling || this.isAttacking || this.attackCooldownTimer > 0) {
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
    this.attackDuration = 0.67; // 10 frames @ 15fps
    this.isSprinting = false;
    this.currentSwingId++;
    this.hasTriggeredSmash = false;
    this.hasSpawnedReachIndicator = false;

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

    // Play two-handed overhead hammer strike animation (Rad 3, frames 20-29)
    this.play('player_attack', true);

    // Initial forward lunge impulse
    const lungeSpeed = 160;
    this.body.setVelocity(
      Math.cos(this.attackAngle) * lungeSpeed,
      Math.sin(this.attackAngle) * lungeSpeed
    );

    // Dust at feet from forceful footwork
    this.dustEmitter.emitParticleAt(this.x, this.y + 16, 3);
  }

  spawnReachIndicator(angle) {
    const isFacingLeft = Math.cos(angle) < 0;
    const handX = this.x + (isFacingLeft ? -8 : 8);
    const handY = this.y + 1;

    // The arc originates from the hammer head (~36px from hand) and extends ~0.5 cm (19px) outside the model (55px)
    const arc = this.scene.add.sprite(handX, handY, 'reach_arc');
    arc.setOrigin(0.5, 0.5);
    arc.setRotation(angle);

    arc.setScale(1.0, isFacingLeft ? -1.0 : 1.0);
    arc.setAlpha(0.98);
    arc.setDepth(this.depth + 3);

    // Sweeping flare from hammer head and smooth fade
    this.scene.tweens.add({
      targets: arc,
      alpha: 0,
      scaleX: 1.06,
      scaleY: isFacingLeft ? -1.06 : 1.06,
      duration: 260,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        arc.destroy();
      },
    });
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
  }

  updateAttack(dt) {
    this.attackTimer += dt;
    const progress = Math.min(1, this.attackTimer / this.attackDuration);

    // Decelerate lunge smoothly
    const currentLunge = Phaser.Math.Linear(150, 0, Math.pow(progress, 1.4));
    this.body.setVelocity(
      Math.cos(this.attackAngle) * currentLunge,
      Math.sin(this.attackAngle) * currentLunge
    );

    // Reach arc indicator sweeps forward as hammer is brought overhead down (progress ~0.60)
    if (progress >= 0.60 && !this.hasSpawnedReachIndicator) {
      this.hasSpawnedReachIndicator = true;
      this.spawnReachIndicator(this.attackAngle);
    }

    // Heavy hammer ground impact at apex of downward smash (progress ~0.80)
    if (progress >= 0.80 && !this.hasTriggeredSmash) {
      this.hasTriggeredSmash = true;
      this.triggerHammerImpact();
    }

    if (this.attackTimer >= this.attackDuration) {
      this.isAttacking = false;
      this.setRotation(0);
      this.setScale(this.baseScale, this.baseScale);
      this.play('player_idle', true);
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

  drink_flask() {
    // Cannot drink if dead or currently rolling
    if (this.health <= 0 || this.isDead || this.isRolling) {
      return false;
    }

    // Check if player has flask charges remaining
    if (this.flaskCharges <= 0) {
      this.showFloatingText('Empty Vial of Blood!', 0xef4444);
      return false;
    }

    // Cooldown check so player can't accidentally multi-click
    if (this.drinkFlaskCooldownTimer > 0) {
      return false;
    }
    this.drinkFlaskCooldownTimer = 0.55;

    // Deduct 1 charge
    this.flaskCharges--;

    // Heal 40% of total HP
    const healAmount = Math.round(this.maxHealth * 0.40);
    const prevHealth = this.health;
    this.health = Math.min(this.maxHealth, this.health + healAmount);
    const actualHealed = this.health - prevHealth;

    // Trigger visual & sound effects
    this.triggerDrinkFlaskEffects(actualHealed);

    // Pulse HUD flask slot
    if (this.scene && this.scene.hud && typeof this.scene.hud.pulseFlask === 'function') {
      this.scene.hud.pulseFlask();
    }

    return true;
  }

  drinkFlask() {
    return this.drink_flask();
  }

  showFloatingText(msg, color = 0x4ade80) {
    if (!this.scene) return;
    const colorHex = '#' + color.toString(16).padStart(6, '0');
    const txt = this.scene.add.text(this.x, this.y - 28, msg, {
      fontFamily: 'Cinzel, serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: colorHex,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    txt.setDepth(this.depth + 100);

    this.scene.tweens.add({
      targets: txt,
      y: txt.y - 32,
      alpha: { from: 1, to: 0 },
      duration: 1100,
      ease: 'Cubic.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  triggerDrinkFlaskEffects(healedAmount) {
    if (!this.scene) return;

    // 1. Play drinking sound
    if (this.scene.sound) {
      this.scene.sound.play('flask_drink', { volume: 0.95 });
    }

    // 2. Floating heal numbers above knight
    this.showFloatingText(`+${healedAmount} HP`, 0x4ade80);

    // 3. Knight healing aura flash
    this.setTint(0xff6b81);
    this.scene.time.delayedCall(150, () => {
      if (this.health > 0) this.setTint(0xffd166);
    });
    this.scene.time.delayedCall(320, () => {
      if (this.health > 0) this.clearTint();
    });

    // 4. Little red flask sprite displayed in front of the knight
    const flaskX = this.x + (this.flipX ? -14 : 14);
    const flaskY = this.y - 12;
    const flaskImg = this.scene.add.image(flaskX, flaskY, 'flask_red');
    flaskImg.setDepth(this.depth + 2);
    flaskImg.setScale(0.35);
    flaskImg.setAngle(this.flipX ? 25 : -25);

    this.scene.tweens.add({
      targets: flaskImg,
      y: flaskY - 14,
      angle: this.flipX ? 55 : -55,
      alpha: { from: 1, to: 0 },
      duration: 550,
      ease: 'Quad.easeOut',
      onComplete: () => flaskImg.destroy(),
    });

    // 5. Rising restorative healing particles
    const particleColors = [0xef233c, 0xffd166, 0x4ade80, 0xffffff];
    for (let i = 0; i < 14; i++) {
      const pColor = particleColors[i % particleColors.length];
      const offsetX = Phaser.Math.Between(-14, 14);
      const offsetY = Phaser.Math.Between(4, 20);
      const p = this.scene.add.circle(this.x + offsetX, this.y + offsetY, Phaser.Math.Between(2, 4), pColor, 0.9);
      p.setDepth(this.depth + 1);

      this.scene.tweens.add({
        targets: p,
        y: p.y - Phaser.Math.Between(30, 55),
        x: p.x + Phaser.Math.Between(-10, 10),
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(450, 750),
        delay: Phaser.Math.Between(0, 150),
        ease: 'Cubic.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  takeDamage(amount) {
    if (this.isInvulnerable || this.health <= 0 || this.isDead) {
      return false; // Dodged via i-frames or already dead!
    }

    this.health = Math.max(0, this.health - amount);

    // Red damage tint
    this.setTint(0xff2222);
    this.scene.time.delayedCall(160, () => {
      if (this.health > 0) this.clearTint();
    });

    if (this.health <= 0) {
      this.isDead = true;
      this.play('player_death', true);
      this.body.setVelocity(0, 0);
      if (this.scene && typeof this.scene.handlePlayerDeath === 'function') {
        this.scene.handlePlayerDeath();
      }
    }

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
    if (this.health <= 0) return;
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
    if (this.health <= 0 || this.isRolling || this.isAttacking) {
      return; // Handled by death, roll or attack states
    }

    if (this.isMoving) {
      // Run: 8-frame springcykel med benrörelser (Frames 10 till 17) med hög, jämn FPS
      this.anims.play('player_run', true);

      // Spritarna har redan naturlig framåtlutning och stegrörelse ritad i bildrutorna
      this.setRotation(0);
      this.setScale(this.baseScale, this.baseScale);
    } else {
      // Idle: Rad 1 (Frames 0-9)
      this.walkCycle = 0;
      this.anims.play('player_idle', true);
      this.setRotation(0);
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
      this.lightSource.setPosition(this.x, this.y + 6);
      this.lightSource.setDepth(Math.max(1, this.depth - 1));
    }
  }

  destroy(fromScene) {
    if (this.scene && this.scene.input && this.pointerDownListener) {
      this.scene.input.off('pointerdown', this.pointerDownListener);
    }
    if (this.shadow) {
      this.shadow.destroy();
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
