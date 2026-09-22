import Phaser from 'phaser';

export const GhostState = {
  PATROL: 'PATROL',
  CHASE: 'CHASE',
  TELEGRAPH: 'TELEGRAPH',
  ATTACKING: 'ATTACKING',
  STAGGER: 'STAGGER',
  DEAD: 'DEAD',
};

export default class GhostEnemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'ghost_enemy');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Scale reduced by 8% (0.36 * 0.92 = 0.3312)
    this.baseScale = 0.3312;
    this.setScale(this.baseScale);

    // Ethereal white spectral body
    this.baseAlpha = 0.95;
    this.setAlpha(this.baseAlpha);
    this.clearTint();

    // Physics body matching ghost torso and center mass
    this.body.setSize(105, 105);
    this.body.setOffset(60, 58);
    this.setCollideWorldBounds(true);

    // Stats & Attributes
    this.maxHealth = 45;
    this.health = 45;
    this.attackDamage = 15;
    this.patrolSpeed = 50;
    this.chaseSpeed = 135; // Swift spectral glide
    this.detectionRadius = 320;
    this.attackRange = 52;
    this.soulsReward = 180;

    // AI State
    this.state = GhostState.PATROL;
    this.spawnPoint = new Phaser.Math.Vector2(x, y);
    this.patrolTarget = new Phaser.Math.Vector2(x, y);
    this.patrolTimer = 0;

    // Hover & Bobbing timer
    this.hoverTimer = Phaser.Math.FloatBetween(0, Math.PI * 2);

    // Attack Timers
    this.telegraphDuration = 0.35;
    this.telegraphTimer = 0;
    this.attackDuration = 0.24;
    this.attackTimer = 0;
    this.attackAngle = 0;
    this.attackCooldown = 1.0;
    this.attackCooldownTimer = 0;
    this.hasDamagedPlayerThisAttack = false;

    // Stagger / hit reaction
    this.staggerDuration = 0.28;
    this.staggerTimer = 0;
    this.lastHitSwingId = -1;

    // Local HP Bar
    this.hpBarGraphics = scene.add.graphics();
    this.hpBarGraphics.setDepth(2000);
    this.hpBarTimer = 0;

    // Menacing red aura point light centered on its glowing red eyes (soft, static)
    if (scene.add.pointlight && scene.game.renderer.type === Phaser.WEBGL) {
      this.lightSource = scene.add.pointlight(x, y - 18, 0xff0022, 70, 0.35, 0.55);
      this.lightSource.setAlpha(0.35);
      this.lightSource.setBlendMode(Phaser.BlendModes.SCREEN);
    } else {
      this.lightSource = null;
    }

    // Wispy spirit mist trail emitter
    this.mistEmitter = scene.add.particles(0, 0, 'dust_puff', {
      speed: { min: 6, max: 18 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.35, end: 0 },
      tint: 0x88aacc,
      lifespan: 400,
      frequency: -1, // manual emit
    });
    this.mistTimer = 0;
  }

  update(time, delta, player) {
    if (this.state === GhostState.DEAD) return;

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

    // Ghost hovering float effect (sine wave vertical bob)
    this.hoverTimer += dt * 3.5;
    const hoverScale = 1 + Math.sin(this.hoverTimer) * 0.04;
    this.setScale(this.baseScale, this.baseScale * hoverScale);

    // Periodic mist trail
    this.mistTimer += dt;
    if (this.mistTimer >= 0.16) {
      this.mistTimer = 0;
      this.mistEmitter.emitParticleAt(this.x, this.y + 12, 1);
    }

    this.updateLight();

    // AI State Machine
    switch (this.state) {
      case GhostState.PATROL:
        this.updatePatrol(dt, player);
        break;
      case GhostState.CHASE:
        this.updateChase(dt, player);
        break;
      case GhostState.TELEGRAPH:
        this.updateTelegraph(dt, player);
        break;
      case GhostState.ATTACKING:
        this.updateAttacking(dt, player);
        break;
      case GhostState.STAGGER:
        this.updateStagger(dt);
        break;
    }

    // Y-sorting depth
    this.setDepth(this.y + 10);
  }

  updatePatrol(dt, player) {
    const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    if (distToPlayer <= this.detectionRadius && player.health > 0) {
      this.state = GhostState.CHASE;
      this.showAggroAlert();
      return;
    }

    this.patrolTimer -= dt;
    if (this.patrolTimer <= 0) {
      this.patrolTimer = Phaser.Math.FloatBetween(2.0, 4.0);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.FloatBetween(30, 110);
      this.patrolTarget.set(
        this.spawnPoint.x + Math.cos(angle) * dist,
        this.spawnPoint.y + Math.sin(angle) * dist
      );
    }

    const distToTarget = Phaser.Math.Distance.Between(this.x, this.y, this.patrolTarget.x, this.patrolTarget.y);
    if (distToTarget > 10) {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, this.patrolTarget.x, this.patrolTarget.y);
      this.body.setVelocity(
        Math.cos(angle) * this.patrolSpeed,
        Math.sin(angle) * this.patrolSpeed
      );
      this.setFlipX(Math.cos(angle) < 0);
    } else {
      this.body.setVelocity(0, 0);
    }
  }

  updateChase(dt, player) {
    const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    if (distToPlayer > 460 || player.health <= 0) {
      this.state = GhostState.PATROL;
      this.body.setVelocity(0, 0);
      return;
    }

    if (distToPlayer <= this.attackRange && this.attackCooldownTimer <= 0) {
      this.startTelegraph(player);
      return;
    }

    // Direct spectral glide (phases effortlessly towards player)
    const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
    this.body.setVelocity(
      Math.cos(angle) * this.chaseSpeed,
      Math.sin(angle) * this.chaseSpeed
    );

    this.setFlipX(Math.cos(angle) < 0);
  }

  startTelegraph(player) {
    this.state = GhostState.TELEGRAPH;
    this.telegraphTimer = this.telegraphDuration;
    this.attackAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);

    this.body.setVelocity(0, 0);
    this.setFlipX(Math.cos(this.attackAngle) < 0);

    // Glowing red flare from eyes and shuddering wail
    this.setTint(0xff4455);
    this.scene.tweens.add({
      targets: this,
      scaleX: this.baseScale * 1.2,
      scaleY: this.baseScale * 1.2,
      alpha: 0.95,
      duration: this.telegraphDuration * 1000,
      ease: 'Sine.easeIn',
    });
  }

  updateTelegraph(dt, player) {
    this.telegraphTimer -= dt;

    const currentAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
    this.attackAngle = Phaser.Math.Angle.RotateTo(this.attackAngle, currentAngle, dt * 3.0);
    this.setFlipX(Math.cos(this.attackAngle) < 0);

    if (this.telegraphTimer <= 0) {
      this.executeAttack(player);
    }
  }

  executeAttack(player) {
    this.state = GhostState.ATTACKING;
    this.attackTimer = this.attackDuration;
    this.hasDamagedPlayerThisAttack = false;
    this.clearTint();
    this.setScale(this.baseScale);
    this.setAlpha(0.95);

    // Fast phantom claw thrust
    const rushSpeed = 220;
    this.body.setVelocity(
      Math.cos(this.attackAngle) * rushSpeed,
      Math.sin(this.attackAngle) * rushSpeed
    );

    // Spawn Ghost Claw slash effect
    const spawnDist = 16;
    const claw = this.scene.add.sprite(
      this.x + Math.cos(this.attackAngle) * spawnDist,
      this.y + Math.sin(this.attackAngle) * spawnDist,
      'ghost_claw'
    );
    claw.setOrigin(0.2, 0.5);
    claw.setRotation(this.attackAngle);
    claw.setScale(0.8, 0.8);
    claw.setAlpha(0.95);
    claw.setDepth(this.depth + 2);

    this.scene.tweens.add({
      targets: claw,
      scaleX: 1.3,
      scaleY: 1.3,
      alpha: 0,
      duration: 220,
      ease: 'Cubic.easeOut',
      onComplete: () => claw.destroy(),
    });

    // Check hit on player during active claw strike
    this.scene.time.delayedCall(70, () => {
      if (this.state === GhostState.ATTACKING && !this.hasDamagedPlayerThisAttack) {
        this.checkAttackHitOnPlayer(player);
      }
    });
  }

  updateAttacking(dt, player) {
    this.attackTimer -= dt;

    const progress = 1 - (this.attackTimer / this.attackDuration);
    const speed = Phaser.Math.Linear(220, 0, progress);
    this.body.setVelocity(
      Math.cos(this.attackAngle) * speed,
      Math.sin(this.attackAngle) * speed
    );

    if (this.attackTimer <= 0) {
      this.state = GhostState.CHASE;
      this.attackCooldownTimer = this.attackCooldown;
      this.setAlpha(this.baseAlpha);
      this.setScale(this.baseScale);
      this.clearTint();
      this.body.setVelocity(0, 0);
    }
  }

  checkAttackHitOnPlayer(player) {
    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    if (dist <= 54) {
      const angleToPlayer = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
      const angleDiff = Math.abs(Phaser.Math.Angle.Wrap(angleToPlayer - this.attackAngle));

      if (angleDiff <= Phaser.Math.DegToRad(60)) {
        this.hasDamagedPlayerThisAttack = true;
        player.takeDamage(this.attackDamage);
      }
    }
  }

  takeDamage(amount, sourceX, sourceY) {
    if (this.state === GhostState.DEAD) return;

    this.health = Math.max(0, this.health - amount);
    this.hpBarTimer = 4.0;

    // White ethereal recoil flash
    this.setTint(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (this.state !== GhostState.DEAD) {
        this.setTint(0xff3344);
        this.scene.time.delayedCall(110, () => {
          if (this.state !== GhostState.DEAD) {
            this.clearTint();
            this.setAlpha(this.baseAlpha);
          }
        });
      }
    });

    // Spectral sparks
    this.scene.add.particles(this.x, this.y + 8, 'ember_spark', {
      speed: { min: 70, max: 170 },
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 250,
      quantity: 8,
      blendMode: 'ADD',
      tint: 0xaaccff,
    });

    // Knockback
    const kbAngle = Phaser.Math.Angle.Between(sourceX, sourceY, this.x, this.y);
    const kbForce = 180;
    this.body.setVelocity(
      Math.cos(kbAngle) * kbForce,
      Math.sin(kbAngle) * kbForce
    );

    if (this.health > 0) {
      this.state = GhostState.STAGGER;
      this.staggerTimer = this.staggerDuration;
    } else {
      this.die();
    }
  }

  updateStagger(dt) {
    this.staggerTimer -= dt;
    this.body.setVelocity(
      Phaser.Math.Linear(this.body.velocity.x, 0, 0.25),
      Phaser.Math.Linear(this.body.velocity.y, 0, 0.25)
    );

    if (this.staggerTimer <= 0) {
      this.state = GhostState.CHASE;
      this.clearTint();
      this.setAlpha(this.baseAlpha);
      this.setScale(this.baseScale);
    }
  }

  die() {
    this.state = GhostState.DEAD;
    this.body.setVelocity(0, 0);
    this.body.enable = false;
    this.hpBarGraphics.clear();

    if (this.scene.player) {
      this.scene.player.addSouls(this.soulsReward);
    }

    // Dissolve into spirit smoke and golden souls
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: this.baseScale * 1.5,
      scaleY: this.baseScale * 0.3,
      duration: 450,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.emitDeathSouls();
        this.destroy();
      },
    });
  }

  emitDeathSouls() {
    const soulParticles = this.scene.add.particles(this.x, this.y, 'ember_spark', {
      speed: { min: 30, max: 100 },
      scale: { start: 1.2, end: 0.1 },
      alpha: { start: 1, end: 0 },
      lifespan: 800,
      quantity: 12,
      blendMode: 'ADD',
      tint: 0xffd700,
    });
    this.scene.time.delayedCall(850, () => soulParticles.destroy());
  }

  showAggroAlert() {
    const alert = this.scene.add.text(this.x, this.y - 42, '!', {
      fontFamily: 'Cinzel, serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ff1133',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.scene.tweens.add({
      targets: alert,
      y: this.y - 54,
      alpha: 0,
      duration: 600,
      ease: 'Cubic.easeOut',
      onComplete: () => alert.destroy(),
    });
  }

  drawHPBar() {
    this.hpBarGraphics.clear();
    const barWidth = 30;
    const barHeight = 4;
    const bx = this.x - barWidth / 2;
    const by = this.y - 39;

    this.hpBarGraphics.fillStyle(0x000000, 0.8);
    this.hpBarGraphics.fillRect(bx - 1, by - 1, barWidth + 2, barHeight + 2);

    const ratio = Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1);
    this.hpBarGraphics.fillStyle(0xd946ef, 0.95); // Ethereal purple-crimson HP
    this.hpBarGraphics.fillRect(bx, by, barWidth * ratio, barHeight);
  }

  updateLight() {
    if (this.lightSource) {
      this.lightSource.x = this.x;
      this.lightSource.y = this.y - 18;
    }
  }

  destroy(fromScene) {
    if (this.lightSource) {
      this.lightSource.destroy();
    }
    if (this.hpBarGraphics) {
      this.hpBarGraphics.destroy();
    }
    if (this.mistEmitter) {
      this.mistEmitter.destroy();
    }
    super.destroy(fromScene);
  }
}
