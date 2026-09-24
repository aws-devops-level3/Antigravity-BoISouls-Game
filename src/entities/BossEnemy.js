import Phaser from 'phaser';

export const BossState = {
  DORMANT: 'DORMANT',
  AWAKENING: 'AWAKENING',
  CHASE: 'CHASE',
  TELEGRAPH_NORMAL: 'TELEGRAPH_NORMAL',
  ATTACK_NORMAL: 'ATTACK_NORMAL',
  TELEGRAPH_SCREAM: 'TELEGRAPH_SCREAM',
  TELEGRAPH_TELEPORT: 'TELEGRAPH_TELEPORT',
  STAGGER: 'STAGGER',
  DEAD: 'DEAD',
};

export class SpectralOrb extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, angle, damage = 22) {
    super(scene, x, y, 'spectral_orb');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.damage = damage;
    this.speed = 270;
    this.maxLifespan = 2.4;
    this.lifeTimer = 0;
    this.hasHit = false;

    this.setScale(1.2);
    this.setRotation(angle);
    this.setAlpha(0.95);
    this.setBlendMode(Phaser.BlendModes.ADD);

    this.body.setCircle(10, 2, 2);
    this.body.setVelocity(
      Math.cos(angle) * this.speed,
      Math.sin(angle) * this.speed
    );

    this.setDepth(y + 30);

    // Cyan frost mist trail
    this.trail = scene.add.particles(0, 0, 'dust_puff', {
      speed: { min: 6, max: 20 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.6, end: 0 },
      tint: [0xa5f3fc, 0x38bdf8, 0xc084fc],
      lifespan: 220,
      frequency: 28,
      blendMode: 'ADD',
    });
    this.trail.startFollow(this);
    this.trail.setDepth(this.depth - 1);
  }

  update(time, delta) {
    if (this.hasHit) return;

    const dt = delta / 1000;
    this.lifeTimer += dt;
    this.setDepth(this.y + 30);

    if (this.lifeTimer >= this.maxLifespan) {
      this.destroyOrb(false);
    }
  }

  onHitObstacle() {
    if (this.hasHit) return;
    this.destroyOrb(true);
  }

  onHitPlayer(player) {
    if (this.hasHit) return;
    if (player.isInvulnerable) {
      return; // Dodged through i-frames
    }
    const damaged = player.takeDamage(this.damage);
    if (damaged) {
      this.destroyOrb(true);
    }
  }

  destroyOrb(spawnParticles = true) {
    this.hasHit = true;
    if (this.trail) {
      this.trail.stop();
      this.scene.time.delayedCall(160, () => {
        if (this.trail) this.trail.destroy();
      });
    }

    if (spawnParticles && this.scene) {
      const burst = this.scene.add.particles(this.x, this.y, 'ember_spark', {
        speed: { min: 50, max: 150 },
        scale: { start: 0.8, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: [0xa5f3fc, 0x67e8f9, 0xffffff],
        lifespan: 250,
        quantity: 8,
        blendMode: 'ADD',
      });
      this.scene.time.delayedCall(260, () => burst.destroy());
    }

    this.destroy();
  }
}

