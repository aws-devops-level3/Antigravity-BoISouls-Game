import Phaser from 'phaser';

export const BossState = {
  DORMANT: 'DORMANT',
  AWAKENING: 'AWAKENING',
  CHASE: 'CHASE',
  TELEGRAPH_NORMAL: 'TELEGRAPH_NORMAL',
  ATTACK_NORMAL: 'ATTACK_NORMAL',
  TELEGRAPH_SCREAM: 'TELEGRAPH_SCREAM',
  CASTING_WRAITH_ORB: 'CASTING_WRAITH_ORB',
  TELEGRAPH_TELEPORT_SLAM: 'TELEGRAPH_TELEPORT_SLAM',
  CHANNELING_SLAM: 'CHANNELING_SLAM',
  STAGGER: 'STAGGER',
  DEAD: 'DEAD',
};

export class SpectralOrb extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, angle, damage = 15) {
    const tex = scene.textures.exists('wraith_satellite_orb') ? 'wraith_satellite_orb' : 'spectral_orb';
    super(scene, x, y, tex);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.damage = damage;
    this.speed = 280;
    this.maxLifespan = 3.2;
    this.lifeTimer = 0;
    this.hasHit = false;
    this.angleRad = angle;

    this.setScale(0.48);
    this.setRotation(angle);
    this.setAlpha(0.98);
    this.setBlendMode(Phaser.BlendModes.ADD);

    if (this.body) {
      this.body.setAllowGravity(false);
      this.body.setCircle(20);
      this.body.setVelocity(
        Math.cos(angle) * this.speed,
        Math.sin(angle) * this.speed
      );
    }

    this.setDepth(y + 30);

    // Glowing cyan/white bead particle trail
    const particleTex = scene.textures.exists('wraith_bead_dot') ? 'wraith_bead_dot' : 'dust_puff';
    this.trail = scene.add.particles(0, 0, particleTex, {
      speed: { min: 4, max: 18 },
      scale: { start: 0.28, end: 0 },
      alpha: { start: 0.85, end: 0 },
      lifespan: 220,
      frequency: 24,
      blendMode: 'ADD',
    });
    this.trail.startFollow(this);
    this.trail.setDepth(this.depth - 1);
  }

  update(time, delta) {
    if (this.hasHit || !this.active) return;

    // Se till att projektilens hastighet kontinuerligt driver utåt så den aldrig fastnar
    if (this.body) {
      this.body.setVelocity(
        Math.cos(this.angleRad) * this.speed,
        Math.sin(this.angleRad) * this.speed
      );
    }

    // Direkt helkroppskollision mot spelaren för 100% pålitlig träffregistrering
    if (this.scene && this.scene.player && !this.hasHit) {
      const p = this.scene.player;
      if (!p.isInvulnerable && p.health > 0) {
        const dx = Math.abs(this.x - p.x);
        const dy = Math.abs(this.y - (p.y + 6));
        if (dx <= 34 && dy <= 40) {
          this.onHitPlayer(p);
          return;
        }
      }
    }

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

  destroyOrb(spawnParticles = false) {
    this.hasHit = true;
    if (this.trail) {
      this.trail.stop();
      this.scene.time.delayedCall(160, () => {
        if (this.trail) this.trail.destroy();
      });
    }

    if (this.scene) {
      const flash = this.scene.add.circle(this.x, this.y, 28, 0x67e8f9, 0.9);
      flash.setScale(0.57);
      flash.setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({
        targets: flash,
        scaleX: 1.0,
        scaleY: 1.0,
        alpha: 0,
        duration: 180,
        ease: 'Quad.easeOut',
        onComplete: () => flash.destroy(),
      });
    }

    this.destroy();
  }
}

/**
 * ScreamWave - Eterisk sonisk våg som skär framåt mot spelaren
 * Spelas upp i sekvens vid bossens skrikattack.
 */
export class ScreamWave extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, angle, damage = 18, waveNumber = 1) {
    super(scene, x, y, 'reach_arc');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.scene = scene;
    this.damage = damage;
    this.speed = 360;
    this.maxLifespan = 1.6;
    this.lifeTimer = 0;
    this.hasHit = false;

    this.setRotation(angle);
    this.setOrigin(0.2, 0.5);
    this.setScale(0.7, 0.7);
    this.setAlpha(0.92);

    // Eteriska skriktoner: Cyan -> Azurblå -> Djupviolett
    const waveTints = [0x38bdf8, 0x818cf8, 0xc084fc];
    this.setTint(waveTints[(waveNumber - 1) % waveTints.length]);

    this.body.setSize(52, 52);
    this.body.setVelocity(
      Math.cos(angle) * this.speed,
      Math.sin(angle) * this.speed
    );

