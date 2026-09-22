import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import GhostEnemy from '../entities/GhostEnemy.js';
import SoulsHUD from '../ui/SoulsHUD.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    // Exact dimensions of the new dungeon background (2048 x 1536)
    const worldWidth = 2048;
    const worldHeight = 1536;
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    // 1. Render Handcrafted Gothic Dungeon Battlemap Background
    this.add.image(worldWidth / 2, worldHeight / 2, 'dungeon_bg').setOrigin(0.5, 0.5);

    // 2. Setup Collision Groups
    this.obstacles = this.physics.add.staticGroup();

    // 3. Build Collision Boundaries matching the map props
    this.buildObstacles(worldWidth, worldHeight);

    // 4. Dynamic Lighting for Hearth and Column Candles
    this.createHearthAndTorches();

    // 5. Spawn Ashen One (Player) on the Red Carpet in the lower hall
    this.player = new Player(this, 988, 1260);

    // 6. Spawn Enemies (Hollow Knights & Cursed Wraiths)
    this.enemies = this.add.group();
    this.knights = this.add.group();
    this.spawnEnemies();

    // 7. Physics Collisions
    this.physics.add.collider(this.player, this.obstacles);
    this.physics.add.collider(this.knights, this.obstacles); // Knights collide with walls & pillars; ghosts phase through!
    this.physics.add.collider(this.player, this.enemies);

    // 8. Ambient Floating Cinders
    this.createEmberWeather(worldWidth, worldHeight);

    // 9. Camera Settings - Smooth Soulsborne Lerp & Dark Vignette Zoom
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setZoom(1.35);

    // 10. HUD System
    this.hud = new SoulsHUD(this);

    // 11. Atmospheric Location Title Display
    this.displayAreaTitle('FÖRBANNADE SALEN', 'The Accursed Hall');

    // Handle Window Resize
    this.scale.on('resize', (gameSize) => {
      this.cameras.main.setSize(gameSize.width, gameSize.height);
    });
  }

  buildObstacles(width, height) {
    // Outer perimeter walls
    this.createObstacle(width / 2, 10, width, 20); // Top wall
    this.createObstacle(440, height - 10, 880, 20); // Bottom wall left of hearth
    this.createObstacle(1570, height - 10, 940, 20); // Bottom wall right of hearth
    this.createObstacle(10, height / 2, 20, height); // Left wall
    this.createObstacle(width - 10, height / 2, 20, height); // Right wall

    // Central Stone Hearth / Fireplace (Bottom Center)
    this.createObstacle(988, 1495, 230, 80);

    // Left Large Round Wooden Pillar
    this.createObstacle(738, 570, 160, 150);

    // Right Large Round Wooden Pillar
    this.createObstacle(1245, 880, 160, 150);

    // Crates & Spiderwebbed Rubble (Top Left)
    this.createObstacle(250, 220, 200, 180);

    // Bookshelf & Scrolls (Top Right)
    this.createObstacle(1750, 70, 160, 90);

    // Heavy Reinforced Chest (Left Edge)
    this.createObstacle(75, 715, 100, 110);

    // Stacked Barrels (Bottom Right)
    this.createObstacle(1675, 1480, 210, 90);
  }

  createObstacle(x, y, w, h) {
    const rect = this.add.rectangle(x, y, w, h, 0x000000, 0); // invisible static collision box
    this.physics.add.existing(rect, true);
    this.obstacles.add(rect);
    return rect;
  }

  createHearthAndTorches() {
    // Glowing Fireplace at bottom center (988, 1490)
    if (this.add.pointlight && this.game.renderer.type === Phaser.WEBGL) {
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

      // Warm candle light on the left wooden pillar
      const leftPillarLight = this.add.pointlight(738, 565, 0xffaa33, 140, 0.45, 0.06);
      this.tweens.add({
        targets: leftPillarLight,
        intensity: { from: 0.38, to: 0.52 },
        duration: 350,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // Warm candle light on the right wooden pillar
      const rightPillarLight = this.add.pointlight(1245, 875, 0xffaa33, 140, 0.45, 0.06);
      this.tweens.add({
        targets: rightPillarLight,
        intensity: { from: 0.38, to: 0.52 },
        duration: 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Upward floating hearth flame embers
    this.add.particles(988, 1485, 'ember_spark', {
      speed: { min: 25, max: 65 },
      angle: { min: 240, max: 300 }, // Upward into chimney
      scale: { start: 1, end: 0.2 },
      alpha: { start: 0.95, end: 0 },
      lifespan: { min: 600, max: 1300 },
      frequency: 50,
      blendMode: 'ADD',
    });
  }

  spawnEnemies() {
    // 1. Hollow Knights (Armored ground patrols)
    const knight1 = new Enemy(this, 630, 680);
    const knight2 = new Enemy(this, 1420, 780);
    const knight3 = new Enemy(this, 988, 380);

    [knight1, knight2, knight3].forEach(k => {
      this.knights.add(k);
      this.enemies.add(k);
    });

    // 2. Cursed Wraiths (Ghosts with glowing red eyes that phase through pillars)
    const ghost1 = new GhostEnemy(this, 380, 1050); // Lurking by the blood stain & chest
    const ghost2 = new GhostEnemy(this, 1640, 400); // Lurking near the skeleton & bookshelf

    [ghost1, ghost2].forEach(g => {
      this.enemies.add(g);
    });
  }

  createEmberWeather(width, height) {
    // Ambient floating embers rising across the dungeon hall
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

    // Dark Souls dramatic area discovery fade
    this.tweens.chain({
      targets: titleContainer,
      tweens: [
        { alpha: 1, duration: 1800, ease: 'Sine.easeIn' },
        { alpha: 1, duration: 2200 },
        { alpha: 0, duration: 1800, ease: 'Sine.easeOut' },
      ],
    });
  }

  update(time, delta) {
    if (this.player) {
      this.player.update(time, delta);
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

      if (this.hud) {
        this.hud.update(this.player);
      }
    }
  }
}
