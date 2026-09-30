import Phaser from 'phaser';

export const SkeletonState = {
  PATROL: 'PATROL',
  AIM_AND_POSITION: 'AIM_AND_POSITION',
  TELEGRAPH: 'TELEGRAPH',
  STAGGER: 'STAGGER',
  DEAD: 'DEAD',
};

export class BoneArrow extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, angle, damage = 12) {
    super(scene, x, y, 'bone_arrow');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.damage = damage;
    this.speed = 390;
    this.maxLifespan = 2.4; // seconds
    this.lifeTimer = 0;
    this.hasHit = false;
    this.angleRad = angle;

    this.setScale(1.25);
    this.setRotation(angle);

    // Slim physics hitbox matching the arrow shaft and head
    this.body.setSize(18, 6);
    this.body.setOffset(7, 2);
    if (this.body.setAllowGravity) {
      this.body.setAllowGravity(false);
    }

    this.body.setVelocity(
      Math.cos(angle) * this.speed,
      Math.sin(angle) * this.speed
    );

    this.setDepth(y + 25);

    // Crimson & ember flight tracer trail
    this.trailEmitter = scene.add.particles(0, 0, 'ember_spark', {
      speed: { min: 8, max: 28 },
      scale: { start: 0.45, end: 0 },
      alpha: { start: 0.75, end: 0 },
      tint: [0xff3333, 0xffaa22, 0xd4af37],
      lifespan: 140,
      frequency: 24,
      blendMode: 'ADD',
    });
    this.trailEmitter.startFollow(this);
    this.trailEmitter.setDepth(this.depth - 1);
  }

  update(time, delta) {
    if (this.hasHit) return;

    // Bibehåll kontinuerlig hastighet så varken fysikgrupper eller kollisioner stoppar pilen i luften
    if (this.body) {
      this.body.setVelocity(
        Math.cos(this.angleRad) * this.speed,
        Math.sin(this.angleRad) * this.speed
      );
    }

    const dt = delta / 1000;
    this.lifeTimer += dt;
    this.setDepth(this.y + 25);

    // Helkroppsträffkontroll mot riddaren (bröstkorg, huvud och bål, inte bara fötterna)
    if (this.scene && this.scene.player) {
      const p = this.scene.player;
      if (!p.isInvulnerable && p.health > 0 && !p.isDead) {
        const dx = Math.abs(this.x - p.x);
        const dy = Math.abs(this.y - (p.y + 6));
        if (dx <= 24 && dy <= 32) {
          this.onHitPlayer(p);
          if (this.hasHit) return;
        }
      }
    }

    if (this.lifeTimer >= this.maxLifespan) {
      this.destroyArrow(false);
    }
  }

  onHitObstacle() {
    if (this.hasHit) return;
    this.destroyArrow(true);
  }

  onHitPlayer(player) {
    if (this.hasHit) return;
    if (player.isInvulnerable) {
      // Avoid damage during dodge-roll i-frames
      return;
    }
    const damaged = player.takeDamage(this.damage);
    if (damaged) {
      this.destroyArrow(true);
    }
  }

  destroyArrow(spawnSparks = true) {
    this.hasHit = true;
    if (this.trailEmitter) {
      this.trailEmitter.stop();
      this.scene.time.delayedCall(160, () => {
        if (this.trailEmitter) this.trailEmitter.destroy();
      });
    }

    if (spawnSparks && this.scene) {
      const sparks = this.scene.add.particles(this.x, this.y, 'ember_spark', {
        speed: { min: 50, max: 140 },
        scale: { start: 0.7, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: [0xff4444, 0xd4af37, 0xffffff],
        lifespan: 220,
        quantity: 6,
        blendMode: 'ADD',
      });
      this.scene.time.delayedCall(240, () => sparks.destroy());
    }

    this.destroy();
  }
}

