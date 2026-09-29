import Phaser from 'phaser';
import COMBAT_CONFIG from '../data/CombatConfig.js';

/**
 * SlashArc - Snabb svepande träffbåge / projektil för spelarens attacker
 * (Inspirerat av snabba, responsiva roguelites som Tiny Rogues)
 * 
 * Anpassas dynamiskt efter spelarens aktiva vapen från weapons.js:
 * Skada, räckvidd, träffbåge, hastighet, färg och specialeffekter (stun, bleed, crit, pierce).
 */
export default class SlashArc extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, player, angle) {
    // Spawna framför spelaren i siktets riktning
    const spawnDist = 26;
    const startX = player.x + Math.cos(angle) * spawnDist;
    const startY = player.y + Math.sin(angle) * spawnDist;

    super(scene, startX, startY, 'slash_arc');

    this.scene = scene;
    this.player = player;
    this.weapon = player && player.currentWeapon ? player.currentWeapon : null;
    this.attackAngle = angle;
    this.hitTargets = new Set();
    this.elapsedTime = 0;

    // Hämta dynamiska vapenparametrar eller fallback till COMBAT_CONFIG
    const weapon = this.weapon;
    this.lifetime = (weapon && weapon.slashLifetime) || COMBAT_CONFIG.slashLifetime || 0.18;
    const slashSpeed = (weapon && weapon.slashSpeed) || COMBAT_CONFIG.slashSpeed || 420;
    const slashScale = (weapon && weapon.slashScale) || COMBAT_CONFIG.slashScale || 0.95;
    this.pierceLimit = (weapon && weapon.pierce) ? weapon.pierce : 999;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Orientering mot muspekarens vinkel
    this.setRotation(angle);
    // Vridningspunkt vid den inre fästpunkten för svepet (ox: 20, oy: 48 på 96x96 canvas)
    this.setOrigin(20 / 96, 48 / 96);
    this.setDepth(player.depth + 10);

    // Visuell styling och vapenfärg
    const isFacingLeft = Math.cos(angle) < 0;
    this.setScale(slashScale, isFacingLeft ? -slashScale : slashScale);
    this.setAlpha(0.98);

    if (weapon && weapon.slashColor) {
      this.setTint(weapon.slashColor);
    }

    // Hastighet framåt i musens riktning
    if (this.body) {
      this.body.setAllowGravity(false);
      this.body.setVelocity(
        Math.cos(angle) * slashSpeed,
        Math.sin(angle) * slashSpeed
      );
      this.body.setSize(52, 52);
    }

