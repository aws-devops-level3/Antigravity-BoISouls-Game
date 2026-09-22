import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import GhostEnemy from '../entities/GhostEnemy.js';
import SoulsHUD from '../ui/SoulsHUD.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data) {
    this.floor = data && data.floor ? data.floor : 1;
    this.initialSouls = data && data.souls !== undefined ? data.souls : 2450;
    this.initialHealth = data && data.health !== undefined ? data.health : 100;
  }

  create() {
    // Exact dimensions of the dungeon background (2048 x 1536)
    const worldWidth = 2048;
    const worldHeight = 1536;
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    // State flags for hatch and room progression
    this.hatchUnlocked = false;
    this.isTransitioning = false;

    // 1. Render Background based on active floor
    // Floor 1: Gothic Dungeon Hall (dungeon_bg)
    // Floor 2: Torture Chamber / Dining Crypt (dungeon_bg_room2)
    const bgKey = this.floor === 1 ? 'dungeon_bg' : 'dungeon_bg_room2';
    this.add.image(worldWidth / 2, worldHeight / 2, bgKey).setOrigin(0.5, 0.5);

    // 2. Setup Collision Groups
    this.obstacles = this.physics.add.staticGroup();

    // 3. Build Collision Boundaries matching the active floor's props
    this.buildObstacles(worldWidth, worldHeight);

    // 4. Dynamic Lighting for active room
    this.createLighting();

    // 5. Spawn Ashen One (Player)
    // Floor 1: Spawns in lower hall on carpet near hearth (988, 1260)
    // Floor 2: Enters from the northern door (988, 200)
    const spawnX = 988;
    const spawnY = this.floor === 1 ? 1260 : 200;
    this.player = new Player(this, spawnX, spawnY);
    this.player.souls = this.initialSouls;
    this.player.health = this.initialHealth;

    // 6. Spawn Enemies
    this.enemies = this.add.group();
    this.knights = this.add.group();
    this.spawnEnemies();

    // 7. Physics Collisions
    this.physics.add.collider(this.player, this.obstacles);
    this.physics.add.collider(this.knights, this.obstacles); // Knights collide with walls & props; ghosts phase through!
    this.physics.add.collider(this.player, this.enemies);

    // 8. Ambient Floating Cinders
    this.createEmberWeather(worldWidth, worldHeight);

    // 9. Camera Settings - Smooth Soulsborne Lerp & Dark Vignette Zoom
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setZoom(1.35);
    this.cameras.main.fadeIn(700, 0, 0, 0);

    // 10. HUD System
    this.hud = new SoulsHUD(this);

    // 11. Atmospheric Location Title Display
    if (this.floor === 1) {
      this.displayAreaTitle('FÖRBANNADE SALEN', 'The Accursed Hall - Våning 1');
    } else {
      this.displayAreaTitle('TORTYRKAMMAREN', 'The Torture Chamber - Våning 2');
    }

    // Handle Window Resize
    this.scale.on('resize', (gameSize) => {
      this.cameras.main.setSize(gameSize.width, gameSize.height);
    });
  }

  buildObstacles(width, height) {
    // Outer perimeter walls (always present)
    this.createObstacle(width / 2, 10, width, 20); // Top wall
    this.createObstacle(width / 2, height - 10, width, 20); // Bottom wall
    this.createObstacle(10, height / 2, 20, height); // Left wall
    this.createObstacle(width - 10, height / 2, 20, height); // Right wall

    if (this.floor === 1) {
      // Room 1 Props
      this.createObstacle(988, 1495, 230, 80); // Central Hearth
      this.createObstacle(738, 570, 160, 150); // Left Round Pillar
      this.createObstacle(1245, 880, 160, 150); // Right Round Pillar
      this.createObstacle(250, 220, 200, 180); // Crates (Top Left)
      this.createObstacle(1750, 70, 160, 90); // Bookshelf (Top Right)
      this.hatchObstacle = this.createObstacle(75, 715, 100, 110); // Closed Hatch (Left)
      this.createObstacle(1675, 1480, 210, 90); // Stacked Barrels (Bottom Right)
    } else {
      // Room 2 (Torture Chamber) Props
      this.createObstacle(130, 160, 190, 250); // Torture Bed with corpse (Top Left)
      this.createObstacle(75, 615, 110, 290); // Upper Shelf (Mid-West wall)
      this.createObstacle(75, 1010, 110, 290); // Lower Shelf (South-West wall)
      this.createObstacle(1435, 1300, 430, 240); // Large Dining Table & Chairs (Bottom Right)
      this.createObstacle(1835, 175, 310, 260); // Smashed Barrels, Skeleton & Rubble (Top Right)
      this.createObstacle(1970, 775, 130, 290); // Crumbling Stone Wall (Mid-East wall)
    }
  }

  createObstacle(x, y, w, h) {
    const rect = this.add.rectangle(x, y, w, h, 0x000000, 0); // invisible static collision box
    this.physics.add.existing(rect, true);
    this.obstacles.add(rect);
    return rect;
  }

  createLighting() {
    if (!this.add.pointlight || this.game.renderer.type !== Phaser.WEBGL) return;

    if (this.floor === 1) {
      // Room 1 Hearth Fireplace & Column Candles
      const hearthLight = this.add.pointlight(988, 1485, 0xff7711, 260, 0.75, 0.04);
      this.tweens.add({
        targets: hearthLight,
        intensity: { from: 0.65, to: 0.88 },
        radius: { from: 240, to: 275 },
        duration: 280,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      const leftPillarLight = this.add.pointlight(738, 565, 0xffaa33, 140, 0.45, 0.06);
      this.tweens.add({
        targets: leftPillarLight,
        intensity: { from: 0.38, to: 0.52 },
        duration: 350,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      const rightPillarLight = this.add.pointlight(1245, 875, 0xffaa33, 140, 0.45, 0.06);
      this.tweens.add({
        targets: rightPillarLight,
        intensity: { from: 0.38, to: 0.52 },
        duration: 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      this.add.particles(988, 1485, 'ember_spark', {
        speed: { min: 25, max: 65 },
        angle: { min: 240, max: 300 },
        scale: { start: 1, end: 0.2 },
        alpha: { start: 0.95, end: 0 },
        lifespan: { min: 600, max: 1300 },
        frequency: 50,
        blendMode: 'ADD',
      });
    } else {
      // Room 2 Wall Torch above the torture bed (305, 65)
      const torchLight = this.add.pointlight(305, 65, 0xff8811, 220, 0.75, 0.05);
      this.tweens.add({
        targets: torchLight,
        intensity: { from: 0.65, to: 0.88 },
        radius: { from: 210, to: 240 },
        duration: 300,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      this.add.particles(305, 65, 'ember_spark', {
        speed: { min: 15, max: 45 },
        angle: { min: 240, max: 300 },
        scale: { start: 0.8, end: 0.1 },
        alpha: { start: 0.9, end: 0 },
        lifespan: 800,
        frequency: 80,
        blendMode: 'ADD',
      });

      // Ambient Candlelight on the Dining Table (1435, 1290)
      const tableLight = this.add.pointlight(1435, 1290, 0xffaa44, 180, 0.55, 0.06);
      this.tweens.add({
        targets: tableLight,
        intensity: { from: 0.45, to: 0.62 },
        duration: 380,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  spawnEnemies() {
    if (this.floor === 1) {
      // Floor 1: 3 Knights, 2 Ghosts
      const knight1 = new Enemy(this, 630, 680);
      const knight2 = new Enemy(this, 1420, 780);
      const knight3 = new Enemy(this, 988, 380);

      [knight1, knight2, knight3].forEach(k => {
        this.knights.add(k);
        this.enemies.add(k);
      });

      const ghost1 = new GhostEnemy(this, 380, 1050);
      const ghost2 = new GhostEnemy(this, 1640, 400);

      [ghost1, ghost2].forEach(g => {
        this.enemies.add(g);
      });
    } else {
      // Floor 2 (Torture Chamber): 3 Knights, 2 Ghosts positioned around room props
      const knight1 = new Enemy(this, 460, 380); // Near torture bed
      const knight2 = new Enemy(this, 1180, 1100); // Patrolling near dining table
      const knight3 = new Enemy(this, 980, 700); // Patrolling the red carpet

      [knight1, knight2, knight3].forEach(k => {
        this.knights.add(k);
        this.enemies.add(k);
      });

      const ghost1 = new GhostEnemy(this, 1680, 280); // Haunting the broken barrels & skeleton
      const ghost2 = new GhostEnemy(this, 440, 1100); // Lurking by the potion shelves

      [ghost1, ghost2].forEach(g => {
        this.enemies.add(g);
      });
    }
  }

  unlockHatch() {
    this.hatchUnlocked = true;

    // 1. Remove solid collision blocking the hatch
    if (this.hatchObstacle) {
      this.hatchObstacle.destroy();
      this.hatchObstacle = null;
    }

    // 2. Spawn the Open Hatch Sprite with descending stairs
    const hatchX = 75;
    const hatchY = 715;
    const openHatch = this.add.sprite(hatchX, hatchY, 'open_hatch');
    openHatch.setOrigin(0.5, 0.5);
    openHatch.setDepth(20);

    // 3. Golden soul beacon light emanating from the open abyss
    if (this.add.pointlight && this.game.renderer.type === Phaser.WEBGL) {
      const hatchLight = this.add.pointlight(hatchX + 10, hatchY, 0xffaa22, 190, 0.8, 0.05);
      this.tweens.add({
        targets: hatchLight,
        intensity: { from: 0.65, to: 0.95 },
        radius: { from: 180, to: 210 },
        duration: 400,
        yoyo: true,
        repeat: -1,
      });
    }

    // 4. Golden soul particles floating upward into the room
    const hatchSparks = this.add.particles(hatchX + 8, hatchY, 'ember_spark', {
      speed: { min: 20, max: 60 },
      angle: { min: -40, max: 40 },
      scale: { start: 1, end: 0.2 },
      alpha: { start: 0.95, end: 0 },
      tint: 0xffd700,
      lifespan: 850,
      frequency: 80,
      blendMode: 'ADD',
    });
    hatchSparks.setDepth(22);

    // 5. Display dramatic Souls banner: "HELGEDOMEN RENAD"
    this.displayRoomClearedBanner();

    // 6. Overlap trigger to transition to next room
    const triggerZone = this.add.zone(hatchX, hatchY, 80, 90);
    this.physics.add.existing(triggerZone, true);
    this.physics.add.overlap(this.player, triggerZone, () => {
      this.transitionToNextRoom();
    });
  }

  displayRoomClearedBanner() {
    const cam = this.cameras.main;
    const bannerContainer = this.add.container(cam.width / 2, cam.height * 0.32);
    bannerContainer.setScrollFactor(0);
    bannerContainer.setDepth(2500);
    bannerContainer.setAlpha(0);

    // Banner dark backdrop band
    const bg = this.add.graphics();
    bg.fillStyle(0x060508, 0.75);
    bg.fillRect(-cam.width / 2, -35, cam.width, 70);
    bg.lineStyle(1.5, 0xc99e3a, 0.7);
    bg.strokeLineShape(new Phaser.Geom.Line(-cam.width / 2, -35, cam.width / 2, -35));
    bg.strokeLineShape(new Phaser.Geom.Line(-cam.width / 2, 35, cam.width / 2, 35));

    const mainTitle = this.add.text(0, -6, 'HELGEDOMEN RENAD', {
      fontFamily: 'Cinzel, serif',
      fontSize: '28px',
      fontStyle: 'bold',
      letterSpacing: 6,
      color: '#f5efe6',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    const subTitle = this.add.text(0, 20, 'Luckan i västra väggen har öppnats — Stig ned i djupet', {
      fontFamily: 'Cinzel, serif',
      fontSize: '13px',
      letterSpacing: 3,
      color: '#d4af37',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    bannerContainer.add([bg, mainTitle, subTitle]);

    this.tweens.chain({
      targets: bannerContainer,
      tweens: [
        { alpha: 1, duration: 1200, ease: 'Sine.easeIn' },
        { alpha: 1, duration: 2600 },
        { alpha: 0, duration: 1400, ease: 'Sine.easeOut', onComplete: () => bannerContainer.destroy() },
      ],
    });
  }

  displayVictoryBanner() {
    if (this.hasShownVictoryBanner) return;
    this.hasShownVictoryBanner = true;

    const cam = this.cameras.main;
    const bannerContainer = this.add.container(cam.width / 2, cam.height * 0.32);
    bannerContainer.setScrollFactor(0);
    bannerContainer.setDepth(2500);
    bannerContainer.setAlpha(0);

    const bg = this.add.graphics();
    bg.fillStyle(0x060508, 0.75);
    bg.fillRect(-cam.width / 2, -35, cam.width, 70);
    bg.lineStyle(1.5, 0xc99e3a, 0.7);
    bg.strokeLineShape(new Phaser.Geom.Line(-cam.width / 2, -35, cam.width / 2, -35));
    bg.strokeLineShape(new Phaser.Geom.Line(-cam.width / 2, 35, cam.width / 2, 35));

    const mainTitle = this.add.text(0, -6, 'KRYPTAN RENAD — SEGER', {
      fontFamily: 'Cinzel, serif',
      fontSize: '28px',
      fontStyle: 'bold',
      letterSpacing: 6,
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    const subTitle = this.add.text(0, 20, 'Samtliga fasor i tortyrkammaren har fördrivits', {
      fontFamily: 'Cinzel, serif',
      fontSize: '13px',
      letterSpacing: 3,
      color: '#e2d3af',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    bannerContainer.add([bg, mainTitle, subTitle]);

    this.tweens.chain({
      targets: bannerContainer,
      tweens: [
        { alpha: 1, duration: 1200, ease: 'Sine.easeIn' },
        { alpha: 1, duration: 3200 },
        { alpha: 0, duration: 1400, ease: 'Sine.easeOut', onComplete: () => bannerContainer.destroy() },
      ],
    });
  }

  transitionToNextRoom() {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    if (this.player && this.player.body) {
      this.player.body.setVelocity(0, 0);
    }

    // Camera fade out to black
    this.cameras.main.fade(800, 0, 0, 0, false, (cam, progress) => {
      if (progress === 1) {
        this.scene.restart({
          floor: 2,
          souls: this.player.souls,
          health: this.player.health,
        });
      }
    });
  }

  createEmberWeather(width, height) {
    this.emberParticles = this.add.particles(0, 0, 'ember_spark', {
      emitZone: {
        source: new Phaser.Geom.Rectangle(0, 0, width, height),
        type: 'random',
      },
      speedY: { min: -35, max: -15 },
      speedX: { min: -10, max: 10 },
      scale: { start: 0.7, end: 0.1 },
      alpha: { start: 0.55, end: 0 },
      lifespan: { min: 2500, max: 4500 },
      frequency: 110,
      blendMode: 'ADD',
    });
    this.emberParticles.setDepth(999);
  }

  displayAreaTitle(mainTitle, subTitle) {
    const cam = this.cameras.main;
    const titleContainer = this.add.container(cam.width / 2, cam.height * 0.35);
    titleContainer.setScrollFactor(0);
    titleContainer.setDepth(1500);
    titleContainer.setAlpha(0);

    const titleText = this.add.text(0, 0, mainTitle, {
      fontFamily: 'Cinzel, serif',
      fontSize: '32px',
      fontStyle: 'bold',
      letterSpacing: 6,
      color: '#f3ece3',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    const subText = this.add.text(0, 36, subTitle, {
      fontFamily: 'Cinzel, serif',
      fontSize: '14px',
      letterSpacing: 4,
      color: '#c99e3a',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    titleContainer.add([titleText, subText]);

    this.tweens.chain({
      targets: titleContainer,
      tweens: [
        { alpha: 1, duration: 1800, ease: 'Sine.easeIn' },
        { alpha: 1, duration: 2200 },
        { alpha: 0, duration: 1800, ease: 'Sine.easeOut', onComplete: () => titleContainer.destroy() },
      ],
    });
  }

  update(time, delta) {
    if (this.player) {
      if (!this.isTransitioning) {
        this.player.update(time, delta);
      }
      this.player.setDepth(this.player.y + 10);

      // Update all active enemies
      this.enemies.getChildren().forEach(enemy => {
        enemy.update(time, delta, this.player);
      });

      // Combat hit detection: player sword attack cone hitting enemies
      if (this.player.isAttacking) {
        this.enemies.getChildren().forEach(enemy => {
          if (enemy.state !== 'DEAD' && enemy.lastHitSwingId !== this.player.currentSwingId) {
            if (this.player.isPointInAttackCone(enemy.x, enemy.y)) {
              enemy.lastHitSwingId = this.player.currentSwingId;
              const swordDamage = 35; // 2 solid greatsword hits to fell a knight
              enemy.takeDamage(swordDamage, this.player.x, this.player.y);
            }
          }
        });
      }

      // Check room cleared condition
      if (!this.hatchUnlocked && this.enemies.countActive(true) === 0) {
        if (this.floor === 1) {
          this.unlockHatch();
        } else {
          this.displayVictoryBanner();
        }
      }

      if (this.hud) {
        this.hud.update(this.player);
      }
    }
  }
}
