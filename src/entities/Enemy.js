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

    // Scale for authentic pixel-art character presence
    this.baseScale = 2.2;
    this.setScale(this.baseScale);

    // Authentic darker grey steel armor and red scarf with clear natural tint
    this.baseTint = 0xffffff;
    this.clearTint();

    // Physics body matching knight pixel proportions
    this.body.setSize(14, 14);
    this.body.setOffset(9, 16);
    this.setCollideWorldBounds(true);

    // Play default idle animation
    this.play('knight_idle');

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

    // Red aura point light (subtle menacing cursed glow)
    if (scene.add.pointlight && scene.game.renderer.type === Phaser.WEBGL) {
      this.lightSource = scene.add.pointlight(x, y, 0xff1111, 100, 0.35, 0.08);
    } else {
      this.lightSource = null;
    }

    // Bloody Sword equipped in right hand (held upright as in reference image)
    this.sword = scene.add.sprite(x, y, 'greatsword_bloody');
    this.sword.setOrigin(0.5, 0.78); // Pivot directly at the grip
    this.swordScale = 2.0;
    this.sword.setScale(this.swordScale);
    this.sword.setDepth(this.depth + 1);
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
    this.updateSword(dt);

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
      this.anims.play('knight_walk', true);

      // Walk wobble
      this.walkCycle += dt * 8;
      this.setRotation(Math.cos(this.walkCycle) * 0.05);
    } else {
      this.body.setVelocity(0, 0);
      this.setRotation(0);
      this.anims.play('knight_idle', true);
    }
  }

  updateChase(dt, player) {
    const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    // Disengage if player is too far
    if (distToPlayer > 420 || player.health <= 0) {
      this.state = EnemyState.PATROL;
      this.body.setVelocity(0, 0);
      this.setRotation(0);
      this.anims.play('knight_idle', true);
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
    this.anims.play('knight_walk', true);

    // Stride bobbing
    this.walkCycle += dt * 13;
    this.setRotation(Math.cos(this.walkCycle) * 0.07);
  }

  startTelegraph(player) {
    this.state = EnemyState.TELEGRAPH;
    this.telegraphTimer = this.telegraphDuration;
    this.attackAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);

    this.body.setVelocity(0, 0);
    this.setFlipX(Math.cos(this.attackAngle) < 0);
    this.anims.play('knight_idle', true);

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
    if (this.sword) {
      this.scene.tweens.add({
        targets: this.sword,
        alpha: 0,
        scaleX: this.sword.scaleX * 0.7,
        scaleY: this.sword.scaleY * 0.7,
        duration: 450,
        ease: 'Sine.easeOut',
        onComplete: () => {
          if (this.sword) this.sword.destroy();
        },
      });
    }

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

  updateSword(dt) {
    if (!this.sword || this.state === EnemyState.DEAD) return;

    const isFacingLeft = this.flipX;
    const sign = isFacingLeft ? -1 : 1;

    if (this.state === EnemyState.TELEGRAPH) {
      // Phase 1: High Overhead Windup
      const progress = 1 - Math.max(0, this.telegraphTimer / this.telegraphDuration);
      const handX = this.x + (isFacingLeft ? 8 : -8);
      const handY = this.y - 8;
      this.sword.setPosition(handX, handY);
      
      const windupAngle = this.attackAngle - (sign * 1.7);
      const curAim = Phaser.Math.Linear(0, windupAngle, progress);
      this.sword.setRotation(curAim);
      this.sword.setScale(isFacingLeft ? -this.swordScale : this.swordScale, this.swordScale);
      this.sword.setDepth(this.depth + 1);
    } else if (this.state === EnemyState.ATTACKING) {
      // Phase 2: Heavy Downward Cleave
      const progress = 1 - Math.max(0, this.attackTimer / this.attackDuration);
      const windupAngle = this.attackAngle - (sign * 1.7);
      const followThrough = this.attackAngle + (sign * 0.45);
      const curAim = Phaser.Math.Linear(windupAngle, followThrough, Math.pow(progress, 1.8));

      const lungeDist = 14 * Math.sin(progress * Math.PI);
      const handX = this.x + Math.cos(this.attackAngle) * lungeDist;
      const handY = this.y + Math.sin(this.attackAngle) * lungeDist;
      this.sword.setPosition(handX, handY);
      this.sword.setRotation(curAim);
      this.sword.setScale(isFacingLeft ? -this.swordScale : this.swordScale, this.swordScale);
      this.sword.setDepth(this.depth + 2);
    } else if (this.state === EnemyState.STAGGER) {
      // Recoil stance
      const handX = this.x + (isFacingLeft ? 14 : -14);
      const handY = this.y + 4;
      this.sword.setPosition(handX, handY);
      this.sword.setRotation(isFacingLeft ? 0.6 : -0.6);
      this.sword.setScale(isFacingLeft ? -this.swordScale : this.swordScale, this.swordScale);
      this.sword.setDepth(this.depth + 1);
    } else {
      // Neutral, Patrol and Chase: Held UPRIGHT in right hand (viewer's left) exactly as in reference image!
      const handOffsetX = isFacingLeft ? 20 : -20;
      const handOffsetY = 2;
      this.sword.setPosition(this.x + handOffsetX, this.y + handOffsetY);

      // Sword stands straight vertically with subtle footstep sway
      const walkSway = Math.sin(this.walkCycle) * 0.04;
      this.sword.setRotation(walkSway);
      this.sword.setScale(isFacingLeft ? -this.swordScale : this.swordScale, this.swordScale);
      this.sword.setDepth(this.depth + 1);
    }
  }

  destroy(fromScene) {
    if (this.sword) {
      this.sword.destroy();
    }
    if (this.lightSource) {
      this.lightSource.destroy();
    }
    if (this.hpBarGraphics) {
      this.hpBarGraphics.destroy();
    }
    super.destroy(fromScene);
  }
}