    // Snabbt svep framåt, expandera något och tona ut
    scene.tweens.add({
      targets: this,
      scaleX: slashScale * 1.25,
      scaleY: (isFacingLeft ? -1 : 1) * slashScale * 1.25,
      alpha: 0,
      duration: this.lifetime * 1000,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.destroy();
      },
    });

    // Kontrollera träffar direkt vid skapandet
    this.checkCollisions();
  }

  update(time, delta) {
    if (!this.active) return;
    const dt = delta !== undefined ? delta / 1000 : (time < 1 ? time : 0.016);
    this.elapsedTime += dt;

    this.checkCollisions();

    if (this.elapsedTime >= this.lifetime) {
      this.destroy();
    }
  }

  checkCollisions() {
    if (!this.active || !this.scene) return;

    const weapon = this.weapon;
    const maxRange = (weapon && weapon.range) || COMBAT_CONFIG.attackRange || 85;
    const maxArcDeg = (weapon && weapon.attackArcWidth) || COMBAT_CONFIG.attackArcWidth || 105;
    const maxHalfAngle = Phaser.Math.DegToRad(maxArcDeg / 2);
    const arcRadius = 55 * ((weapon && weapon.slashScale) || 1.0);

    // Träffar mot alla aktiva fiender
    if (this.scene.enemies) {
      const enemies = this.scene.enemies.getChildren();
      for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        if (!enemy.active || enemy.state === 'DEAD' || this.hitTargets.has(enemy)) {
          continue;
        }

        // Kollar både konformad träffyta från spelaren och avstånd från projektilbågen
        const distFromPlayer = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
        const angleToEnemy = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
        const angleDiff = Math.abs(Phaser.Math.Angle.Wrap(angleToEnemy - this.attackAngle));
        const inPlayerArc = (distFromPlayer <= maxRange) && (angleDiff <= maxHalfAngle);

        const distFromArc = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
        const inArcRadius = distFromArc <= arcRadius;

        if (inPlayerArc || inArcRadius) {
          this.hitTargets.add(enemy);
          this.onHitEnemy(enemy);

          // Ranged pierce begränsning
          if (weapon && (weapon.type === 'ranged' || weapon.type === 'magic')) {
            if (this.hitTargets.size >= this.pierceLimit) {
              this.destroy();
              break;
            }
          }
        }
      }
    }

    // Träffar mot kycklingar
    if (this.scene.chickens) {
      const chickens = this.scene.chickens.getChildren();
      for (let i = 0; i < chickens.length; i++) {
        const chicken = chickens[i];
        if (!chicken.active || chicken.state === 'DEAD' || this.hitTargets.has(chicken)) {
          continue;
        }

        const dist = Phaser.Math.Distance.Between(this.x, this.y, chicken.x, chicken.y);
        if (dist <= 50) {
          this.hitTargets.add(chicken);
          chicken.takeDamage(1, this.player.x, this.player.y);
        }
      }
    }
  }

  onHitEnemy(enemy) {
    const scene = this.scene || (enemy && enemy.scene);
    if (!scene) return;

    const weapon = this.weapon;
    let finalDamage = (weapon && weapon.damage) || COMBAT_CONFIG.damage || 40;
    let isCrit = false;

    // 1. Kritisk träff (t.ex. Shadow Dagger)
    if (weapon && weapon.critChance && Math.random() < weapon.critChance) {
      isCrit = true;
      finalDamage = Math.round(finalDamage * (weapon.critMultiplier || 2.0));
    }

    // 2. Skada och knockback
    const kbForce = (weapon && weapon.knockback) || COMBAT_CONFIG.knockbackForce || 260;
    const kbAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);

    if (typeof enemy.takeDamage === 'function') {
      enemy.takeDamage(finalDamage, this.player.x, this.player.y, kbForce);
    }

    // 3. Tiny Rogues Knockback-impuls rakt bort från träffen
    if (enemy.body && enemy.body.setVelocity) {
      enemy.body.setVelocity(
        Math.cos(kbAngle) * kbForce,
        Math.sin(kbAngle) * kbForce
      );
    }

    // 4. Vitt "Hit Flash" på fienden (visuell träffrespons)
    if (enemy.setTint) {
      enemy.setTint(0xffffff);
      if (scene.time) {
        scene.time.delayedCall(COMBAT_CONFIG.enemyFlashDuration || 90, () => {
          if (enemy.active && enemy.state !== 'DEAD') {
            if (enemy.clearTint) enemy.clearTint();
          }
        });
      }
    }

    // 5. Hitstop (mikro-paus på 30-50 ms för krispig träffkänsla)
    if (typeof scene.triggerHitstop === 'function') {
      scene.triggerHitstop(COMBAT_CONFIG.hitstopDuration || 40);
    }

    // 6. Träff-ljudeffekt
    if (scene.sound && scene.cache && scene.cache.audio && scene.cache.audio.exists('blood_splat')) {
      scene.sound.play('blood_splat', { volume: 0.65 });
    }

    // 7. Unika statuseffekter: Stun, Bleed, Burn
    if (weapon && weapon.statusEffect === 'stun') {
      // Extra tung knockback vid stun
      if (enemy.body && enemy.body.setVelocity) {
        enemy.body.setVelocity(
          Math.cos(kbAngle) * (kbForce * 1.25),
          Math.sin(kbAngle) * (kbForce * 1.25)
        );
      }
    }

    if (weapon && weapon.statusEffect === 'bleed' && weapon.bleedTicks && scene.time) {
      // Blödning: tickande DoT-skada över tid
      const bleedDamage = weapon.bleedDamage || 6;
      for (let t = 1; t <= weapon.bleedTicks; t++) {
        scene.time.delayedCall(t * 320, () => {
          if (enemy.active && enemy.state !== 'DEAD' && typeof enemy.takeDamage === 'function') {
            enemy.takeDamage(bleedDamage, enemy.x, enemy.y, 0);
            if (enemy.setTint) {
              enemy.setTint(0xef4444);
              if (scene.time) {
                scene.time.delayedCall(100, () => {
                  if (enemy.active && enemy.state !== 'DEAD' && enemy.clearTint) {
                    enemy.clearTint();
                  }
                });
              }
            }
          }
        });
      }
    }

    if (weapon && weapon.statusEffect === 'burn') {
      // Tickande eldskada över tid (Burn DoT)
      const burnTicks = weapon.burnTicks || 4;
      const burnDamage = weapon.burnDamage || 4;
      const burnInterval = weapon.burnInterval || 320;

      for (let t = 1; t <= burnTicks; t++) {
        if (scene.time) {
          scene.time.delayedCall(t * burnInterval, () => {
            if (enemy.active && enemy.state !== 'DEAD' && typeof enemy.takeDamage === 'function') {
              // Tillfoga eldskada
              enemy.takeDamage(burnDamage, enemy.x, enemy.y, 0);

              // Endast den svävande siffran och 🔥 ska synas
              if (scene.add) {
                const dmgText = scene.add.text(
                  enemy.x + Phaser.Math.Between(-8, 8),
                  enemy.y - 12,
                  `🔥 -${burnDamage}`,
                  {
                    fontFamily: 'Cinzel, sans-serif',
                    fontSize: '11px',
                    fontStyle: 'bold',
                    color: '#f97316',
                    stroke: '#000000',
                    strokeThickness: 3,
                  }
                ).setOrigin(0.5).setDepth(enemy.depth + 10);

                if (scene.tweens) {
                  scene.tweens.add({
                    targets: dmgText,
                    y: dmgText.y - 18,
                    alpha: 0,
                    duration: 400,
                    ease: 'Quad.easeOut',
                    onComplete: () => dmgText.destroy(),
                  });
                }
              }
            }
          });
        }
      }
    }
  }
}
