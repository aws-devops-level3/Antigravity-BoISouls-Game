import Phaser from 'phaser';

export default class ChickenNPC extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'chicken_npc');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Cute retro scale (~22px width, ~26px height)
    this.baseScale = 0.052;
    this.setScale(this.baseScale);
    this.setOrigin(0.5, 0.85);

    // Arcade physics body centered at chicken's feet
    this.body.setSize(180, 160);
    this.body.setOffset(116, 320);
    this.setCollideWorldBounds(true);
    this.setBounce(0.2, 0.2);

    // Chicken Stats - Neutral, peaceful creature with 1 HP
    this.maxHealth = 1;
    this.health = 1;
    this.state = 'IDLE'; // 'IDLE', 'WANDER', 'PANIC', 'DEAD'

    // Timers
    this.idleTimer = Phaser.Math.FloatBetween(1.2, 3.2);
    this.wanderTimer = 0;
    this.panicTimer = 0;
    this.animTimer = Phaser.Math.FloatBetween(0, 10);
    this.peckTimer = 0;
    this.isPecking = false;
    this.lastHitSwingId = -1;

    // Movement velocities
    this.moveVx = 0;
    this.moveVy = 0;
    this.walkSpeed = Phaser.Math.Between(26, 42);
    this.panicSpeed = 95;

    this.setDepth(this.y + 5);
  }

  update(time, delta) {
    if (this.state === 'DEAD') return;

    const dt = delta / 1000;
    this.animTimer += dt;
    this.setDepth(this.y + 5);

    // Check proximity to player - scared scurry if player gets very close
    if (this.scene && this.scene.player && this.state !== 'PANIC') {
      const distToPlayer = Phaser.Math.Distance.Between(
        this.x,
        this.y,
        this.scene.player.x,
        this.scene.player.y
      );

      if (distToPlayer < 46) {
        this.startPanic(this.scene.player.x, this.scene.player.y);
      }
    }

    switch (this.state) {
      case 'IDLE':
        this.updateIdle(dt);
        break;
      case 'WANDER':
        this.updateWander(dt);
        break;
      case 'PANIC':
        this.updatePanic(dt);
        break;
    }
  }

  updateIdle(dt) {
    this.body.setVelocity(0, 0);
    this.idleTimer -= dt;

    // Pecking behavior occasionally while idle
    if (this.isPecking) {
      this.peckTimer -= dt;
      // Head down peck motion
      const peckBob = Math.sin(this.peckTimer * 16) * 0.15;
      this.setRotation(0.22 + peckBob);
      this.setScale(this.baseScale * (this.flipX ? -1 : 1), this.baseScale * 0.94);

      if (this.peckTimer <= 0) {
        this.isPecking = false;
        this.setRotation(0);
        this.setScale(this.baseScale * (this.flipX ? -1 : 1), this.baseScale);
      }
    } else {
      // Gentle breathing idle bob
      const breath = Math.sin(this.animTimer * 4) * 0.04;
      this.setScale(this.baseScale * (this.flipX ? -1 : 1), this.baseScale * (1 + breath));

      // Random chance to peck ground
      if (Math.random() < 0.015 && this.idleTimer > 0.8) {
        this.isPecking = true;
        this.peckTimer = Phaser.Math.FloatBetween(0.4, 0.7);
      }
    }

    if (this.idleTimer <= 0) {
      this.startWander();
    }
  }

  startWander() {
    this.state = 'WANDER';
    this.wanderTimer = Phaser.Math.FloatBetween(1.2, 2.6);
    this.isPecking = false;
    this.setRotation(0);

    // Pick a random direction
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.moveVx = Math.cos(angle) * this.walkSpeed;
    this.moveVy = Math.sin(angle) * this.walkSpeed;

    // Face movement direction
    this.setFlipX(this.moveVx < 0);
  }

  updateWander(dt) {
    this.wanderTimer -= dt;
    this.body.setVelocity(this.moveVx, this.moveVy);

    // Chicken waddle / strut animation
    const waddle = Math.sin(this.animTimer * 14);
    const bob = Math.abs(waddle) * 0.06;
    this.setScale(this.baseScale * (this.flipX ? -1 : 1), this.baseScale * (1 - bob));
    this.setRotation(waddle * 0.1);

    // If bumped into a wall or obstacle, stop wandering
    if (this.body.blocked.left || this.body.blocked.right || this.body.blocked.up || this.body.blocked.down) {
      this.startIdle();
      return;
    }

    if (this.wanderTimer <= 0) {
      this.startIdle();
    }
  }

  startIdle() {
    this.state = 'IDLE';
    this.idleTimer = Phaser.Math.FloatBetween(1.5, 3.5);
    this.setRotation(0);
    this.setScale(this.baseScale * (this.flipX ? -1 : 1), this.baseScale);
    this.body.setVelocity(0, 0);

    // 25% chance to turn around when stopping
    if (Math.random() < 0.25) {
      this.setFlipX(!this.flipX);
    }
  }

  startPanic(sourceX, sourceY) {
    this.state = 'PANIC';
    this.panicTimer = 0.85;
    this.isPecking = false;

    // Run directly away from the source
    const angle = Phaser.Math.Angle.Between(sourceX, sourceY, this.x, this.y);
    this.moveVx = Math.cos(angle) * this.panicSpeed;
    this.moveVy = Math.sin(angle) * this.panicSpeed;
    this.setFlipX(this.moveVx < 0);

    // Startled cluck when scurrying away
    if (Math.random() < 0.65) {
      this.playChickenSound(0.35, 1.25);
    }
  }

  updatePanic(dt) {
    this.panicTimer -= dt;
    this.body.setVelocity(this.moveVx, this.moveVy);

    // Rapid fluttering hops
    const flap = Math.sin(this.animTimer * 24);
    this.setRotation(flap * 0.2);
    this.setScale(this.baseScale * (this.flipX ? -1 : 1), this.baseScale * (1 - Math.abs(flap) * 0.1));

    if (this.panicTimer <= 0) {
      this.startIdle();
    }
  }

  takeDamage(amount, sourceX = this.x, sourceY = this.y) {
    if (this.state === 'DEAD') return;

    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.explodeBlood(sourceX, sourceY);
    }
  }

  explodeBlood(sourceX, sourceY) {
    this.state = 'DEAD';
    this.body.setVelocity(0, 0);
    this.body.enable = false;
    this.setVisible(false);

    const scene = this.scene;
    if (!scene) return;

    // Spela kyckling-ljud och blodigt 'splat'
    this.playDeathSounds(scene);

    // 1. Gory Blood Splat Decal stamped on the floor
    const mainSplat = scene.add.image(this.x, this.y + 4, 'blood_splat');
    mainSplat.setScale(Phaser.Math.FloatBetween(0.7, 1.05));
    mainSplat.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
    mainSplat.setAlpha(0.92);
    mainSplat.setDepth(1);

    // Fade blood splat out very slowly over 30 seconds so floor stays deliciously gory
    scene.tweens.add({
      targets: mainSplat,
      alpha: 0.65,
      duration: 30000,
    });

    // 2. Extra surrounding blood droplets stamped around the impact
    for (let i = 0; i < 5; i++) {
      const dropAngle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dropDist = Phaser.Math.FloatBetween(12, 38);
      const dropX = this.x + Math.cos(dropAngle) * dropDist;
      const dropY = this.y + 4 + Math.sin(dropAngle) * dropDist;

      const miniDrop = scene.add.image(dropX, dropY, 'blood_drop');
      miniDrop.setScale(Phaser.Math.FloatBetween(0.7, 1.3));
      miniDrop.setRotation(dropAngle);
      miniDrop.setAlpha(0.85);
      miniDrop.setDepth(1);
    }

    // 3. Fast high-velocity arterial blood droplets spraying in all 360 directions
    const bloodSpray = scene.add.particles(this.x, this.y - 2, 'blood_drop', {
      speed: { min: 90, max: 280 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.3, end: 0.2 },
      alpha: { start: 1.0, end: 0.15 },
      lifespan: { min: 400, max: 800 },
      gravityY: 160,
      quantity: 38,
      blendMode: 'NORMAL',
    });
    bloodSpray.setDepth(this.y + 10);
    scene.time.delayedCall(850, () => bloodSpray.destroy());

    // 4. Crimson blood mist / gore cloud
    const bloodMist = scene.add.particles(this.x, this.y - 2, 'dust_puff', {
      speed: { min: 30, max: 120 },
      scale: { start: 1.1, end: 0.1 },
      alpha: { start: 0.85, end: 0 },
      tint: [0x7f1d1d, 0x991b1b, 0xef4444],
      lifespan: 550,
      quantity: 18,
      blendMode: 'NORMAL',
    });
    bloodMist.setDepth(this.y + 9);
    scene.time.delayedCall(600, () => bloodMist.destroy());

    // 5. White & red feather particles - justerade till mindre och färre fjädrar
    const featherBurst = scene.add.particles(this.x, this.y - 4, 'feather_particle', {
      speed: { min: 25, max: 95 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.48, end: 0.22 },
      rotate: { min: 0, max: 360 },
      alpha: { start: 0.9, end: 0 },
      lifespan: { min: 650, max: 1100 },
      gravityY: 25,
      quantity: 5,
      blendMode: 'NORMAL',
    });
    featherBurst.setDepth(this.y + 11);
    scene.time.delayedCall(1150, () => featherBurst.destroy());

    // Clean up chicken entity after explosion
    scene.time.delayedCall(1400, () => {
      this.destroy();
    });
  }

  playChickenSound(volume = 0.5, rate = 1.0) {
    if (!this.scene) return;
    try {
      if (this.scene.sound && this.scene.sound.context && this.scene.sound.context.state === 'suspended') {
        this.scene.sound.context.resume();
      }
      const key = (this.scene.cache && this.scene.cache.audio && this.scene.cache.audio.exists('chicken_cluck'))
        ? 'chicken_cluck'
        : 'chicken_squawk';
      if (this.scene.cache && this.scene.cache.audio && this.scene.cache.audio.exists(key)) {
        this.scene.sound.play(key, { volume, rate });
      }
    } catch (e) {}
  }

  playDeathSounds(scene) {
    if (!scene) return;

    try {
      if (scene.sound && scene.sound.context && scene.sound.context.state === 'suspended') {
        scene.sound.context.resume();
      }
    } catch (e) {}

    // 1. Kyckling-ljud: Chicken sounds hen clucking (1).mp3
    try {
      const key = (scene.cache && scene.cache.audio && scene.cache.audio.exists('chicken_cluck'))
        ? 'chicken_cluck'
        : 'chicken_squawk';
      if (scene.cache && scene.cache.audio && scene.cache.audio.exists(key)) {
        scene.sound.play(key, { volume: 0.95 });
      }
    } catch (e) {}

    // 2. Köttigt 'splat' (wet gore squelch)
    try {
      if (scene.cache && scene.cache.audio && scene.cache.audio.exists('blood_splat')) {
        scene.sound.play('blood_splat', { volume: 0.95 });
      }
    } catch (e) {}
  }
}