export default class SkeletonEnemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'skeleton_enemy');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Scale for authentic character presence matching the player and knight (498px * 0.16 = ~79.6px)
    this.baseScale = 0.16;
    this.setScale(this.baseScale);

    this.baseTint = 0xffffff;
    this.clearTint();

    // Physics body matching skeleton feet and base
    this.body.setSize(170, 140);
    this.body.setOffset(171, 370);
    this.setCollideWorldBounds(true);

    // Stats & Attributes
    this.maxHealth = 50;
    this.health = 50;
    this.attackDamage = 12;
    this.patrolSpeed = 44;
    this.repositionSpeed = 75;
    this.detectionRadius = 420;
    this.attackRange = 360;
    this.minRetreatRange = 110;
    this.soulsReward = 200;

    // AI State
    this.state = SkeletonState.PATROL;
    this.spawnPoint = new Phaser.Math.Vector2(x, y);
    this.patrolTarget = new Phaser.Math.Vector2(x, y);
    this.patrolTimer = 0;

    // Combat timers
    this.telegraphDuration = 0.58;
    this.telegraphTimer = 0;
    this.aimAngle = 0;
    this.attackCooldown = 1.9;
    this.attackCooldownTimer = Phaser.Math.FloatBetween(0.4, 1.2); // slight stagger on initial encounter

    // Stagger / hit reaction
    this.staggerDuration = 0.28;
    this.staggerTimer = 0;
    this.lastHitSwingId = -1;

    // Visual Walk Cycle
    this.walkCycle = 0;
    this.hasAlerted = false;

    // Floating HP Bar Graphics
    this.hpBarGraphics = scene.add.graphics();
    this.hpBarGraphics.setDepth(2000);
    this.hpBarTimer = 0;

    // Red eye glow aura underneath skull / feet
    this.lightSource = scene.add.image(x, y + 14, 'soft_red_glow');
    this.lightSource.setDisplaySize(36, 36);
    this.lightSource.setAlpha(0.14);
    this.lightSource.setDepth(1);
    this.lightSource.setBlendMode(Phaser.BlendModes.ADD);
  }

  update(time, delta, player) {
    if (this.state === SkeletonState.DEAD) return;

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
    this.setDepth(this.y + 10);

    // AI State Machine
    switch (this.state) {
      case SkeletonState.PATROL:
        this.updatePatrol(dt, player);
        break;
      case SkeletonState.AIM_AND_POSITION:
        this.updateAimAndPosition(dt, player);
        break;
      case SkeletonState.TELEGRAPH:
        this.updateTelegraph(dt, player);
        break;
      case SkeletonState.STAGGER:
        this.updateStagger(dt);
        break;
    }
  }

  updatePatrol(dt, player) {
    const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    if (distToPlayer <= this.detectionRadius && player.health > 0) {
      this.state = SkeletonState.AIM_AND_POSITION;
      if (!this.hasAlerted) {
        this.hasAlerted = true;
        this.showAggroAlert();
      }
      return;
    }

    this.patrolTimer -= dt;
    if (this.patrolTimer <= 0) {
      this.patrolTimer = Phaser.Math.FloatBetween(2.5, 4.5);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.FloatBetween(30, 80);
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

      this.walkCycle += dt * 8;
      const bob = Math.abs(Math.sin(this.walkCycle)) * 0.03;
      const tilt = Math.cos(this.walkCycle) * 0.035;
      this.setScale(this.baseScale * (1 - bob * 0.5), this.baseScale * (1 + bob));
      this.setRotation(tilt);
    } else {
      this.body.setVelocity(0, 0);
      this.setRotation(0);
      this.setScale(this.baseScale, this.baseScale);
      this.walkCycle = 0;
    }
  }

  updateAimAndPosition(dt, player) {
    const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    // Disengage if player moved too far away
    if (distToPlayer > this.detectionRadius * 1.3 || player.health <= 0) {
      this.state = SkeletonState.PATROL;
      this.body.setVelocity(0, 0);
      this.setRotation(0);
      this.setScale(this.baseScale, this.baseScale);
      this.walkCycle = 0;
      this.hasAlerted = false;
      return;
    }

    // Always face the player
    this.setFlipX(player.x < this.x);

    // If player is too close, kite / retreat backward
    if (distToPlayer < this.minRetreatRange) {
      const awayAngle = Phaser.Math.Angle.Between(player.x, player.y, this.x, this.y);
      this.body.setVelocity(
        Math.cos(awayAngle) * this.repositionSpeed,
        Math.sin(awayAngle) * this.repositionSpeed
      );

      this.walkCycle += dt * 10;
      const bob = Math.abs(Math.sin(this.walkCycle)) * 0.03;
      this.setScale(this.baseScale * (1 - bob * 0.5), this.baseScale * (1 + bob));
      return;
    }

    // In shooting range & attack cooldown ready
    if (distToPlayer <= this.attackRange && this.attackCooldownTimer <= 0) {
      this.startTelegraph(player);
      return;
    }

    // If player is beyond comfortable range, advance slowly towards them
    if (distToPlayer > this.attackRange * 0.85) {
      const towardsAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
      this.body.setVelocity(
        Math.cos(towardsAngle) * this.repositionSpeed * 0.8,
        Math.sin(towardsAngle) * this.repositionSpeed * 0.8
      );
      this.walkCycle += dt * 8;
      const bob = Math.abs(Math.sin(this.walkCycle)) * 0.03;
      this.setScale(this.baseScale * (1 - bob * 0.5), this.baseScale * (1 + bob));
    } else {
      // In sweet spot: stop and prepare crossbow
      this.body.setVelocity(0, 0);
      this.setRotation(0);
      this.setScale(this.baseScale, this.baseScale);
      this.walkCycle = 0;
    }
  }

  startTelegraph(player) {
    this.state = SkeletonState.TELEGRAPH;
    this.telegraphTimer = this.telegraphDuration;
    this.aimAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);

    this.body.setVelocity(0, 0);
    this.setFlipX(player.x < this.x);

    // Red warning telegraph flash in glowing eye sockets
    this.setTint(0xff3333);

    // Crossbow tension windup animation (lean back and stretch)
    this.scene.tweens.add({
      targets: this,
      scaleX: this.baseScale * 0.92,
      scaleY: this.baseScale * 1.08,
      duration: this.telegraphDuration * 1000,
      ease: 'Sine.easeIn',
    });

    // Muzzle spark teaser at crossbow tip
    const isFacingLeft = this.flipX;
    const tipX = this.x + (isFacingLeft ? -30 : 30);
    const tipY = this.y + 12;
    const chargeSpark = this.scene.add.particles(tipX, tipY, 'ember_spark', {
      speed: { min: 10, max: 35 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: 0xff2222,
      lifespan: 180,
      quantity: 3,
      blendMode: 'ADD',
    });
    this.scene.time.delayedCall(this.telegraphDuration * 1000, () => chargeSpark.destroy());
  }

  updateTelegraph(dt, player) {
    this.telegraphTimer -= dt;

    // Track player movement slightly during aiming
    const currentAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
    this.aimAngle = Phaser.Math.Angle.RotateTo(this.aimAngle, currentAngle, dt * 2.8);
    this.setFlipX(Math.cos(this.aimAngle) < 0);

    if (this.telegraphTimer <= 0) {
      this.fireArrow(player);
    }
  }

  fireArrow(player) {
    this.clearTint();
    this.setScale(this.baseScale);

    const isFacingLeft = this.flipX;
    const tipX = this.x + (isFacingLeft ? -30 : 30);
    const tipY = this.y + 12;

    // Crossbow snap recoil tween
    const recoilX = this.x + (isFacingLeft ? 7 : -7);
    this.scene.tweens.add({
      targets: this,
      x: recoilX,
      scaleX: this.baseScale * 1.08,
      scaleY: this.baseScale * 0.92,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.setScale(this.baseScale);
      },
    });

    // Crossbow muzzle flash particles
    const muzzle = this.scene.add.particles(tipX, tipY, 'ember_spark', {
      speed: { min: 40, max: 110 },
      angle: {
        min: Phaser.Math.RadToDeg(this.aimAngle) - 25,
        max: Phaser.Math.RadToDeg(this.aimAngle) + 25,
      },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.95, end: 0 },
      tint: [0xff4422, 0xd4af37, 0xffffff],
      lifespan: 140,
      quantity: 5,
      blendMode: 'ADD',
    });
    this.scene.time.delayedCall(160, () => muzzle.destroy());

    // Spawn arrow projectile
    if (!this.scene.enemyProjectiles) {
      this.scene.enemyProjectiles = this.scene.physics.add.group({ runChildUpdate: true });
      delete this.scene.enemyProjectiles.defaults.setVelocityX;
      delete this.scene.enemyProjectiles.defaults.setVelocityY;
    }
    const arrow = new BoneArrow(this.scene, tipX, tipY, this.aimAngle, this.attackDamage);
    this.scene.enemyProjectiles.add(arrow);
    if (arrow.body) {
      arrow.body.setVelocity(
        Math.cos(this.aimAngle) * arrow.speed,
        Math.sin(this.aimAngle) * arrow.speed
      );
    }

    // Return to repositioning state and set cooldown
    this.attackCooldownTimer = this.attackCooldown;
    this.state = SkeletonState.AIM_AND_POSITION;
  }

  takeDamage(amount, sourceX, sourceY, customKbForce) {
    if (this.scene && this.scene.gameState !== 'PLAYING') return;
    if (this.state === SkeletonState.DEAD) return;

    this.health = Math.max(0, this.health - amount);
    this.hpBarTimer = 4.0;

    // Visual damage reaction
    this.setTint(0xffffff);
    this.scene.time.delayedCall(90, () => {
      if (this.state !== SkeletonState.DEAD) {
        this.setTint(0xff3333);
        this.scene.time.delayedCall(120, () => {
          if (this.state !== SkeletonState.DEAD) this.clearTint();
        });
      }
    });

    // Knockback
    const kbAngle = Phaser.Math.Angle.Between(sourceX, sourceY, this.x, this.y);
    const kbForce = customKbForce !== undefined ? customKbForce : 140;
    this.body.setVelocity(
      Math.cos(kbAngle) * kbForce,
      Math.sin(kbAngle) * kbForce
    );

    if (this.health > 0) {
      this.state = SkeletonState.STAGGER;
      this.staggerTimer = this.staggerDuration;
    } else {
      this.die();
    }
  }

  updateStagger(dt) {
    this.staggerTimer -= dt;
    this.body.setVelocity(
      Phaser.Math.Linear(this.body.velocity.x, 0, 0.22),
      Phaser.Math.Linear(this.body.velocity.y, 0, 0.22)
    );

    if (this.staggerTimer <= 0) {
      this.state = SkeletonState.AIM_AND_POSITION;
      this.clearTint();
      this.setScale(this.baseScale);
      this.setRotation(0);
    }
  }

  die() {
    this.state = SkeletonState.DEAD;
    this.body.setVelocity(0, 0);
    this.body.enable = false;
    this.hpBarGraphics.clear();

    if (this.scene.player) {
      this.scene.player.addSouls(this.soulsReward);
    }

    // Death fade
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: this.baseScale * 0.55,
      scaleY: this.baseScale * 0.55,
      duration: 400,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.destroy();
      },
    });
  }

  emitDeathBones() {
    // Orange death glow particles removed
  }

  showAggroAlert() {
    const alert = this.scene.add.text(this.x, this.y - 52, '!', {
      fontFamily: 'Cinzel, serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ff2222',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.scene.tweens.add({
      targets: alert,
      y: this.y - 66,
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
    const by = this.y - 48;

    this.hpBarGraphics.fillStyle(0x000000, 0.8);
    this.hpBarGraphics.fillRect(bx - 1, by - 1, barWidth + 2, barHeight + 2);

    const ratio = Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1);
    this.hpBarGraphics.fillStyle(0xb91c1c, 0.95);
    this.hpBarGraphics.fillRect(bx, by, barWidth * ratio, barHeight);
  }

  updateLight() {
    if (this.lightSource) {
      this.lightSource.x = this.x;
      this.lightSource.y = this.y + 14;
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