    this.setDepth(y + 25);

    // Vågen expanderar kraftigt i bredd när den susar framåt
    scene.tweens.add({
      targets: this,
      scaleX: 1.6,
      scaleY: 1.6,
      alpha: 0.15,
      duration: this.maxLifespan * 1000,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.destroy();
      },
    });
  }

  update(time, delta) {
    if (!this.active) return;
    const dt = delta / 1000;
    this.lifeTimer += dt;
    this.setDepth(this.y + 25);

    // Proximitetskontroll mot spelaren
    if (this.scene && this.scene.player && !this.hasHit) {
      const dist = Phaser.Math.Distance.Between(this.x, this.y, this.scene.player.x, this.scene.player.y);
      if (dist <= 38) {
        this.onHitPlayer(this.scene.player);
        return;
      }
    }

    if (this.lifeTimer >= this.maxLifespan) {
      this.destroy();
    }
  }

  onHitObstacle() {
    this.destroy();
  }

  onHitPlayer(player) {
    if (this.hasHit || !this.active) return;
    if (player.isInvulnerable) {
      return; // Undviks med dash (i-frames)
    }
    this.hasHit = true;
    player.takeDamage(this.damage);
    this.destroy();
  }
}

/**
 * WraithHazardOrb - Placerad magisk vålnadskraft i arenan med pulserande blå/vita bollar
 * Designad exakt efter referensbilden: lysande vitt centrum, virvlande cyanelektricitet
 * och små blå/vita satellitbollar och pärlor som kontinuerligt pulserar utåt i 6 riktningar.
 */
export class WraithHazardOrb extends Phaser.GameObjects.Container {
  constructor(scene, startX, startY, targetX, targetY, boss) {
    super(scene, startX, startY);

    this.scene = scene;
    this.boss = boss;
    this.targetX = targetX;
    this.targetY = targetY;
    this.pulseCount = 0;
    this.maxPulses = 4;
    this.pulseTimer = null;
    this.streamTimer = null;
    this.hoverTween = null;
    this.pulseTween = null;
    this.isDead = false;
    this.pulseRadiusOffset = 0;
    this.outwardOrbs = [];
    this.coreHitCooldown = 0;

    scene.add.existing(this);
    scene.physics.world.enable(this);

    if (this.body) {
      this.body.setAllowGravity(false);
      this.body.setImmovable(true);
      this.body.setCircle(36, -36, -36);
    }

    this.setDepth(targetY + 10);
    this.setScale(0.18);
    this.setAlpha(0.2);

    // 1. Mjukt azurblått omgivningssken på golvet
    this.glowBg = scene.add.sprite(0, 0, 'soft_cyan_glow');
    this.glowBg.setScale(1.5).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
    this.add(this.glowBg);

    // 2. Yttre virvlande elektriskt plasmavortex (huvudklot)
    this.coreOrb = scene.add.sprite(0, 0, 'wraith_orb');
    this.coreOrb.setScale(0.23).setAlpha(0.96).setBlendMode(Phaser.BlendModes.ADD);
    this.add(this.coreOrb);

    // 3. Inre motroterande filamentlager för dynamisk magisk turbulens
    this.swirlOrb = scene.add.sprite(0, 0, 'wraith_orb');
    this.swirlOrb.setScale(0.17).setAlpha(0.72).setBlendMode(Phaser.BlendModes.ADD);
    this.add(this.swirlOrb);

    // 4. Intensivt kritvitt kärnljus i mitten
    this.coreFlare = scene.add.circle(0, 0, 11, 0xffffff, 0.95);
    this.coreFlare.setBlendMode(Phaser.BlendModes.ADD);
    this.add(this.coreFlare);

    // 5. 6 Radiella armar med blå/vita bollar och pärlor enligt bilden
    this.armAngles = [
      -Math.PI / 2,         // ~12:00 (rakt uppåt)
      -Math.PI * 0.20,      // ~1:30 (uppåt-höger)
      Math.PI * 0.08,       // ~3:15 (höger)
      Math.PI * 0.38,       // ~5:15 (nedåt-höger)
      Math.PI * 0.68,       // ~7:15 (nedåt-vänster)
      Math.PI * 1.05,       // ~10:00 (vänster)
    ];

    this.baseRadius = 112; // Avstånd till de yttre satellitbollarna
    this.arms = [];

    // Bråkdelar för mellanliggande ljuspärlor längs varje arm
    const beadFractions = [0.40, 0.54, 0.68, 0.82];
    const beadScales = [0.18, 0.26, 0.22, 0.32];

    for (let i = 0; i < this.armAngles.length; i++) {
      const angle = this.armAngles[i];
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Pärlor längs armen
      const beads = [];
      for (let b = 0; b < beadFractions.length; b++) {
        const dist = this.baseRadius * beadFractions[b];
        const bead = scene.add.sprite(cosA * dist, sinA * dist, 'wraith_bead_dot');
        bead.setScale(beadScales[b]).setAlpha(0.92).setBlendMode(Phaser.BlendModes.ADD);
        this.add(bead);
        beads.push({
          sprite: bead,
          fraction: beadFractions[b],
          baseScale: beadScales[b],
        });
      }

      // Yttre satellitboll (vit kärna med cyan gloria)
      const sat = scene.add.sprite(cosA * this.baseRadius, sinA * this.baseRadius, 'wraith_satellite_orb');
      sat.setScale(0.38).setAlpha(0.98).setBlendMode(Phaser.BlendModes.ADD);
      this.add(sat);

      this.arms.push({
        angle,
        cosA,
        sinA,
        satellite: sat,
        beads,
      });
    }

    // Kasta orben i en parabelbåge till målet
    scene.tweens.add({
      targets: this,
      x: targetX,
      y: targetY,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 650,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.onLand();
      },
    });