export default class BossEnemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'boss_enemy');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Towering, imposing boss presence (~130px height on screen)
    this.baseScale = 0.13;
    this.setScale(this.baseScale);

    // Ethereal translucent presence
    this.baseAlpha = 0.95;
    this.setAlpha(this.baseAlpha);
    this.clearTint();

    // Physics body centered on the wraith queen's torso
    this.body.setSize(180, 260);
    this.body.setOffset(294, 380);
    this.setCollideWorldBounds(true);

    // Boss Stats - Formidable Soulsborne Boss
    this.maxHealth = 500;
    this.health = 500;
    this.attackDamage = 28;
    this.chaseSpeed = 135;
    this.phase2Speed = 175;
    this.activationRadius = 330; // Triggers when player nears the chest
    this.attackRange = 64;
    this.soulsReward = 2500;
    this.isPhase2 = false;

    // AI & Combat timers
    this.state = BossState.DORMANT;
    this.spawnPoint = new Phaser.Math.Vector2(x, y);

    this.attackCooldownTimer = 1.0;
    this.specialCooldownTimer = 3.5; // Starts ready shortly after awakening
    this.lastSpecialType = 0; // alternates between scream (1) and teleport (2)

    this.telegraphTimer = 0;
    this.attackTimer = 0;
    this.attackAngle = 0;

    // Visual float and hover
    this.hoverTimer = 0;
    this.hasDamagedPlayerThisAttack = false;
    this.lastHitSwingId = -1;

    // Cyan ethereal aura light glow on the floor & chest
    this.lightSource = scene.add.image(x, y + 25, 'soft_cyan_glow');
    this.lightSource.setDisplaySize(90, 90);
    this.lightSource.setAlpha(0.25);
    this.lightSource.setDepth(1);
    this.lightSource.setBlendMode(Phaser.BlendModes.ADD);

    // Constant phantom wisp emitter
    this.wispEmitter = scene.add.particles(x, y + 20, 'dust_puff', {
      speed: { min: 8, max: 28 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.35, end: 0 },
      tint: [0xa5f3fc, 0xbae6fd, 0xe0e7ff],
      lifespan: 500,
      frequency: 120,
      blendMode: 'ADD',
    });
    this.wispEmitter.setDepth(this.depth - 1);

    // Create Grand Soulsborne Boss Health Bar UI
    this.createBossHealthBar();
  }

  createBossHealthBar() {
    const cam = this.scene.cameras.main;
    this.bossBarContainer = this.scene.add.container(cam.width / 2, cam.height - 48);
    this.bossBarContainer.setScrollFactor(0);
    this.bossBarContainer.setDepth(3000);
    this.bossBarContainer.setAlpha(0); // Hidden while dormant

    const barW = 520;
    const barH = 12;

    // Background panel
    const bgGraphics = this.scene.add.graphics();
    bgGraphics.fillStyle(0x06050a, 0.9);
    bgGraphics.fillRect(-barW / 2 - 4, -barH / 2 - 4, barW + 8, barH + 8);
    bgGraphics.lineStyle(1.8, 0xd4af37, 0.9);
    bgGraphics.strokeRect(-barW / 2 - 4, -barH / 2 - 4, barW + 8, barH + 8);

    // Inner trim
    bgGraphics.lineStyle(0.8, 0x854d0e, 0.6);
    bgGraphics.strokeRect(-barW / 2 - 1, -barH / 2 - 1, barW + 2, barH + 2);

    // Dynamic HP fill graphics
    this.hpBarFill = this.scene.add.graphics();

    // Damage catch-up bar
    this.damageLagHp = this.health;
    this.lagBarFill = this.scene.add.graphics();

    // Boss Title
    const titleText = this.scene.add.text(0, -22, 'VÅLNADENS DROTTNING', {
      fontFamily: 'Cinzel, serif',
      fontSize: '17px',
      fontStyle: 'bold',
      letterSpacing: 4,
      color: '#f8fafc',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    const subTitleText = this.scene.add.text(0, 16, '— Väktaren av den Förbannade Kistan —', {
      fontFamily: 'Cinzel, serif',
      fontSize: '11px',
      letterSpacing: 2,
      color: '#c084fc',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    this.bossBarContainer.add([bgGraphics, this.lagBarFill, this.hpBarFill, titleText, subTitleText]);

    // Handle window resize for boss bar
    this.scene.scale.on('resize', (gameSize) => {
      if (this.bossBarContainer) {
        this.bossBarContainer.setPosition(gameSize.width / 2, gameSize.height - 48);
      }
    });
  }

  update(time, delta, player) {
    if (this.state === BossState.DEAD) return;

    const dt = delta / 1000;
    this.hoverTimer += dt * 3.2;

    // Hover bobbing effect
    const hoverOffset = Math.sin(this.hoverTimer) * 4;
    this.setDepth(this.y + 15);

    // Update emitters and light
    if (this.lightSource) {
      this.lightSource.x = this.x;
      this.lightSource.y = this.y + 25 + hoverOffset;
    }
    if (this.wispEmitter) {
      this.wispEmitter.setPosition(this.x, this.y + 20 + hoverOffset);
    }

    // Update Boss HP bar
    this.updateBossBar(dt);

    // AI State Machine
    switch (this.state) {
      case BossState.DORMANT:
        this.updateDormant(player);
        break;
      case BossState.AWAKENING:
        // Handled by awakening tween
        break;
      case BossState.CHASE:
        this.updateChase(dt, player);
        break;
      case BossState.TELEGRAPH_NORMAL:
        this.updateTelegraphNormal(dt, player);
        break;
      case BossState.ATTACK_NORMAL:
        this.updateAttackNormal(dt, player);
        break;
      case BossState.TELEGRAPH_SCREAM:
        this.updateTelegraphScream(dt, player);
        break;
      case BossState.TELEGRAPH_TELEPORT:
        // Handled by teleport sequence
        break;
      case BossState.STAGGER:
        this.updateStagger(dt);
        break;
    }
  }

  updateDormant(player) {
    this.body.setVelocity(0, 0);

    // Smooth hovering float animation in the air while standing still at the chest
    const hoverY = Math.sin(this.hoverTimer * 2.2) * 11;
    this.x = this.spawnPoint.x;
    this.y = this.spawnPoint.y + hoverY;

    // Ethereal breathing stretch & squash
    const breath = Math.sin(this.hoverTimer * 2.2);
    const breathY = 1 + breath * 0.055;
    const breathX = 1 - breath * 0.035;
    this.setScale(this.baseScale * breathX, this.baseScale * breathY);

    // Subtle ghostly swaying tilt
    const sway = Math.sin(this.hoverTimer * 1.3) * 0.045;
    this.setRotation(sway);

    // Translucent spectral breathing alpha
    this.setAlpha(0.85 + Math.sin(this.hoverTimer * 1.8) * 0.1);

    // Cyan glowing ground aura pulses underneath the chest
    if (this.lightSource) {
      this.lightSource.x = this.x;
      this.lightSource.y = this.spawnPoint.y + 26;
      this.lightSource.setAlpha(0.20 + Math.sin(this.hoverTimer * 2.2) * 0.08);
      const glowSize = 90 + Math.sin(this.hoverTimer * 2.2) * 14;
      this.lightSource.setDisplaySize(glowSize, glowSize);
    }

    if (this.wispEmitter) {
      this.wispEmitter.setPosition(this.x, this.y + 22);
    }

    // Check distance to player
    const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    if (distToPlayer <= this.activationRadius && player.health > 0) {
      this.awakenBoss(player);
    }
  }

  awakenBoss(player) {
    this.state = BossState.AWAKENING;
    this.setFlipX(player.x < this.x);

    // Soulsborne cinematic awakening roar & camera shake
    this.scene.cameras.main.shake(600, 0.009);

    // Fade in boss bar with gold glow
    this.scene.tweens.add({
      targets: this.bossBarContainer,
      alpha: 1,
      duration: 1200,
      ease: 'Cubic.easeOut',
    });

    // Boss rises into the air, eyes ignite
    this.setTint(0x67e8f9);

    const screamParticles = this.scene.add.particles(this.x, this.y - 20, 'ember_spark', {
      speed: { min: 80, max: 200 },
      scale: { start: 1.2, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0x67e8f9, 0xa855f7, 0xffffff],
      lifespan: 500,
      quantity: 24,
      blendMode: 'ADD',
    });
    this.scene.time.delayedCall(550, () => screamParticles.destroy());

    this.scene.tweens.add({
      targets: this,
      scaleX: this.baseScale * 1.15,
      scaleY: this.baseScale * 1.15,
      alpha: 1.0,
      duration: 800,
      yoyo: true,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.clearTint();
        this.setScale(this.baseScale);
        this.state = BossState.CHASE;
      },
    });
  }

  updateChase(dt, player) {
    if (this.attackCooldownTimer > 0) {
      this.attackCooldownTimer -= dt;
    }
    if (this.specialCooldownTimer > 0) {
      this.specialCooldownTimer -= dt;
    }

    const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    const speed = this.isPhase2 ? this.phase2Speed : this.chaseSpeed;

    // Check Special Attack trigger
    if (this.specialCooldownTimer <= 0 && distToPlayer <= 380) {
      // Alternate between Special 1 (Scream) and Special 2 (Teleport)
      if (this.lastSpecialType === 1) {
        this.startSpecialTeleport(player);
        this.lastSpecialType = 2;
      } else {
        this.startSpecialScream(player);
        this.lastSpecialType = 1;
      }
      return;
    }

    // Check Normal Attack trigger
    if (distToPlayer <= this.attackRange && this.attackCooldownTimer <= 0) {
      this.startTelegraphNormal(player);
      return;
    }

    // Glide smoothly towards player
    const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
    this.body.setVelocity(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed
    );
    this.setFlipX(player.x < this.x);
    // Floating breathing undulation and sway during chase
    const breath = Math.sin(this.hoverTimer * 2.5);
    const breathY = 1 + breath * 0.045;
    const breathX = 1 - breath * 0.025;
    const sway = Math.cos(this.hoverTimer * 1.5) * 0.05;
    this.setRotation(sway);
    this.setScale(this.baseScale * breathX, this.baseScale * breathY);
    this.setAlpha(0.92 + Math.sin(this.hoverTimer * 2.0) * 0.08);

    if (this.lightSource) {
      this.lightSource.x = this.x;
      this.lightSource.y = this.y + 25;
    }
    if (this.wispEmitter) {
      this.wispEmitter.setPosition(this.x, this.y + 20);
    }
  }

  // --- Normal Attack: Dual Ghost Claw Cleave ---
  startTelegraphNormal(player) {
    this.state = BossState.TELEGRAPH_NORMAL;
    this.telegraphTimer = 0.42;
    this.attackAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);

    this.body.setVelocity(0, 0);
    this.setFlipX(player.x < this.x);
    this.setTint(0xa855f7); // Violet strike telegraph

    this.scene.tweens.add({
      targets: this,
      scaleX: this.baseScale * 0.88,
      scaleY: this.baseScale * 1.15,
      duration: 380,
      ease: 'Sine.easeIn',
    });
  }

  updateTelegraphNormal(dt, player) {
    this.telegraphTimer -= dt;
    const currentAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
    this.attackAngle = Phaser.Math.Angle.RotateTo(this.attackAngle, currentAngle, dt * 3.5);
    this.setFlipX(Math.cos(this.attackAngle) < 0);

    if (this.telegraphTimer <= 0) {
      this.executeNormalAttack(player);
    }
  }

  executeNormalAttack(player) {
    this.state = BossState.ATTACK_NORMAL;
    this.attackTimer = 0.26;
    this.hasDamagedPlayerThisAttack = false;
    this.clearTint();
    this.setScale(this.baseScale);

    // Fast ghost lunge
    const lungeSpeed = 260;
    this.body.setVelocity(
      Math.cos(this.attackAngle) * lungeSpeed,
      Math.sin(this.attackAngle) * lungeSpeed
    );

    // Massive ethereal claw slash arc
    const spawnDist = 26;
    const slash = this.scene.add.sprite(
      this.x + Math.cos(this.attackAngle) * spawnDist,
      this.y + Math.sin(this.attackAngle) * spawnDist,
      'ghost_claw'
    );
    slash.setOrigin(0.2, 0.5);
    slash.setRotation(this.attackAngle);
    slash.setScale(1.4, 1.4);
    slash.setAlpha(0.95);
    slash.setDepth(this.depth + 2);
    slash.setTint(this.isPhase2 ? 0xf43f5e : 0x38bdf8);

    this.scene.tweens.add({
      targets: slash,
      scaleX: 2.1,
      scaleY: 2.1,
      alpha: 0,
      duration: 260,
      ease: 'Cubic.easeOut',
      onComplete: () => slash.destroy(),
    });

    // Check hit on player during active frame
    this.scene.time.delayedCall(70, () => {
      if (this.state === BossState.ATTACK_NORMAL && !this.hasDamagedPlayerThisAttack) {
        const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        if (dist <= 75) {
          this.hasDamagedPlayerThisAttack = true;
          player.takeDamage(this.attackDamage);
        }
      }
    });
  }

  updateAttackNormal(dt) {
    this.attackTimer -= dt;
    this.body.setVelocity(
      Phaser.Math.Linear(this.body.velocity.x, 0, 0.15),
      Phaser.Math.Linear(this.body.velocity.y, 0, 0.15)
    );

    if (this.attackTimer <= 0) {
      this.state = BossState.CHASE;
      this.attackCooldownTimer = this.isPhase2 ? 0.8 : 1.2;
      this.body.setVelocity(0, 0);
      this.setScale(this.baseScale);
    }
  }

  // --- SPECIAL ATTACK 1: Banshee Wail / Frost Nova Scream (Radial Orb Wave) ---
  startSpecialScream(player) {
    this.state = BossState.TELEGRAPH_SCREAM;
    this.telegraphTimer = 0.75;
    this.body.setVelocity(0, 0);
    this.setFlipX(player.x < this.x);

    // Glowing cyan/white ascension
    this.setTint(0x38bdf8);

    // Expanding frost charge ring
    const chargeRing = this.scene.add.circle(this.x, this.y, 10, 0x38bdf8, 0.4);
    chargeRing.setDepth(this.depth - 1);
    this.scene.tweens.add({
      targets: chargeRing,
      radius: 90,
      alpha: 0,
      duration: 700,
      ease: 'Cubic.easeOut',
      onComplete: () => chargeRing.destroy(),
    });

    this.scene.tweens.add({
      targets: this,
      scaleX: this.baseScale * 1.25,
      scaleY: this.baseScale * 1.25,
      duration: 700,
      ease: 'Sine.easeIn',
    });
  }

  updateTelegraphScream(dt) {
    this.telegraphTimer -= dt;

    if (this.telegraphTimer <= 0) {
      this.executeScreamNova();
    }
  }

  executeScreamNova() {
    this.clearTint();
    this.setScale(this.baseScale);

    // Screen tremor on deafening banshee screech
    this.scene.cameras.main.shake(350, 0.008);

    // Burst of 10 radial spectral orbs
    const numOrbs = this.isPhase2 ? 12 : 10;
    const baseAngle = Phaser.Math.FloatBetween(0, Math.PI / numOrbs);

    for (let i = 0; i < numOrbs; i++) {
      const angle = baseAngle + (i * (Math.PI * 2 / numOrbs));
      const orb = new SpectralOrb(this.scene, this.x, this.y, angle, 24);
      if (this.scene.enemyProjectiles) {
        this.scene.enemyProjectiles.add(orb);
      }
    }

    // Scream shockwave particles
    const shockwave = this.scene.add.particles(this.x, this.y, 'ember_spark', {
      speed: { min: 90, max: 240 },
      scale: { start: 1.0, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xa5f3fc, 0x38bdf8, 0xffffff],
      lifespan: 400,
      quantity: 26,
      blendMode: 'ADD',
    });
    this.scene.time.delayedCall(450, () => shockwave.destroy());

    this.specialCooldownTimer = this.isPhase2 ? 3.0 : 4.5;
    this.attackCooldownTimer = 1.0;
    this.state = BossState.CHASE;
  }

  // --- SPECIAL ATTACK 2: Phantom Teleport & Shadow Claw Ambush ---
  startSpecialTeleport(player) {
    this.state = BossState.TELEGRAPH_TELEPORT;
    this.body.setVelocity(0, 0);

    // Dissolve into dark mist
    const mistDisperse = this.scene.add.particles(this.x, this.y, 'dust_puff', {
      speed: { min: 30, max: 90 },
      scale: { start: 1.0, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: [0xc084fc, 0x38bdf8, 0x1e1b4b],
      lifespan: 450,
      quantity: 18,
      blendMode: 'ADD',
    });
    this.scene.time.delayedCall(500, () => mistDisperse.destroy());

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: this.baseScale * 0.3,
      scaleY: this.baseScale * 0.3,
      duration: 350,
      ease: 'Sine.easeIn',
      onComplete: () => {
        // Teleport near the player (offset ~70px behind or to the flank)
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const dist = 75;
        this.x = player.x + Math.cos(angle) * dist;
        this.y = player.y + Math.sin(angle) * dist;

        // Reappear with spectral burst
        this.reappearAndAmbush(player);
      },
    });
  }

  reappearAndAmbush(player) {
    this.setFlipX(player.x < this.x);

    const reappearParticles = this.scene.add.particles(this.x, this.y, 'ember_spark', {
      speed: { min: 50, max: 140 },
      scale: { start: 1.0, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xa855f7, 0xec4899, 0xffffff],
      lifespan: 350,
      quantity: 16,
      blendMode: 'ADD',
    });
    this.scene.time.delayedCall(400, () => reappearParticles.destroy());

    this.scene.tweens.add({
      targets: this,
      alpha: 1.0,
      scaleX: this.baseScale * 1.1,
      scaleY: this.baseScale * 1.1,
      duration: 250,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.setScale(this.baseScale);
        // Instant ferocious strike!
        const aimAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        this.attackAngle = aimAngle;
        this.attackDamage = 36; // Bonus damage on ambush
        this.executeNormalAttack(player);
        this.attackDamage = 28; // Reset back to standard

        this.specialCooldownTimer = this.isPhase2 ? 3.2 : 5.0;
      },
    });
  }

  takeDamage(amount, sourceX, sourceY) {
    if (this.state === BossState.DEAD) return;

    // Wake up immediately if damaged while dormant
    if (this.state === BossState.DORMANT) {
      this.awakenBoss(this.scene.player);
    }

    this.health = Math.max(0, this.health - amount);

    // Damage reaction flash
    this.setTint(0xff3333);
    this.scene.time.delayedCall(100, () => {
      if (this.state !== BossState.DEAD) {
        if (this.isPhase2) {
          this.setTint(0xf43f5e);
        } else {
          this.clearTint();
        }
      }
    });

    // Massive soul sparks on hit
    this.scene.add.particles(this.x, this.y, 'ember_spark', {
      speed: { min: 80, max: 200 },
      scale: { start: 1.1, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xa5f3fc, 0xd4af37, 0xffffff],
      lifespan: 260,
      quantity: 12,
      blendMode: 'ADD',
    });

    // Check Phase 2 Transition (at 50% HP)
    if (!this.isPhase2 && this.health <= this.maxHealth * 0.5) {
      this.enterPhase2();
    }

    if (this.health <= 0) {
      this.die();
    }
  }

  enterPhase2() {
    this.isPhase2 = true;
    this.scene.cameras.main.shake(500, 0.012);

    // Red enraged aura
    if (this.lightSource) {
      this.lightSource.setTexture('soft_red_glow');
      this.lightSource.setDisplaySize(120, 120);
      this.lightSource.setAlpha(0.35);
    }

    // Scream shockwave
    this.executeScreamNova();
  }

  updateStagger(dt) {
    // Boss recovers quickly from staggers
    this.state = BossState.CHASE;
  }

  updateBossBar(dt) {
    if (!this.hpBarFill || !this.bossBarContainer || this.bossBarContainer.alpha <= 0) return;

    const barW = 520;
    const barH = 12;
    const ratio = Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1);

    // Smooth lag catch-up for authentic Dark Souls damage feedback
    if (this.damageLagHp > this.health) {
      this.damageLagHp = Phaser.Math.Linear(this.damageLagHp, this.health, dt * 2.5);
    } else {
      this.damageLagHp = this.health;
    }
    const lagRatio = Phaser.Math.Clamp(this.damageLagHp / this.maxHealth, 0, 1);

    // Draw lag bar (pale yellow-white damage flash)
    this.lagBarFill.clear();
    this.lagBarFill.fillStyle(0xfde047, 0.9);
    this.lagBarFill.fillRect(-barW / 2, -barH / 2, barW * lagRatio, barH);

    // Draw active HP bar (crimson-violet fill)
    this.hpBarFill.clear();
    const fillColor = this.isPhase2 ? 0xe11d48 : 0x9333ea;
    this.hpBarFill.fillStyle(fillColor, 1.0);
    this.hpBarFill.fillRect(-barW / 2, -barH / 2, barW * ratio, barH);
  }

  die() {
    this.state = BossState.DEAD;
    this.body.setVelocity(0, 0);
    this.body.enable = false;

    // Camera rumble on boss defeat
    this.scene.cameras.main.shake(1000, 0.015);

    // Fade out boss health bar
    if (this.bossBarContainer) {
      this.scene.tweens.add({
        targets: this.bossBarContainer,
        alpha: 0,
        duration: 900,
        ease: 'Sine.easeOut',
      });
    }

    if (this.scene.player) {
      this.scene.player.addSouls(this.soulsReward);
    }

    // Cataclysmic soul eruption
    const soulExplosion = this.scene.add.particles(this.x, this.y, 'ember_spark', {
      speed: { min: 80, max: 320 },
      scale: { start: 1.8, end: 0.1 },
      alpha: { start: 1, end: 0 },
      tint: [0xffd700, 0xa5f3fc, 0xffffff, 0xf43f5e],
      lifespan: 1200,
      quantity: 50,
      blendMode: 'ADD',
    });
    this.scene.time.delayedCall(1300, () => soulExplosion.destroy());

    // Dissolve into the light
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: this.baseScale * 1.6,
      scaleY: this.baseScale * 1.6,
      duration: 1200,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (this.scene && typeof this.scene.displayVictoryBanner === 'function') {
          this.scene.displayVictoryBanner();
        }
        this.destroy();
      },
    });
  }

  destroy(fromScene) {
    if (this.lightSource) this.lightSource.destroy();
    if (this.wispEmitter) this.wispEmitter.destroy();
    if (this.bossBarContainer) this.bossBarContainer.destroy();
    super.destroy(fromScene);
  }
}
