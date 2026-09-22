import Phaser from 'phaser';

export const EnemyState = {
  PATROL: 'PATROL',
  CHASE: 'CHASE',
  TELEGRAPH: 'TELEGRAPH',
  ATTACKING: 'ATTACKING',
  STAGGER: 'STAGGER',
  DEAD: 'DEAD',
};

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'knight_enemy');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Scale for authentic pixel-art character presence matching the player
    this.baseScale = 0.72;
    this.setScale(this.baseScale);

    // Clear tint so the dark grey steel armor and vibrant red scarf render in authentic pixel art
    this.baseTint = 0xffffff;
    this.clearTint();

    // Physics body matching knight sprite proportions
    this.body.setSize(30, 22);
    this.body.setOffset(26, 82);
    this.setCollideWorldBounds(true);

    // Attributes & Stats
    this.maxHealth = 70;
    this.health = 70;
    this.attackDamage = 20;
    this.patrolSpeed = 45;
    this.chaseSpeed = 120;
    this.detectionRadius = 280;
    this.attackRange = 48;
    this.soulsReward = 250;

    // AI State
    this.state = EnemyState.PATROL;
    this.spawnPoint = new Phaser.Math.Vector2(x, y);
    this.patrolTarget = new Phaser.Math.Vector2(x, y);
    this.patrolTimer = 0;

    // Combat timers
    this.telegraphDuration = 0.42;
    this.telegraphTimer = 0;
    this.attackDuration = 0.28;
    this.attackTimer = 0;
    this.attackAngle = 0;
    this.attackCooldown = 1.1;
    this.attackCooldownTimer = 0;
    this.hasDamagedPlayerThisAttack = false;

    // Stagger / hit reaction
    this.staggerDuration = 0.32;
    this.staggerTimer = 0;
    this.lastHitSwingId = -1;

    // Visual Walk Cycle
    this.walkCycle = 0;

    // Floating HP Bar Graphics
    this.hpBarGraphics = scene.add.graphics();
    this.hpBarGraphics.setDepth(2000);
    this.hpBarTimer = 0;

    // Red aura point light (subtle menacing cursed glow - soft, static)
    if (scene.add.pointlight && scene.game.renderer.type === Phaser.WEBGL) {
      this.lightSource = scene.add.pointlight(x, y, 0xff1111, 70, 0.35, 0.55);
      this.lightSource.setAlpha(0.35);
      this.lightSource.setBlendMode(Phaser.BlendModes.SCREEN);
    } else {
      this.lightSource = null;
    }
  }

  update(time, delta, player) {
    if (this.state === EnemyState.DEAD) return;

    const dt = delta / 1000;

    if (this.attackCooldownTimer > 0) {
      this.attackCooldownTimer -= dt;
    }

    if (this.hpBarTimer > 0) {
      this.hpBarTimer -= dt;
      this.drawHPBar();
    } else {
      this.hpBarGraphics.clear();
    }

    this.updateLight();

    // AI State Machine
    switch (this.state) {
      case EnemyState.PATROL:
        this.updatePatrol(dt, player);
        break;
      case EnemyState.CHASE:
        this.updateChase(dt, player);
        break;
      case EnemyState.TELEGRAPH:
        this.updateTelegraph(dt, player);
        break;
      case EnemyState.ATTACKING:
        this.updateAttacking(dt, player);
        break;
      case EnemyState.STAGGER:
        this.updateStagger(dt);
        break;
    }

    // Y-sorting depth
    this.setDepth(this.y + 10);
  }

  updatePatrol(dt, player) {
    const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    // Detect player
    if (distToPlayer <= this.detectionRadius && player.health > 0) {
      this.state = EnemyState.CHASE;
      this.showAggroAlert();
      return;
    }

    // Wander around spawn point
    this.patrolTimer -= dt;
    if (this.patrolTimer <= 0) {
      this.patrolTimer = Phaser.Math.FloatBetween(2.5, 4.5);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.FloatBetween(20, 90);
      this.patrolTarget.set(
        this.spawnPoint.x + Math.cos(angle) * dist,
        this.spawnPoint.y + Math.sin(angle) * dist
      );
    }

    const distToTarget = Phaser.Math.Distance.Between(this.x, this.y, this.patrolTarget.x, this.patrolTarget.y);
    if (distToTarget > 12) {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, this.patrolTarget.x, this.patrolTarget.y);
      this.body.setVelocity(
        Math.cos(angle) * this.patrolSpeed,
        Math.sin(angle) * this.patrolSpeed
      );
      this.setFlipX(Math.cos(angle) < 0);

      // Walk wobble & stride bobbing
      this.walkCycle += dt * 9;
      const bob = Math.abs(Math.sin(this.walkCycle)) * 0.035;
      const tilt = Math.cos(this.walkCycle) * 0.04;
      this.setScale(this.baseScale * (1 - bob * 0.5), this.baseScale * (1 + bob));
      this.setRotation(tilt);
    } else {
      this.body.setVelocity(0, 0);
      this.setRotation(0);
      this.setScale(this.baseScale, this.baseScale);
      this.walkCycle = 0;
    }
  }

  updateChase(dt, player) {
    const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    // Disengage if player is too far
    if (distToPlayer > 420 || player.health <= 0) {
      this.state = EnemyState.PATROL;
      this.body.setVelocity(0, 0);
      this.setRotation(0);
      this.setScale(this.baseScale, this.baseScale);
      this.walkCycle = 0;
      return;
    }

    // Within attack range
    if (distToPlayer <= this.attackRange && this.attackCooldownTimer <= 0) {
      this.startTelegraph(player);
      return;
    }

    // Move aggressively towards player
    const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
    this.body.setVelocity(
      Math.cos(angle) * this.chaseSpeed,
      Math.sin(angle) * this.chaseSpeed
    );

    this.setFlipX(Math.cos(angle) < 0);

    // Stride bobbing
    this.walkCycle += dt * 13;
    const bob = Math.abs(Math.sin(this.walkCycle)) * 0.04;
    const tilt = Math.cos(this.walkCycle) * 0.06;
    this.setScale(this.baseScale * (1 - bob * 0.5), this.baseScale * (1 + bob));
    this.setRotation(tilt);
  }

  startTelegraph(player) {
    this.state = EnemyState.TELEGRAPH;
    this.telegraphTimer = this.telegraphDuration;
    this.attackAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);

    this.body.setVelocity(0, 0);
    this.setFlipX(Math.cos(this.attackAngle) < 0);

    // Red warning telegraph flash
    this.setTint(0xff3333);

    // Raise weapon / posture telegraph
    this.scene.tweens.add({
      targets: this,
      scaleY: this.baseScale * 1.15,
      scaleX: this.baseScale * 0.9,
      duration: this.telegraphDuration * 1000,
      ease: 'Sine.easeIn',
      yoyo: false,
    });
  }

  updateTelegraph(dt, player) {
    this.telegraphTimer -= dt;

    // Slight tracking adjustment during windup
    const currentAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
    this.attackAngle = Phaser.Math.Angle.RotateTo(this.attackAngle, currentAngle, dt * 2.5);
    this.setFlipX(Math.cos(this.attackAngle) < 0);

    if (this.telegraphTimer <= 0) {
      this.executeAttack(player);
    }
  }

  executeAttack(player) {
    this.state = EnemyState.ATTACKING;
    this.attackTimer = this.attackDuration;
    this.hasDamagedPlayerThisAttack = false;
    this.clearTint();
    this.setScale(this.baseScale);

    // Forward lunge
    const lungeSpeed = 160;
    this.body.setVelocity(
      Math.cos(this.attackAngle) * lungeSpeed,
      Math.sin(this.attackAngle) * lungeSpeed
    );

    // Spawn Crimson Cleave Slash Arc
    const spawnDist = 18;
    const slash = this.scene.add.sprite(
      this.x + Math.cos(this.attackAngle) * spawnDist,
      this.y + Math.sin(this.attackAngle) * spawnDist,
      'enemy_slash_arc'
    );
    slash.setOrigin(0.2, 0.5);
    slash.setRotation(this.attackAngle);
    slash.setScale(0.8, 0.8);
    slash.setAlpha(0.95);
    slash.setDepth(this.depth + 2);

    this.scene.tweens.add({
      targets: slash,
      scaleX: 1.25,
      scaleY: 1.25,
      alpha: 0,
      duration: 240,
      ease: 'Cubic.easeOut',
      onComplete: () => slash.destroy(),
    });

    // Check hit on player during active frame
    this.scene.time.delayedCall(80, () => {
      if (this.state === EnemyState.ATTACKING && !this.hasDamagedPlayerThisAttack) {
        this.checkAttackHitOnPlayer(player);
      }
    });
  }

  updateAttacking(dt, player) {
    this.attackTimer -= dt;

    // Decelerate lunge
    const progress = 1 - (this.attackTimer / this.attackDuration);
    const speed = Phaser.Math.Linear(160, 0, progress);
    this.body.setVelocity(
      Math.cos(this.attackAngle) * speed,
      Math.sin(this.attackAngle) * speed
    );

    if (this.attackTimer <= 0) {
      this.state = EnemyState.CHASE;
      this.attackCooldownTimer = this.attackCooldown;
      this.body.setVelocity(0, 0);
      this.setRotation(0);
      this.setScale(this.baseScale);
    }
  }

  checkAttackHitOnPlayer(player) {
    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    if (dist <= 56) {
      const angleToPlayer = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
      const angleDiff = Math.abs(Phaser.Math.Angle.Wrap(angleToPlayer - this.attackAngle));

      // 120-degree cone for enemy cleave
      if (angleDiff <= Phaser.Math.DegToRad(60)) {
        this.hasDamagedPlayerThisAttack = true;
        player.takeDamage(this.attackDamage);
      }
    }
  }

  takeDamage(amount, sourceX, sourceY) {
    if (this.state === EnemyState.DEAD) return;

    this.health = Math.max(0, this.health - amount);
    this.hpBarTimer = 4.0; // Show HP bar for 4 seconds

    // Visual damage reaction
    this.setTint(0xffffff);
    this.scene.time.delayedCall(90, () => {
      if (this.state !== EnemyState.DEAD) {
        this.setTint(0xff3333);
        this.scene.time.delayedCall(120, () => {
          if (this.state !== EnemyState.DEAD) this.clearTint();
        });
      }
    });

    // Hit particle sparks
    this.scene.add.particles(this.x, this.y + 10, 'ember_spark', {
      speed: { min: 80, max: 180 },
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 250,
      quantity: 8,
      blendMode: 'ADD',
    });

    // Knockback
    const kbAngle = Phaser.Math.Angle.Between(sourceX, sourceY, this.x, this.y);
    const kbForce = 150;
    this.body.setVelocity(
      Math.cos(kbAngle) * kbForce,
      Math.sin(kbAngle) * kbForce
    );

    // Stagger state
    if (this.health > 0) {
      this.state = EnemyState.STAGGER;
      this.staggerTimer = this.staggerDuration;
    } else {
      this.die();
    }
  }

  updateStagger(dt) {
    this.staggerTimer -= dt;
    this.body.setVelocity(
      Phaser.Math.Linear(this.body.velocity.x, 0, 0.2),
      Phaser.Math.Linear(this.body.velocity.y, 0, 0.2)
    );

    if (this.staggerTimer <= 0) {
      this.state = EnemyState.CHASE;
      this.clearTint();
      this.setScale(this.baseScale);
      this.setRotation(0);
    }
  }

  die() {
    this.state = EnemyState.DEAD;
    this.body.setVelocity(0, 0);
    this.body.enable = false;
    this.hpBarGraphics.clear();

    // Reward souls to player
    if (this.scene.player) {
      this.scene.player.addSouls(this.soulsReward);
    }

    // Death fade & soul particles
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: this.baseScale * 0.6,
      scaleY: this.baseScale * 0.6,
      duration: 500,
      ease: 'Sine.easeOut',
      onComplete: () => {
        // Golden soul orbs dispersing
        this.emitDeathSouls();
        this.destroy();
      },
    });
  }

  emitDeathSouls() {
    const soulParticles = this.scene.add.particles(this.x, this.y, 'ember_spark', {
      speed: { min: 40, max: 110 },
      scale: { start: 1.2, end: 0.1 },
      alpha: { start: 1, end: 0 },
      lifespan: 800,
      quantity: 14,
      blendMode: 'ADD',
      tint: 0xffd700, // Golden souls
    });
    this.scene.time.delayedCall(850, () => soulParticles.destroy());
  }

  showAggroAlert() {
    // Menacing red eye flash
    const alert = this.scene.add.text(this.x, this.y - 32, '!', {
      fontFamily: 'Cinzel, serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ff2222',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.scene.tweens.add({
      targets: alert,
      y: this.y - 44,
      alpha: 0,
      duration: 600,
      ease: 'Cubic.easeOut',
      onComplete: () => alert.destroy(),
    });
  }

  drawHPBar() {
    this.hpBarGraphics.clear();
    const barWidth = 32;
    const barHeight = 4;
    const bx = this.x - barWidth / 2;
    const by = this.y - 28;

    // Dark background
    this.hpBarGraphics.fillStyle(0x000000, 0.8);
    this.hpBarGraphics.fillRect(bx - 1, by - 1, barWidth + 2, barHeight + 2);

    // HP fill
    const ratio = Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1);
    this.hpBarGraphics.fillStyle(0xb91c1c, 0.95);
    this.hpBarGraphics.fillRect(bx, by, barWidth * ratio, barHeight);
  }

  updateLight() {
    if (this.lightSource) {
      this.lightSource.x = this.x;
      this.lightSource.y = this.y + 4;
    }
  }

  destroy(fromScene) {
    if (this.lightSource) {
      this.lightSource.destroy();
    }
    if (this.hpBarGraphics) {
      this.hpBarGraphics.destroy();
    }
    super.destroy(fromScene);
  }
}
