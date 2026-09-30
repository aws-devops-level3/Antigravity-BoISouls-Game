import Phaser from 'phaser';
import COMBAT_CONFIG from '../data/CombatConfig.js';
import SlashArc from './SlashArc.js';
import { WEAPONS, DEFAULT_WEAPON_ID } from '../data/weapons.js';

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

    // Scale for authentic pixel-art character presence (player_spritesheet_full.png)
    this.baseScale = 2.2;
    this.setScale(this.baseScale);
    this.clearTint();

    // Enhanced visibility: Outline & Rim Light / Contrast (PreFX GPU shader)
    if (this.preFX) {
      // 1.5-2px subtle pale silvery-steel rim outline
      this.glowFX = this.preFX.addGlow(0xe2ecf4, 1.8, 0, false, 0.2, 8);
      // Subtle brightness and contrast enhancement (+8%) so armor details pop
      this.colorMatrix = this.preFX.addColorMatrix();
      this.colorMatrix.brightness(1.08);
      this.colorMatrix.contrast(1.08);
    }

    // Ground Drop Shadow directly under feet for physical grounding
    this.shadow = scene.add.image(x, y + 18, 'character_drop_shadow');
    this.shadow.setDepth(Math.max(1, this.depth - 1));
    this.shadow.setScale(0.85, 0.55);
    this.shadow.setAlpha(0.68);

    // Soft warm lantern aura around the player
    if (scene.textures.exists('soft_light_glow')) {
      this.lightSource = scene.add.image(x, y + 4, 'soft_light_glow');
      this.lightSource.setDisplaySize(72, 72);
      this.lightSource.setAlpha(0.18);
      this.lightSource.setDepth(1);
      this.lightSource.setBlendMode(Phaser.BlendModes.ADD);
      this.lightSource.setTint(0xffd599);
    }

    // Physics body adjustments for 2.5D / top-down movement at knight's feet
    this.body.setSize(16, 12);
    this.body.setOffset(42, 50);
    this.setCollideWorldBounds(true);

    // Disable automatic arcade velocity integration so our custom AABB resolution controls movement
    this.body.moves = false;

    // AABB Collision Box properties (centered at the knight's feet)
    this.colliderWidth = 24;
    this.colliderHeight = 16;
    this.colliderOffsetY = 16; // Y-offset from sprite center down to the feet

    // Internal velocity components for collision-checked movement
    this.vx = 0;
    this.vy = 0;

    // Play default idle animation
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
    this.staminaRegenDelayTimer = 0; // Pauses regen after actions
    this.isSprinting = false;

    // Dash attributes (ersätter Dodge Roll på Mellanslag / Space)
    this.isDashing = false;
    this.isInvulnerable = false;
    this.dashTimer = 0;
    this.dashDuration = COMBAT_CONFIG.dashDuration || 0.20;
    this.dashCooldownTimer = 0;
    this.dashDirection = new Phaser.Math.Vector2(0, 1);
    this.lastFacingVector = new Phaser.Math.Vector2(0, 1); // default facing forward
    this.afterimageTimer = 0;

    // Utrusta standardvapen från vapenregistret (src/data/weapons.js)
    this.currentWeapon = WEAPONS[DEFAULT_WEAPON_ID] || Object.values(WEAPONS)[0];

    // Synligt vapen som spelaren håller i handen
    this.weaponScale = this.currentWeapon.scale;
    this.weaponSprite = scene.add.sprite(x, y, this.currentWeapon.sprite);
    this.weaponSprite.setOrigin(this.currentWeapon.origin.x, this.currentWeapon.origin.y);
    this.weaponSprite.setScale(this.weaponScale);
    this.weaponSprite.setVisible(true);
    this.weaponSprite.setDepth(this.depth + 1);

    // Bakåtkompatibilitets-alias för kod som refererar till this.hammer
    this.hammer = this.weaponSprite;

    // Attack attributes (Tiny Rogues style snabba melee-svep / projektiler)
    this.isAttacking = false;
    this.attackTimer = 0;
    this.attackDuration = 0.16; // Snabb visuell attack (låser ej rörelsen!)
    this.attackCooldownTimer = 0;
    this.currentSwingId = 0;
    this.aimAngle = 0;

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
      // Snabbknappar för att byta vapen: F1-F5 samt 1-5
      F1: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F1),
      F2: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F2),
      F3: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F3),
      F4: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F4),
      F5: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F5),
      ONE: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      TWO: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      THREE: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      FOUR: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
      FIVE: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE),
      // Arrow keys backup for convenience
      UP: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      DOWN: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      LEFT: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      RIGHT: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
    };

    // Förhindra standard browser-kortkommandon (F1 hjälp, F3 sök etc.)
    this.onKeyDownPreventDefaults = (e) => {
      if (['F1', 'F2', 'F3', 'F4', 'F5'].includes(e.key)) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', this.onKeyDownPreventDefaults);

    // Listen to mouse pointer click for sword attack
    this.pointerDownListener = (pointer) => {
      // Ignorera attack endast om debug-läget är aktivt och användaren ritar hinder
      if (this.scene && this.scene.collisionManager && this.scene.collisionManager.debugColliders) {
        if (pointer.event && pointer.event.shiftKey) return;
        if (this.scene.collisionManager.isDragging) return;
      }

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
    if (this.scene && this.scene.gameState !== 'PLAYING') {
      if (this.body) this.body.setVelocity(0, 0);
      this.vx = 0;
      this.vy = 0;
      return;
    }

    if (this.health <= 0 || this.isDead) {
      this.body.setVelocity(0, 0);
      return;
    }

    const dt = delta / 1000;

    // Update timers
    if (this.staminaRegenDelayTimer > 0) {
      this.staminaRegenDelayTimer -= dt;
    }
    if (this.attackCooldownTimer > 0) {
      this.attackCooldownTimer -= dt;
    }
    if (this.dashCooldownTimer > 0) {
      this.dashCooldownTimer -= dt;
    }
    if (this.drinkFlaskCooldownTimer > 0) {
      this.drinkFlaskCooldownTimer -= dt;
    }

    // 1. Mus-sikte: Spelaren ska alltid vända sig och sikta mot muspekaren (cursor),
    // oberoende av rörelseriktningen med WASD.
    const pointer = this.scene && this.scene.input ? this.scene.input.activePointer : null;
    if (pointer) {
      this.aimAngle = Phaser.Math.Angle.Between(this.x, this.y, pointer.worldX, pointer.worldY);
      this.setFlipX(Math.cos(this.aimAngle) < 0);
    }

    // 2. Kontinuerlig attack: Att hålla in vänster musknapp ska attackera kontinuerligt
    // baserat på variabeln attackCooldown / attackSpeed.
    if (pointer && pointer.isDown && pointer.button === 0) {
      const isDraggingColliders = this.scene && this.scene.collisionManager && this.scene.collisionManager.debugColliders && this.scene.collisionManager.isDragging;
      if (!isDraggingColliders && this.attackCooldownTimer <= 0 && !this.isDashing) {
        this.performAttack(pointer);
      }
    }

    // 3. Dash vs normal rörelse (spelaren kan röra sig fritt även under attacker för 'Tiny Rogues' flyt)
    if (this.isDashing) {
      this.updateDash(dt);
      this.updateWeapon(dt);
    } else {
      this.handleInput(dt);
      this.handleMovement(dt);
      if (this.isAttacking) {
        this.updateAttack(dt);
      }
      this.handleAnimation(dt);
      this.updateWeapon(dt);
    }

    // Update ground drop shadow position and dynamics
    if (this.shadow) {
      this.shadow.setPosition(this.x, this.y + 18);
      this.shadow.setDepth(Math.max(1, this.depth - 1));
      this.shadow.setScale(0.85, 0.55);
      this.shadow.setAlpha(0.68);
    }

    this.updateLight();
  }

  // Bakåtkompatibilitet
  get isRolling() {
    return this.isDashing;
  }
  set isRolling(val) {
    this.isDashing = val;
  }

  handleInput(dt) {
    if (this.health <= 0) return;

    // Check for Drink Flask trigger (Q)
    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) {
      this.drink_flask();
    }

    // Vapenväxling via F1-F5 eller siffertangenter 1-5
    if (Phaser.Input.Keyboard.JustDown(this.keys.F1) || Phaser.Input.Keyboard.JustDown(this.keys.ONE)) {
      this.equipWeapon('warhammer');
    } else if (Phaser.Input.Keyboard.JustDown(this.keys.F2) || Phaser.Input.Keyboard.JustDown(this.keys.TWO)) {
      this.equipWeapon('greatsword');
    } else if (Phaser.Input.Keyboard.JustDown(this.keys.F3) || Phaser.Input.Keyboard.JustDown(this.keys.THREE)) {
      this.equipWeapon('scimitar');
    } else if (Phaser.Input.Keyboard.JustDown(this.keys.F4) || Phaser.Input.Keyboard.JustDown(this.keys.FOUR)) {
      this.equipWeapon('dagger');
    } else if (Phaser.Input.Keyboard.JustDown(this.keys.F5) || Phaser.Input.Keyboard.JustDown(this.keys.FIVE)) {
      this.equipWeapon('staff');
    }

    // Avbryt rörelse och dash om spelaren pratar med en NPC
    if (this.scene && this.scene.isTalkingToNPC) {
      this.moveVector.set(0, 0);
      this.isMoving = false;
      this.vx = 0;
      this.vy = 0;
      return;
    }

    // Dash-mekanik på Mellanslag (Space)
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      if (!this.isDashing && this.dashCooldownTimer <= 0) {
        this.performDash();
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

  performDash() {
    this.isDashing = true;
    this.isInvulnerable = true; // Fulla i-frames under hela dashen
    this.dashTimer = 0;
    this.dashDuration = COMBAT_CONFIG.dashDuration || 0.20;
    this.dashCooldownTimer = COMBAT_CONFIG.dashCooldown || 0.95;
    this.afterimageTimer = 0;

    // Uthållighetskostnad (om konfigurerad)
    if (COMBAT_CONFIG.dashStaminaCost > 0) {
      this.stamina = Math.max(0, this.stamina - COMBAT_CONFIG.dashStaminaCost);
      this.staminaRegenDelayTimer = 0.5;
    }

    // Bestäm dash-riktning:
    // Om spelaren rör sig (WASD), dasha i nuvarande rörelseriktning
    // Om spelaren står stilla, dasha mot muspekaren
    if (this.isMoving && this.moveVector.lengthSq() > 0) {
      this.dashDirection.copy(this.moveVector).normalize();
    } else {
      this.dashDirection.set(Math.cos(this.aimAngle), Math.sin(this.aimAngle)).normalize();
    }

    // Spelaren fortsätter alltid sikta och titta mot musen
    this.setFlipX(Math.cos(this.aimAngle) < 0);

    // Initial hastighet
    this.vx = this.dashDirection.x * (COMBAT_CONFIG.dashSpeed || 640);
    this.vy = this.dashDirection.y * (COMBAT_CONFIG.dashSpeed || 640);

    // Damm och omedelbar cyan afterimage
    if (this.dustEmitter) {
      this.dustEmitter.emitParticleAt(this.x, this.y + 16, 5);
    }
    this.createDashAfterimage();
  }

  performRoll() {
    this.performDash();
  }

  updateDash(dt) {
    this.dashTimer += dt;

    // Spelaren har 100% i-frames under hela dashen (0.2s)
    this.isInvulnerable = true;

    // Blixtsnabb förflyttning med kollisionshantering
    const dashSpeed = COMBAT_CONFIG.dashSpeed || 640;
    const dx = this.dashDirection.x * dashSpeed * dt;
    const dy = this.dashDirection.y * dashSpeed * dt;
    this.moveWithCollision(dx, dy);

    // Skapa cyan spektral afterimage trail
    this.afterimageTimer += dt;
    if (this.afterimageTimer >= 0.045) {
      this.afterimageTimer = 0;
      this.createDashAfterimage();
    }

    // Avsluta dash efter exakt 0.2 sekunder
    if (this.dashTimer >= this.dashDuration) {
      this.isDashing = false;
      this.isInvulnerable = false;
      this.setRotation(0);
      this.setScale(this.baseScale, this.baseScale);
      if (this.dustEmitter) {
        this.dustEmitter.emitParticleAt(this.x, this.y + 16, 4);
      }
      this.vx = this.dashDirection.x * this.runSpeed;
      this.vy = this.dashDirection.y * this.runSpeed;
    }
  }

  updateRoll(dt) {
    this.updateDash(dt);
  }

  createDashAfterimage() {
    const frame = this.anims.currentFrame ? this.anims.currentFrame.textureFrame : 0;
    const ghost = this.scene.add.sprite(this.x, this.y, 'player_knight', frame);
    ghost.setFlipX(this.flipX);
    ghost.setRotation(this.rotation);
    ghost.setScale(this.scaleX, this.scaleY);
    ghost.setAlpha(0.65);
    ghost.setTint(0x38bdf8); // Cyan spectral tint (Tiny Rogues style)
    ghost.setDepth(this.depth - 1);

    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      scaleX: ghost.scaleX * 0.92,
      scaleY: ghost.scaleY * 0.92,
      duration: 220,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        ghost.destroy();
      },
    });
  }

  createAfterimage() {
    this.createDashAfterimage();
  }

  tryAttack(pointer) {
    if (this.scene && (this.scene.gameState !== 'PLAYING' || this.scene.isTalkingToNPC)) {
      return;
    }
    if (this.health <= 0 || this.isDead || this.isDashing || this.attackCooldownTimer > 0) {
      return;
    }

    const staminaCost = COMBAT_CONFIG.attackStaminaCost || 0;
    if (staminaCost > 0 && this.stamina < staminaCost) {
      return;
    }

    this.performAttack(pointer);
  }

  performAttack(pointer) {
    this.isAttacking = true;
    this.attackTimer = 0;
    const weapon = this.currentWeapon;
    const speed = (weapon && weapon.attackSpeed) || COMBAT_CONFIG.attackSpeed || 3.5;
    this.attackCooldownTimer = 1 / speed;
    this.attackDuration = Math.min(0.22, 0.48 / speed); // Anpassad efter vapnets hastighet
    this.currentSwingId++;

    const staminaCost = (weapon && weapon.attackStaminaCost !== undefined) ? weapon.attackStaminaCost : (COMBAT_CONFIG.attackStaminaCost || 0);
    if (staminaCost > 0) {
      this.stamina = Math.max(0, this.stamina - staminaCost);
      this.staminaRegenDelayTimer = 0.4;
    }

    // Uppdatera vinkel mot muspekaren
    const targetX = pointer.worldX;
    const targetY = pointer.worldY;
    this.aimAngle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
    this.setFlipX(Math.cos(this.aimAngle) < 0);

    // Skapa svepande träffbåge / projektil mot musen
    const slash = new SlashArc(this.scene, this, this.aimAngle);
    if (this.scene.slashes) {
      this.scene.slashes.add(slash);
    }

    // Spela snabb attack-animation
    this.play('player_attack', true);

    // Litet mikrosteg framåt i siktets riktning (mindre för magi/snabba dolkar)
    const nudge = (weapon && weapon.type === 'magic') ? 10 : (speed > 4 ? 18 : 36);
    this.vx += Math.cos(this.aimAngle) * nudge;
    this.vy += Math.sin(this.aimAngle) * nudge;
  }

  updateAttack(dt) {
    this.attackTimer += dt;
    if (this.attackTimer >= this.attackDuration) {
      this.isAttacking = false;
      if (this.isMoving) {
        this.anims.play('player_run', true);
      } else {
        this.anims.play('player_idle', true);
      }
    }
  }

  isPointInAttackCone(targetX, targetY) {
    const weapon = this.currentWeapon;
    const maxRange = (weapon && weapon.range) || COMBAT_CONFIG.attackRange || 85;
    const maxArcDeg = (weapon && weapon.attackArcWidth) || COMBAT_CONFIG.attackArcWidth || 105;

    const dist = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);
    if (dist > maxRange) return false;

    const targetAngle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
    let diff = Phaser.Math.Angle.Wrap(targetAngle - this.aimAngle);
    return Math.abs(diff) <= Phaser.Math.DegToRad(maxArcDeg) / 2;
  }

  /**
   * Byter spelarens aktiva vapen mot ett vapen från registret i src/data/weapons.js.
   *
   * @param {string} weaponId ID för vapnet (t.ex. 'warhammer', 'greatsword', 'scimitar', 'dagger', 'staff')
   * @returns {boolean} true om vapnet utrustades framgångsrikt
   */
  equipWeapon(weaponId) {
    const weapon = WEAPONS[weaponId];
    if (!weapon) {
      console.warn(`[Weapons] Vapen med ID "${weaponId}" finns inte i registret.`);
      return false;
    }

    this.currentWeapon = weapon;

    // Uppdatera synligt vapen
    const ws = this.weaponSprite || this.hammer;
    if (ws) {
      ws.setTexture(weapon.sprite);
      ws.setOrigin(weapon.origin.x, weapon.origin.y);
      this.weaponScale = weapon.scale;
      ws.setScale(weapon.scale);
      ws.setVisible(true);
      if (ws.clearTint) ws.clearTint();

      // Kort visuell puls vid vapenbyte
      if (this.scene) {
        this.scene.tweens.add({
          targets: ws,
          scaleX: weapon.scale * 1.35,
          scaleY: (this.flipX ? -1 : 1) * weapon.scale * 1.35,
          duration: 160,
          yoyo: true,
          ease: 'Quad.easeOut',
        });
      }
    }

    // Visuell flytande text-notis
    const icon = weapon.type === 'magic' ? '✨' : (weapon.type === 'ranged' ? '🏹' : '⚔️');
    this.showFloatingText(`${icon} ${weapon.name}`, weapon.slashColor || 0xfacc15);

    return true;
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
    if (this.scene && this.scene.gameState !== 'PLAYING') {
      return false;
    }
    if (this.isInvulnerable || this.health <= 0 || this.isDead) {
      return false; // Dodged via i-frames or already dead!
    }

    this.health = Math.max(0, this.health - amount);

    // Red damage tint
    this.setTint(0xff2222);
    this.scene.time.delayedCall(160, () => {
      this.clearTint();
    });

    if (this.health <= 0) {
      this.isDead = true;
      this.play('player_death', true);
      this.body.setVelocity(0, 0);
      if (this.hammer) {
        this.hammer.setVisible(false);
      }
      if (this.scene && typeof this.scene.handlePlayerDeath === 'function') {
        this.scene.handlePlayerDeath();
      }
    }

    // Soulsborne camera shake on hit
    this.scene.cameras.main.shake(160, 0.007);

    return true;
  }

  addSouls(amount) {
    this.souls += amount;
  }

  /**
   * Returnerar spelarens bounding box (AABB) vid fötterna.
   * { x, y, width, height }
   */
  getPlayerBounds(x = this.x, y = this.y) {
    const w = this.colliderWidth || 26;
    const h = this.colliderHeight || 18;
    const oy = this.colliderOffsetY !== undefined ? this.colliderOffsetY : 24;
    return {
      x: x - w / 2,
      y: y - h / 2 + oy,
      width: w,
      height: h,
    };
  }

  /**
   * Utför förflyttning med AABB-kollisionskoll innan spelarens position uppdateras med dx/dy.
   * Om det blir en kollision stoppas rörelsen i den axeln (vilket möjliggör mjuk väggglidning).
   *
   * @param {number} dx Önskad förflyttning i X-led
   * @param {number} dy Önskad förflyttning i Y-led
   */
  moveWithCollision(dx, dy) {
    if (dx === 0 && dy === 0) {
      if (this.body) this.body.reset(this.x, this.y);
      return;
    }

    // Hämta spelarens aktuella bounding box
    const currentBounds = this.getPlayerBounds(this.x, this.y);

    // Om scenen har CollisionManager körs axelseparerad kollisionskoll
    if (this.scene && this.scene.collisionManager) {
      const { dx: resolvedDx, dy: resolvedDy, collidedX, collidedY } =
        this.scene.collisionManager.resolveMovement(currentBounds, dx, dy);

      // Om rörelsen stoppades på en axel, nollställ hastigheten på den axeln
      if (collidedX) this.vx = 0;
      if (collidedY) this.vy = 0;

      // Uppdatera spelarens faktiska position med den godkända rörelsen
      this.x += resolvedDx;
      this.y += resolvedDy;
    } else {
      this.x += dx;
      this.y += dy;
    }

    // Synkronisera Arcade Physics-kroppen med den nya positionen
    if (this.body) {
      this.body.reset(this.x, this.y);
    }
  }

  handleMovement(dt) {
    if (this.health <= 0) return;

    let targetVx = 0;
    let targetVy = 0;

    if (this.isMoving) {
      // Normalisera rörelsevektorn så diagonal förflyttning inte går 1.41x snabbare
      this.moveVector.normalize();

      targetVx = this.moveVector.x * this.currentSpeed;
      targetVy = this.moveVector.y * this.currentSpeed;

      // Fotstegsdamm
      this.dustTimer += dt;
      const dustInterval = this.isSprinting ? 0.12 : 0.22;
      if (this.dustTimer >= dustInterval) {
        this.dustTimer = 0;
        this.dustEmitter.emitParticleAt(this.x, this.y + 16, 2);
      }
    }

    // Mjuk acceleration och snabb inbromsning
    this.vx = Phaser.Math.Linear(this.vx || 0, targetVx, 0.25);
    this.vy = Phaser.Math.Linear(this.vy || 0, targetVy, 0.25);
    if (Math.abs(this.vx) < 1 && targetVx === 0) this.vx = 0;
    if (Math.abs(this.vy) < 1 && targetVy === 0) this.vy = 0;

    // Beräkna önskad förflyttning i pixlar denna bildruta (dx, dy)
    const dx = this.vx * dt;
    const dy = this.vy * dt;

    // KOLLISIONSLOGIK: Kontrollera dx/dy mot alla hinder innan positionen uppdateras!
    this.moveWithCollision(dx, dy);
  }

  handleAnimation(dt) {
    if (this.health <= 0 || this.isDashing) {
      return;
    }

    // Snabb attack-animation visas när spelaren nyss svingat
    if (this.isAttacking && this.attackTimer < this.attackDuration) {
      return;
    }

    if (this.isMoving) {
      this.walkCycle += dt * 10;
      this.anims.play('player_run', true);
      this.setRotation(0);
      this.setScale(this.baseScale, this.baseScale);
    } else {
      this.walkCycle = 0;
      this.anims.play('player_idle', true);
      this.setRotation(0);
      this.setScale(this.baseScale, this.baseScale);
    }
  }

  updateWeapon(dt) {
    const ws = this.weaponSprite || this.hammer;
    if (!ws || !ws.visible) return;

    if (this.health <= 0 || this.isDead) {
      ws.setVisible(false);
      return;
    }

    const weapon = this.currentWeapon;
    const baseOffset = (weapon && weapon.baseAngleOffset !== undefined) ? weapon.baseAngleOffset : Math.PI / 4;
    const scale = (weapon && weapon.scale) || this.weaponScale || 2.4;

    const isFacingLeft = Math.cos(this.aimAngle) < 0;
    const sign = isFacingLeft ? -1 : 1;

    // Fästpunkt vid spelarens hand
    const handX = this.x + (isFacingLeft ? -7 : 7);
    const handY = this.y + 3;

    if (this.isDashing) {
      // Under dash: håll vapnet nära kroppen, riktat framåt
      ws.setPosition(handX, handY);
      const dashAngle = this.aimAngle + (isFacingLeft ? -0.2 : 0.2);
      if (!isFacingLeft) {
        ws.setScale(scale * 0.92, scale * 0.92);
        ws.setRotation(dashAngle + baseOffset);
      } else {
        ws.setScale(scale * 0.92, -scale * 0.92);
        ws.setRotation(dashAngle - baseOffset);
      }
      ws.setDepth(this.depth + 1);
      return;
    }

    if (this.isAttacking) {
      // Melee-sving / stöt: sveper kraftfullt genom en båge mot siktet
      const progress = Math.min(1, this.attackTimer / this.attackDuration);
      const ease = Math.sin(progress * Math.PI * 0.5);
      const swingOffset = Phaser.Math.Linear(-1.15, 0.95, ease) * sign;
      const currentAngle = this.aimAngle + swingOffset;

      const extension = Math.sin(progress * Math.PI) * (weapon && weapon.attackSpeed > 4 ? 8 : 4);
      const swingX = handX + Math.cos(this.aimAngle) * extension;
      const swingY = handY + Math.sin(this.aimAngle) * extension;

      ws.setPosition(swingX, swingY);

      if (!isFacingLeft) {
        ws.setScale(scale, scale);
        ws.setRotation(currentAngle + baseOffset);
      } else {
        ws.setScale(scale, -scale);
        ws.setRotation(currentAngle - baseOffset);
      }
      ws.setDepth(this.depth + 1);
    } else {
      // Idle / Gång: hålls i händerna mot muspekaren med naturligt svaj och steg-studs
      const restOffset = -0.35 * sign;
      const sway = this.isMoving
        ? Math.sin(this.walkCycle * 2) * 0.12 * sign
        : Math.sin(this.scene.time.now * 0.004) * 0.05;

      const currentAngle = this.aimAngle + restOffset + sway;
      const bobY = this.isMoving ? Math.sin(this.walkCycle * 2) * 1.2 : 0;

      ws.setPosition(handX, handY + bobY);

      if (!isFacingLeft) {
        ws.setScale(scale, scale);
        ws.setRotation(currentAngle + baseOffset);
      } else {
        ws.setScale(scale, -scale);
        ws.setRotation(currentAngle - baseOffset);
      }
      ws.setDepth(this.depth + 1);
    }
  }

  updateLight() {
    if (this.lightSource) {
      this.lightSource.setPosition(this.x, this.y + 4);
      this.lightSource.setDepth(Math.max(1, this.depth - 1));
    }
  }

  destroy(fromScene) {
    if (this.onKeyDownPreventDefaults) {
      window.removeEventListener('keydown', this.onKeyDownPreventDefaults);
    }
    if (this.scene && this.scene.input && this.pointerDownListener) {
      this.scene.input.off('pointerdown', this.pointerDownListener);
    }
    if (this.shadow) {
      this.shadow.destroy();
    }
    if (this.weaponSprite) {
      this.weaponSprite.destroy();
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