    // Kontinuerlig uppdatering för rotation, pulsering och skadekontroll
    this.updateHandler = (time, delta) => this.onTick(time, delta);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.updateHandler);
  }

  onLand() {
    if (this.isDead || !this.scene) return;

    // Landningsring på golvet
    const landingRing = this.scene.add.circle(this.x, this.y, 70, 0x38bdf8, 0.85);
    landingRing.setScale(0.14);
    landingRing.setBlendMode(Phaser.BlendModes.ADD);
    landingRing.setDepth(this.depth - 1);
    this.scene.tweens.add({
      targets: landingRing,
      scaleX: 1.0,
      scaleY: 1.0,
      alpha: 0,
      duration: 550,
      ease: 'Cubic.easeOut',
      onComplete: () => landingRing.destroy(),
    });

    // Eterisk svävning över marken
    this.hoverTween = this.scene.tweens.add({
      targets: this,
      y: this.targetY - 12,
      duration: 750,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Rytmisk pulsering av armarnas avstånd
    this.pulseTween = this.scene.tweens.add({
      targets: this,
      pulseRadiusOffset: 14,
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Kontinuerlig ström av blå/vita energipärlor som pulserar ut från mitten
    this.streamTimer = this.scene.time.addEvent({
      delay: 520,
      callback: () => this.pulseEnergyWave(),
      loop: true,
    });

    // Starta attackpulser
    this.scheduleNextPulse(480);
  }

  /**
   * Pulserar ut små blå/vita bollar från centrum och låter dem färdas långt ut i arenan
   */
  pulseEnergyWave() {
    if (this.isDead || !this.scene || !this.scene.tweens) return;

    for (let i = 0; i < this.arms.length; i++) {
      const arm = this.arms[i];
      const startDist = 34;
      const endDist = 360; // Färdas långt utåt i arenan så de inte stannar eller fastnar!

      // Glödande blå/vit satellitboll som skjuts utåt
      const pOrb = this.scene.add.sprite(
        arm.cosA * startDist,
        arm.sinA * startDist,
        'wraith_satellite_orb'
      );
      pOrb.setScale(0.18).setAlpha(0.95).setBlendMode(Phaser.BlendModes.ADD);
      this.add(pOrb);
      this.outwardOrbs.push({ sprite: pOrb, isOrb: true });

      this.scene.tweens.add({
        targets: pOrb,
        x: arm.cosA * endDist,
        y: arm.sinA * endDist,
        scaleX: 0.38,
        scaleY: 0.38,
        alpha: 0,
        duration: 850,
        ease: 'Quad.easeOut',
        onComplete: () => {
          if (pOrb.active) pOrb.destroy();
        },
      });

      // Ljuspärla som följer med i partikelutströmningen
      const pBead = this.scene.add.sprite(
        arm.cosA * (startDist + 14),
        arm.sinA * (startDist + 14),
        'wraith_bead_dot'
      );
      pBead.setScale(0.22).setAlpha(0.9).setBlendMode(Phaser.BlendModes.ADD);
      this.add(pBead);
      this.outwardOrbs.push({ sprite: pBead, isOrb: false });

      this.scene.tweens.add({
        targets: pBead,
        x: arm.cosA * (endDist * 0.75),
        y: arm.sinA * (endDist * 0.75),
        scaleX: 0.32,
        scaleY: 0.32,
        alpha: 0,
        duration: 750,
        ease: 'Quad.easeOut',
        onComplete: () => {
          if (pBead.active) pBead.destroy();
        },
      });
    }
  }

  onTick(time, delta) {
    if (this.isDead || !this.scene) return;

    // 1. Hypnotisk rotation av vortexfilamenten
    if (this.coreOrb && this.coreOrb.active) {
      this.coreOrb.rotation += 0.007;
    }
    if (this.swirlOrb && this.swirlOrb.active) {
      this.swirlOrb.rotation -= 0.011;
    }

    // 2. Uppdatera satelliter och pärlor dynamiskt efter pulseringsavstånd
    const currentR = this.baseRadius + this.pulseRadiusOffset;
    for (let i = 0; i < this.arms.length; i++) {
      const arm = this.arms[i];
      arm.satellite.x = arm.cosA * currentR;
      arm.satellite.y = arm.sinA * currentR;
      arm.satellite.setScale(0.36 + (this.pulseRadiusOffset / 14) * 0.08);

      for (let b = 0; b < arm.beads.length; b++) {
        const beadData = arm.beads[b];
        const d = currentR * beadData.fraction;
        beadData.sprite.x = arm.cosA * d;
        beadData.sprite.y = arm.sinA * d;
        beadData.sprite.setScale(beadData.baseScale * (1 + (this.pulseRadiusOffset / 14) * 0.2));
      }
    }

    // 3. Träffkontroll mot spelaren för ALLA utåtpasserande orber och pärlor (15 skada)
    if (this.scene.player && !this.scene.player.isInvulnerable && this.scene.player.health > 0) {
      const p = this.scene.player;
      const px = p.x;
      const py = p.y + 6; // Spelarens riddarkroppscentrum

      // Gå igenom alla utåtpasserande orber och pärlor
      for (let i = this.outwardOrbs.length - 1; i >= 0; i--) {
        const item = this.outwardOrbs[i];
        if (!item.sprite || !item.sprite.active) {
          this.outwardOrbs.splice(i, 1);
          continue;
        }

        const worldX = this.x + item.sprite.x;
        const worldY = this.y + item.sprite.y;

        const dx = Math.abs(worldX - px);
        const dy = Math.abs(worldY - py);

        // Generös helkroppsträffruta för riddaren (34x40 px för orber, 26x32 px för pärlor)
        const hitLimitX = item.isOrb ? 34 : 26;
        const hitLimitY = item.isOrb ? 40 : 32;

        if (dx <= hitLimitX && dy <= hitLimitY) {
          const damaged = p.takeDamage(15);
          if (damaged) {
            // Skapa effektfull cyanblixt vid träff
            const flash = this.scene.add.circle(worldX, worldY, 30, 0x67e8f9, 0.95);
            flash.setScale(0.6);
            flash.setBlendMode(Phaser.BlendModes.ADD);
            this.scene.tweens.add({
              targets: flash,
              scaleX: 1.0,
              scaleY: 1.0,
              alpha: 0,
              duration: 180,
              ease: 'Quad.easeOut',
              onComplete: () => flash.destroy(),
            });

            item.sprite.destroy();
            this.outwardOrbs.splice(i, 1);
          }
        }
      }

      // Huvudklotet i centrum (15 skada med 0.6s cooldown)
      if (this.coreHitCooldown > 0) {
        this.coreHitCooldown -= delta / 1000;
      } else {
        const distCenter = Phaser.Math.Distance.Between(this.x, this.y, px, py);
        if (distCenter <= 52) {
          p.takeDamage(15);
          this.coreHitCooldown = 0.6;
        }
      }

      // De roterande satellitbollarna i banan
      for (let i = 0; i < this.arms.length; i++) {
        const satWorldX = this.x + this.arms[i].satellite.x;
        const satWorldY = this.y + this.arms[i].satellite.y;
        const dx = Math.abs(satWorldX - px);
        const dy = Math.abs(satWorldY - py);
        if (dx <= 32 && dy <= 38) {
          if (this.coreHitCooldown <= 0) {
            p.takeDamage(15);
            this.coreHitCooldown = 0.6;
          }
          break;
        }
      }
    }
  }

  scheduleNextPulse(delay) {
    if (this.isDead || !this.scene || !this.scene.time) return;

    this.pulseTimer = this.scene.time.delayedCall(delay, () => {
      if (this.isDead || !this.scene) return;
      this.emitPulse();
    });
  }

  emitPulse() {
    if (this.isDead || !this.scene) return;
    this.pulseCount++;

    // 1. Visuell expansionschockvåg av cyanfärgat ljus
    const pulseRing = this.scene.add.circle(this.x, this.y, 95, 0x38bdf8, 0.85);
    pulseRing.setScale(0.17);
    pulseRing.setBlendMode(Phaser.BlendModes.ADD);
    pulseRing.setDepth(this.depth - 1);
    this.scene.tweens.add({
      targets: pulseRing,
      scaleX: 1.0,
      scaleY: 1.0,
      alpha: 0,
      duration: 480,
      ease: 'Quad.easeOut',
      onComplete: () => pulseRing.destroy(),
    });

    // 2. Centrala klotet sväller upp kraftigt och blixtrar till
    this.scene.tweens.add({
      targets: [this.coreOrb, this.swirlOrb],
      scaleX: 0.31,
      scaleY: 0.31,
      duration: 140,
      yoyo: true,
      ease: 'Back.easeOut',
    });
    this.scene.tweens.add({
      targets: this.coreFlare,
      scaleX: 1.8,
      scaleY: 1.8,
      alpha: 1,
      duration: 140,
      yoyo: true,
      ease: 'Quad.easeOut',
    });

    // 3. Satelliterna pulserar ut och blixtrar till
    for (let i = 0; i < this.arms.length; i++) {
      this.scene.tweens.add({
        targets: this.arms[i].satellite,
        scaleX: 0.58,
        scaleY: 0.58,
        duration: 140,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
    }

    // 4. Skjut ut blå/vita bollar (SpectralOrb) längs de 6 armarnas riktning
    const angleOffset = (this.pulseCount * Math.PI) / 12;
    for (let i = 0; i < this.arms.length; i++) {
      const angle = this.arms[i].angle + angleOffset;
      const spawnX = this.x + Math.cos(angle) * 55;
      const spawnY = this.y + Math.sin(angle) * 55;
      const orb = new SpectralOrb(this.scene, spawnX, spawnY, angle, 15);
      if (this.scene.enemyProjectiles) {
        this.scene.enemyProjectiles.add(orb);
      }
      if (orb.body) {
        orb.body.setAllowGravity(false);
        orb.body.setVelocity(
          Math.cos(angle) * orb.speed,
          Math.sin(angle) * orb.speed
        );
      }
    }

    if (this.pulseCount < this.maxPulses) {
      this.scheduleNextPulse(1150); // Nästa puls efter 1.15s
    } else {
      // Alla pulser avfyrade: implodera och förstör
      this.scene.time.delayedCall(700, () => {
        if (this.isDead || !this.scene) return;
        this.isDead = true;

        // Satelliter och pärlor sugs in mot centrum
        for (let i = 0; i < this.arms.length; i++) {
          const arm = this.arms[i];
          this.scene.tweens.add({
            targets: arm.satellite,
            x: 0,
            y: 0,
            scaleX: 0,
            scaleY: 0,
            alpha: 0,
            duration: 350,
            ease: 'Back.easeIn',
          });
          for (let b = 0; b < arm.beads.length; b++) {
            this.scene.tweens.add({
              targets: arm.beads[b].sprite,
              x: 0,
              y: 0,
              scaleX: 0,
              scaleY: 0,
              alpha: 0,
              duration: 300,
              ease: 'Back.easeIn',
            });
          }
        }

        // Huvudklotet krymper och försvinner
        this.scene.tweens.add({
          targets: this,
          scaleX: 0,
          scaleY: 0,
          alpha: 0,
          duration: 380,
          ease: 'Back.easeIn',
          onComplete: () => this.destroy(),
        });
      });
    }
  }

  destroy(fromScene) {
    this.isDead = true;
    if (this.scene) {
      if (this.updateHandler) {
        this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.updateHandler);
      }
      if (this.scene.tweens) {
        this.scene.tweens.killTweensOf(this);
        if (this.coreFlare) this.scene.tweens.killTweensOf(this.coreFlare);
        if (this.coreOrb) this.scene.tweens.killTweensOf(this.coreOrb);
        if (this.swirlOrb) this.scene.tweens.killTweensOf(this.swirlOrb);
        if (this.glowBg) this.scene.tweens.killTweensOf(this.glowBg);
        if (this.arms) {
          for (let i = 0; i < this.arms.length; i++) {
            const arm = this.arms[i];
            if (arm.satellite) this.scene.tweens.killTweensOf(arm.satellite);
            if (arm.beads) {
              for (let b = 0; b < arm.beads.length; b++) {
                if (arm.beads[b].sprite) this.scene.tweens.killTweensOf(arm.beads[b].sprite);
              }
            }
          }
        }
      }
    }
    if (this.hoverTween) {
      this.hoverTween.stop();
      this.hoverTween = null;
    }
    if (this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = null;
    }
    if (this.pulseTimer) {
      this.pulseTimer.remove();
      this.pulseTimer = null;
    }
    if (this.streamTimer) {
      this.streamTimer.remove();
      this.streamTimer = null;
    }
    if (this.outwardOrbs) {
      for (let i = 0; i < this.outwardOrbs.length; i++) {
        if (this.outwardOrbs[i].sprite && this.outwardOrbs[i].sprite.active) {
          if (this.scene && this.scene.tweens) {
            this.scene.tweens.killTweensOf(this.outwardOrbs[i].sprite);
          }
          this.outwardOrbs[i].sprite.destroy();
        }
      }
      this.outwardOrbs = [];
    }
    super.destroy(fromScene);
  }
}

export default class BossEnemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'boss_enemy_sheet');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Towering, imposing boss presence (~130px height on screen)
    this.baseScale = 0.37;
    this.setScale(this.baseScale);

    // Continuous looping animation according to spritesheet
    this.play('boss_float');

    // Ethereal translucent presence
    this.baseAlpha = 0.95;
    this.setAlpha(this.baseAlpha);
    this.clearTint();

    // Physics body centered on the wraith queen's torso
    this.body.setSize(60, 90);
    this.body.setOffset(90, 130);
    this.setCollideWorldBounds(true);

    // Boss Stats - Formidable Soulsborne Boss
    this.maxHealth = 1500;
    this.health = 1500;
    this.attackDamage = 28;
    this.chaseSpeed = 155;
    this.phase2Speed = 201;
    this.activationRadius = 330; // Triggers when player nears the chest
    this.attackRange = 64;
    this.soulsReward = 2500;
    this.isPhase2 = false;

    // AI & Combat timers
    this.state = BossState.DORMANT;
    this.spawnPoint = new Phaser.Math.Vector2(x, y);

    this.attackCooldownTimer = 1.0;
    this.specialCooldownTimer = 3.5; // Starts ready shortly after awakening
    this.specialIndex = 0; // Cycles through 1 (Wave Scream), 2 (Wraith Orb), 3 (Teleport Slam)
    this.dangerCircleGfx = null;
    this.activeHazardOrb = null;

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
    this.hoverTimer += dt * 1.6;

    // Gentle hover bobbing for floor light and aura
    const hoverOffset = Math.sin(this.hoverTimer) * 1.5;
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
      case BossState.CASTING_WRAITH_ORB:
      case BossState.TELEGRAPH_TELEPORT_SLAM:
      case BossState.CHANNELING_SLAM:
        // Handled by timed tweens and events
        break;
      case BossState.STAGGER:
        this.updateStagger(dt);
        break;
    }
  }

  updateDormant(player) {
    this.body.setVelocity(0, 0);

    // Calm, gentle hovering float animation while standing still at the chest
    const hoverY = Math.sin(this.hoverTimer * 1.2) * 2.0;
    this.x = this.spawnPoint.x;
    this.y = this.spawnPoint.y + hoverY;

    // Keep sprite scale and rotation steady (spritesheet handles animation naturally)
    this.setScale(this.baseScale);
    this.setRotation(0);
    this.setAlpha(0.95);

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

    // Check Special Attack trigger (Cycles through all 3 abilities)
    if (this.specialCooldownTimer <= 0 && distToPlayer <= 420) {
      this.specialIndex = ((this.specialIndex || 0) % 3) + 1;
      if (this.specialIndex === 1) {
        this.startSpecialWaveScream(player);
      } else if (this.specialIndex === 2) {
        this.startSpecialWraithOrb(player);
      } else {
        this.startSpecialTeleportSlam(player);
      }
      return;
    }

    // Check Normal Attack trigger
    if (distToPlayer <= this.attackRange && this.attackCooldownTimer <= 0) {
      this.startTelegraphNormal(player);
      return;
    }

    // Glide smoothly towards player without artificial rocking or stretching
    const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
    this.body.setVelocity(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed
    );
    this.setFlipX(player.x < this.x);
    this.setRotation(0);
    this.setScale(this.baseScale);
    this.setAlpha(0.95);

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

    // Fast ghost lunge (+15% speed)
    const lungeSpeed = 300;
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

  // --- ABILITY 1: Banshee Wave Scream (Djupt andetag och skrik ut i vågor) ---
  startSpecialWaveScream(player) {
    this.state = BossState.TELEGRAPH_SCREAM;
    this.body.setVelocity(0, 0);
    this.setFlipX(player.x < this.x);

    // 1. Djupt andetag / Inhale (~0.8s): lutar sig bakåt och drar in eterisk luft
    this.setTint(0x38bdf8);

    this.scene.tweens.add({
      targets: this,
      scaleX: this.baseScale * 0.85,
      scaleY: this.baseScale * 1.18,
      duration: 780,
      ease: 'Quad.easeIn',
    });

    const breathRing = this.scene.add.circle(this.x, this.y - 12, 100, 0x38bdf8, 0.45);
    breathRing.setDepth(this.depth - 1);
    this.scene.tweens.add({
      targets: breathRing,
      scaleX: 0.1,
      scaleY: 0.1,
      alpha: 0.05,
      duration: 780,
      ease: 'Quad.easeIn',
      onComplete: () => breathRing.destroy(),
    });

    // Skriker ut i vågor mot spelaren
    this.scene.time.delayedCall(800, () => {
      if (this.state === BossState.DEAD) return;
      this.executeWaveScream(player);
    });
  }

  executeWaveScream(player) {
    // Kasta fram huvudet i ett vrål
    this.scene.tweens.add({
      targets: this,
      scaleX: this.baseScale * 1.18,
      scaleY: this.baseScale * 0.92,
      duration: 200,
      yoyo: true,
      ease: 'Back.easeOut',
    });

    const totalWaves = 3;
    const waveInterval = 280; // ms mellan varje våg

    for (let w = 1; w <= totalWaves; w++) {
      this.scene.time.delayedCall((w - 1) * waveInterval, () => {
        if (this.state === BossState.DEAD) return;

        // Sikta direkt mot spelarens position vid varje våg
        const aimAngle = Phaser.Math.Angle.Between(this.x, this.y - 10, player.x, player.y);
        this.setFlipX(player.x < this.x);

        const spawnDist = 32;
        const wave = new ScreamWave(
          this.scene,
          this.x + Math.cos(aimAngle) * spawnDist,
          this.y - 10 + Math.sin(aimAngle) * spawnDist,
          aimAngle,
          18,
          w
        );

        if (this.scene.enemyProjectiles) {
          this.scene.enemyProjectiles.add(wave);
        }

        // Lätt skakning vid varje vågvrål
        this.scene.cameras.main.shake(160, 0.005);
      });
    }

    // Återgå till CHASE efter att alla 3 vågor skjutits ut
    this.scene.time.delayedCall(totalWaves * waveInterval + 200, () => {
      if (this.state === BossState.DEAD) return;
      this.clearTint();
      this.setScale(this.baseScale);
      this.specialCooldownTimer = this.isPhase2 ? 2.8 : 4.0;
      this.attackCooldownTimer = 0.8;
      this.state = BossState.CHASE;
    });
  }

  // --- ABILITY 2: Wraith Hazard Orb (Kastas ut i arenan och pulserar mindre bollar) ---
  startSpecialWraithOrb(player) {
    this.state = BossState.CASTING_WRAITH_ORB;
    this.body.setVelocity(0, 0);
    this.setFlipX(player.x < this.x);

    // Mystisk lila laddning (~0.5s)
    this.setTint(0xa855f7);

    this.scene.tweens.add({
      targets: this,
      scaleX: this.baseScale * 1.1,
      scaleY: this.baseScale * 1.1,
      duration: 500,
      ease: 'Sine.easeInOut',
    });

    this.scene.time.delayedCall(500, () => {
      if (this.state === BossState.DEAD) return;

      // Beräkna en slumpmässig position inne i arenan
      const arenaMinX = Math.max(340, (this.scene.physics.world.bounds.x || 0) + 120);
      const arenaMaxX = Math.min(940, (this.scene.physics.world.bounds.width || 1200) - 120);
      const arenaMinY = Math.max(300, (this.scene.physics.world.bounds.y || 0) + 120);
      const arenaMaxY = Math.min(740, (this.scene.physics.world.bounds.height || 1000) - 120);

      const targetX = Phaser.Math.Between(arenaMinX, arenaMaxX);
      const targetY = Phaser.Math.Between(arenaMinY, arenaMaxY);

      // Kasta ut Wraith Orb
      const hazardOrb = new WraithHazardOrb(this.scene, this.x, this.y - 35, targetX, targetY, this);
      this.activeHazardOrb = hazardOrb;

      // Återgå direkt till CHASE så bossen kämpar vidare samtidigt som orben pulserar
      this.clearTint();
      this.setScale(this.baseScale);
      this.specialCooldownTimer = this.isPhase2 ? 3.0 : 4.5;
      this.attackCooldownTimer = 1.0;
      this.state = BossState.CHASE;
    });
  }

  // --- ABILITY 3: Teleport Slam & Channeling Danger Circle (0.8s) ---
  startSpecialTeleportSlam(player) {
    this.state = BossState.TELEGRAPH_TELEPORT_SLAM;
    this.body.setVelocity(0, 0);

    // 1. Bossen lyser upp och växer under 1 sekund
    this.setTint(0xffffff); // Bländande vit/eterisk glöd

    this.scene.tweens.add({
      targets: this,
      scaleX: this.baseScale * 1.35,
      scaleY: this.baseScale * 1.35,
      duration: 1000,
      ease: 'Quad.easeInOut',
    });

    const beacon = this.scene.add.circle(this.x, this.y, 90, 0x38bdf8, 0.5);
    beacon.setScale(0.22);
    beacon.setDepth(this.depth - 1);
    this.scene.tweens.add({
      targets: beacon,
      scaleX: 1.0,
      scaleY: 1.0,
      alpha: 0,
      duration: 1000,
      ease: 'Quad.easeIn',
      onComplete: () => beacon.destroy(),
    });

    this.scene.time.delayedCall(1000, () => {
      if (this.state === BossState.DEAD) return;
      this.executeTeleportSlamOnPlayer(player);
    });
  }

  executeTeleportSlamOnPlayer(player) {
    // 2. Teleportera PÅ spelaren
    this.x = player.x;
    this.y = player.y;
    this.body.setVelocity(0, 0);
    this.setDepth(this.y + 15);
    this.setTint(0xf43f5e);

    this.state = BossState.CHANNELING_SLAM;

    // 3. Channela cirkel under sig i 0.8 sekunder
    const circleRadius = 92;
    const channelDuration = 800; // ms

    const dangerGfx = this.scene.add.graphics();
    dangerGfx.setDepth(Math.max(1, this.depth - 2));
    this.dangerCircleGfx = dangerGfx;

    const startTime = this.scene.time.now;

    // Rita och fyll cirkeln progressivt under 0.8s
    const updateEvent = this.scene.time.addEvent({
      delay: 16,
      repeat: Math.floor(channelDuration / 16),
      callback: () => {
        if (!dangerGfx.active || this.state === BossState.DEAD) {
          updateEvent.remove();
          dangerGfx.destroy();
          return;
        }

        const elapsed = this.scene.time.now - startTime;
        const progress = Phaser.Math.Clamp(elapsed / channelDuration, 0, 1);

        dangerGfx.clear();

        // Tydlig röd varningskant
        dangerGfx.lineStyle(2.5, 0xef4444, 0.95);
        dangerGfx.strokeCircle(this.x, this.y, circleRadius);

        // Inre fyllning som växer och visar channelingtiden
        const fillRadius = circleRadius * progress;
        dangerGfx.fillStyle(0xef4444, 0.15 + progress * 0.35);
        dangerGfx.fillCircle(this.x, this.y, fillRadius);
      },
    });

    // 4. Detonera efter 0.8 sekunder
    this.scene.time.delayedCall(channelDuration, () => {
      updateEvent.remove();
      if (dangerGfx.active) dangerGfx.destroy();
      this.dangerCircleGfx = null;

      if (this.state === BossState.DEAD) return;

      // Eruption & Detonation!
      this.scene.cameras.main.shake(300, 0.014);

      const targetRadius = circleRadius + 40;
      const blastRing = this.scene.add.circle(this.x, this.y, targetRadius, 0xf43f5e, 0.85);
      blastRing.setScale(circleRadius / targetRadius);
      blastRing.setDepth(this.depth - 1);
      this.scene.tweens.add({
        targets: blastRing,
        scaleX: 1.0,
        scaleY: 1.0,
        alpha: 0,
        duration: 300,
        ease: 'Cubic.easeOut',
        onComplete: () => blastRing.destroy(),
      });

      // Kontrollera om spelaren står kvar i cirkeln och inte dashar (i-frames)
      const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
      if (dist <= circleRadius) {
        if (!player.isInvulnerable) {
          player.takeDamage(48); // Mycket skada om man inte dashar ut!
        }
      }

      // Återställ skala och gå tillbaka till CHASE
      this.scene.tweens.add({
        targets: this,
        scaleX: this.baseScale,
        scaleY: this.baseScale,
        duration: 250,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.clearTint();
          this.setScale(this.baseScale);
          this.specialCooldownTimer = this.isPhase2 ? 2.8 : 4.2;
          this.attackCooldownTimer = 1.0;
          this.state = BossState.CHASE;
        },
      });
    });
  }

  takeDamage(amount, sourceX, sourceY) {
    if (this.scene && this.scene.gameState !== 'PLAYING') return;
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

    // Wave scream to herald Phase 2
    if (this.scene.player) {
      this.startSpecialWaveScream(this.scene.player);
    }
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

    // Rensa och avbryt aktiv WraithHazardOrb omedelbart så att inga aktiva pulser eller tweens kraschar
    if (this.activeHazardOrb) {
      if (this.activeHazardOrb.active) {
        this.activeHazardOrb.destroy();
      }
      this.activeHazardOrb = null;
    }

    if (this.dangerCircleGfx && this.dangerCircleGfx.active) {
      this.dangerCircleGfx.destroy();
      this.dangerCircleGfx = null;
    }

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
    if (this.dangerCircleGfx && this.dangerCircleGfx.active) this.dangerCircleGfx.destroy();
    if (this.activeHazardOrb && this.activeHazardOrb.active) this.activeHazardOrb.destroy();
    super.destroy(fromScene);
  }
}
