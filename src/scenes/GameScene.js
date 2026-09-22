import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import GhostEnemy from '../entities/GhostEnemy.js';
import SoulsHUD from '../ui/SoulsHUD.js';
import level1Data from '../data/SoulsLevel1.json';

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
    // Dynamic world bounds:
    // Floor 1: SoulsLevel1 Battlemap (6750 x 4800)
    // Floor 2: Torture Chamber Crypt (2048 x 1536)
    const worldWidth = this.floor === 1 ? 6750 : 2048;
    const worldHeight = this.floor === 1 ? 4800 : 1536;
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    // State flags for hatch and room progression
    this.hatchUnlocked = false;
    this.isTransitioning = false;

    // 1. Render Background based on active floor
    if (this.floor === 1) {
      const bg = this.add.image(0, 0, 'dungeon_level1').setOrigin(0, 0);
      bg.setDisplaySize(worldWidth, worldHeight);
    } else {
      this.add.image(worldWidth / 2, worldHeight / 2, 'dungeon_bg_room2').setOrigin(0.5, 0.5);
    }

    // 2. Setup Collision Groups
    this.obstacles = this.physics.add.staticGroup();

    // 3. Build Collision Boundaries matching the active floor's props
    this.buildObstacles(worldWidth, worldHeight);

    // 4. Dynamic Lighting for active room
    this.createLighting();

    // 5. Spawn Ashen One (Player)
    // Floor 1: Beside the crypt bonfire / sarcophagus (1550, 2527)
    // Floor 2: Enters from the northern door (988, 200)
    const spawnX = this.floor === 1 ? 1550 : 988;
    const spawnY = this.floor === 1 ? 2527 : 200;
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
    this.cameras.main.setZoom(this.floor === 1 ? 1.15 : 1.35);
    this.cameras.main.fadeIn(700, 0, 0, 0);

    // 10. HUD System
    this.hud = new SoulsHUD(this);

    // 11. Atmospheric Location Title Display
    if (this.floor === 1) {
      this.displayAreaTitle('FÖRBANNADE SALEN', 'The Accursed Crypts & Grand Halls - Våning 1');
    } else {
      this.displayAreaTitle('TORTYRKAMMAREN', 'The Torture Chamber - Våning 2');
    }

    // Handle Window Resize
    this.scale.on('resize', (gameSize) => {
      this.cameras.main.setSize(gameSize.width, gameSize.height);
    });
  }

  buildObstacles(width, height) {
    // Outer perimeter boundaries (always prevent escaping the map)
    this.createObstacle(width / 2, 8, width, 16); // Top
    this.createObstacle(width / 2, height - 8, width, 16); // Bottom
    this.createObstacle(8, height / 2, 16, height); // Left
    this.createObstacle(width - 8, height / 2, 16, height); // Right

    if (this.floor === 1) {
      // Build Level 1 solid walls and pillars from SoulsLevel1.json
      const nonDoors = level1Data.walls.filter(w => w.door !== 1);

      // Separate pillars (octagonal clusters of short segments) from straight structural walls
      const shortSegs = [];
      const longSegs = [];
      nonDoors.forEach(w => {
        const len = Math.hypot(w.c[2] - w.c[0], w.c[3] - w.c[1]);
        if (len < 80) shortSegs.push(w);
        else longSegs.push(w);
      });

      // Group short segments into pillar centers
      const pillars = [];
      shortSegs.forEach(w => {
        const cx = (w.c[0] + w.c[2]) / 2;
        const cy = (w.c[1] + w.c[3]) / 2;
        let found = pillars.find(p => Math.hypot(p.x - cx, p.y - cy) < 60);
        if (found) {
          found.pts.push({ x: cx, y: cy });
          found.x = found.pts.reduce((sum, pt) => sum + pt.x, 0) / found.pts.length;
          found.y = found.pts.reduce((sum, pt) => sum + pt.y, 0) / found.pts.length;
        } else {
          pillars.push({ x: cx, y: cy, pts: [{ x: cx, y: cy }] });
        }
      });

      // 1. Create Pillar Obstacles
      pillars.forEach(p => {
        this.createObstacle(p.x, p.y, 66, 66);
      });

      // 2. Create Structural Wall Obstacles
      longSegs.forEach(w => {
        const [x1, y1, x2, y2] = w.c;
        const isH = Math.abs(y1 - y2) < 8;
        if (isH) {
          const minX = Math.min(x1, x2);
          const maxX = Math.max(x1, x2);
          const cx = (minX + maxX) / 2;
          const cy = (y1 + y2) / 2;
          this.createObstacle(cx, cy, maxX - minX + 26, 28);
        } else {
          const minY = Math.min(y1, y2);
          const maxY = Math.max(y1, y2);
          const cx = (x1 + x2) / 2;
          const cy = (minY + maxY) / 2;
          this.createObstacle(cx, cy, 28, maxY - minY + 26);
        }
      });

      // 3. Crypt Props: Central Sarcophagus & Altar
      this.createObstacle(1550, 2380, 140, 230);
      this.createObstacle(1550, 2530, 70, 70); // Bonfire hearth base

      // 4. Hatch to Floor 2 in Upper Wooden Lodge (locked initially)
      this.hatchObstacle = this.createObstacle(5540, 1050, 100, 100);
    } else {
      // Room 2 (Torture Chamber) Props
      this.createObstacle(130, 160, 190, 250); // Torture Bed with corpse (Top Left)
      this.createObstacle(75, 615, 110, 290); // Upper Shelf (Mid-West wall)
      this.createObstacle(75, 1010, 110, 290); // Lower Shelf (South-West wall)
      this.createObstacle(1435, 1300, 430, 240); // Large Dining Table & Chairs (Bottom Right)
      this.createObstacle(1835, 175, 310, 260); // Smashed Barrels, Skeleton & Rubble (Top Right)
      this.createObstacle(1970, 775, 130, 290); // Crumbling Stone Wall (Mid-East wall)
      this.hatchObstacle = this.createObstacle(75, 715, 100, 110);
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
      // 1. Pointlights imported from SoulsLevel1.json
      level1Data.lights.forEach((l, idx) => {
        const colorHex = parseInt(l.tintColor.replace('#', '0x'), 16);
        const radius = Math.max(130, Math.round(l.dim * 16));
        const intensity = l.bright > 15 ? 0.72 : 0.52;
        const pl = this.add.pointlight(l.x, l.y, colorHex, radius, intensity, 0.055);

        // Subtle flame flicker
        if (idx % 3 === 0) {
          this.tweens.add({
            targets: pl,
            intensity: { from: intensity * 0.88, to: intensity * 1.12 },
            radius: { from: radius * 0.95, to: radius * 1.05 },
            duration: Phaser.Math.Between(260, 420),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }
      });

      // 2. Cyan Water Fountain Shimmer in Grand Checkered Hall (4528, 3217)
      const fountainGlow = this.add.pointlight(4528, 3217, 0x00e5ff, 280, 0.85, 0.04);
      this.tweens.add({
        targets: fountainGlow,
        intensity: { from: 0.75, to: 0.95 },
        radius: { from: 260, to: 300 },
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // 3. Bonfire / Sarcophagus Hearth Embers in Crypt (1550, 2527)
      this.add.particles(1550, 2527, 'ember_spark', {
        speed: { min: 20, max: 55 },
        angle: { min: 230, max: 310 },
        scale: { start: 1, end: 0.1 },
        alpha: { start: 0.95, end: 0 },
        lifespan: { min: 700, max: 1400 },
        frequency: 60,
        blendMode: 'ADD',
      });

      // 4. Burning Fireplace Embers in Grand Checkered Hall (5740, 3900)
      this.add.particles(5740, 3900, 'ember_spark', {
        speed: { min: 25, max: 70 },
        angle: { min: 220, max: 320 },
        scale: { start: 1.1, end: 0.2 },
        alpha: { start: 0.95, end: 0 },
        lifespan: { min: 600, max: 1200 },
        frequency: 45,
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
      // Floor 1 (Accursed Crypts & Grand Halls): 5 Knights, 5 Ghosts across map wings
      // 1. Crypt Chamber (West)
      const knight1 = new Enemy(this, 1050, 2200);
      const knight2 = new Enemy(this, 2100, 2000);
      const ghost1 = new GhostEnemy(this, 800, 2700);

      // 2. Forest Passage & Outdoors (Mid)
      const ghost2 = new GhostEnemy(this, 3050, 3100);
      const ghost3 = new GhostEnemy(this, 3200, 1800);

      // 3. Grand Checkered Hall (East)
      const knight3 = new Enemy(this, 4000, 3200);
      const knight4 = new Enemy(this, 5300, 3200);
      const ghost4 = new GhostEnemy(this, 4528, 3217); // Circling the water fountain

      // 4. Upper Wooden Lodge (North-East)
      const knight5 = new Enemy(this, 5500, 1200);
      const ghost5 = new GhostEnemy(this, 5850, 850);

      [knight1, knight2, knight3, knight4, knight5].forEach(k => {
        this.knights.add(k);
        this.enemies.add(k);
      });

      [ghost1, ghost2, ghost3, ghost4, ghost5].forEach(g => {
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
    const hatchX = this.floor === 1 ? 5540 : 75;
    const hatchY = this.floor === 1 ? 1050 : 715;
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

    const subTitleText = this.floor === 1
      ? 'Luckan i det norra rummet har öppnats — Stig ned i djupet'
      : 'Luckan i västra väggen har öppnats — Stig ned i djupet';

    const subTitle = this.add.text(0, 20, subTitleText, {
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

      // Combat hit detection: player colossal hammer smash hitting enemies
      if (this.player.isAttacking) {
        this.enemies.getChildren().forEach(enemy => {
          if (enemy.state !== 'DEAD' && enemy.lastHitSwingId !== this.player.currentSwingId) {
            if (this.player.isPointInAttackCone(enemy.x, enemy.y)) {
              enemy.lastHitSwingId = this.player.currentSwingId;
              const hammerDamage = 45; // Heavy crushing colossal hammer impact
              enemy.takeDamage(hammerDamage, this.player.x, this.player.y);
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
