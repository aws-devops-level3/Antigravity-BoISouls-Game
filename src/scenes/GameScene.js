import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import SoulsHUD from '../ui/SoulsHUD.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    const worldWidth = 2400;
    const worldHeight = 2400;
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    // 1. Render Gothic Stone Tile Floor
    this.createWorldFloor(worldWidth, worldHeight);

    // 2. Setup Collision Groups
    this.obstacles = this.physics.add.staticGroup();

    // 3. Build Sanctuary Architecture (Walls & Pillars)
    this.buildSanctuary(worldWidth, worldHeight);

    // 4. Center Bonfire
    this.createBonfire(worldWidth / 2, worldHeight / 2);

    // 5. Spawn Ashen One (Player) near Bonfire
    this.player = new Player(this, worldWidth / 2, worldHeight / 2 + 100);

    // 6. Spawn Hollow Knights (Cursed Wandering Knights)
    this.enemies = this.add.group();
    this.spawnEnemies(worldWidth / 2, worldHeight / 2);

    // 7. Physics Collisions
    this.physics.add.collider(this.player, this.obstacles);
    this.physics.add.collider(this.enemies, this.obstacles);
    this.physics.add.collider(this.player, this.enemies);

    // 8. Ambient Floating Embers (Cinders of the First Flame)
    this.createEmberWeather(worldWidth, worldHeight);

    // 8. Camera Settings - Smooth Soulsborne Lerp
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setZoom(1.4);

    // 9. HUD System
    this.hud = new SoulsHUD(this);

    // 10. Atmospheric Location Title Display
    this.displayAreaTitle('ELDENS HELGEDOM', 'Firelink Shrine');

    // Handle Window Resize
    this.scale.on('resize', (gameSize) => {
      this.cameras.main.setSize(gameSize.width, gameSize.height);
    });
  }

  createWorldFloor(width, height) {
    // Tiled floor using our procedural floor tile
    this.add.tileSprite(width / 2, height / 2, width, height, 'floor_tile');
  }

  buildSanctuary(width, height) {
    // Outer perimeter walls
    const wallThickness = 64;
    
    // Top & Bottom walls
    for (let x = 0; x < width; x += 64) {
      this.createWallBlock(x + 32, 32);
      this.createWallBlock(x + 32, height - 32);
    }
    // Left & Right walls
    for (let y = 64; y < height - 64; y += 64) {
      this.createWallBlock(32, y + 32);
      this.createWallBlock(width - 32, y + 32);
    }

    // Grand Hall Pillars (arranged in two gothic colonnades)
    const centerX = width / 2;
    const centerY = height / 2;
    const pillarRows = [-400, -250, -100, 100, 250, 400];

    pillarRows.forEach(offsetY => {
      this.createPillar(centerX - 240, centerY + offsetY);
      this.createPillar(centerX + 240, centerY + offsetY);
    });

    // Outer corner decorative pillars
    const cornerOffsets = [
      { x: centerX - 500, y: centerY - 450 },
      { x: centerX + 500, y: centerY - 450 },
      { x: centerX - 500, y: centerY + 450 },
      { x: centerX + 500, y: centerY + 450 },
    ];
    cornerOffsets.forEach(pos => this.createPillar(pos.x, pos.y));
  }

  createWallBlock(x, y) {
    const wall = this.obstacles.create(x, y, 'wall_tile');
    wall.refreshBody();
  }

  createPillar(x, y) {
    const pillar = this.obstacles.create(x, y, 'pillar');
    // Set collision box to the base of the pillar for 2.5D depth
    pillar.body.setSize(36, 24);
    pillar.body.setOffset(14, 68);
    pillar.refreshBody();
    pillar.setDepth(y + 20); // Y-sorting depth
  }

  createBonfire(x, y) {
    // Bonfire Sprite
    const bonfire = this.add.sprite(x, y, 'bonfire');
    bonfire.setDepth(y);

    // Warm radial glow
    if (this.add.pointlight && this.game.renderer.type === Phaser.WEBGL) {
      const bonfireLight = this.add.pointlight(x, y + 10, 0xff6611, 240, 0.7, 0.04);
      
      // Flickering bonfire light animation
      this.tweens.add({
        targets: bonfireLight,
        intensity: { from: 0.65, to: 0.85 },
        radius: { from: 230, to: 255 },
        duration: 300,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Bonfire flame sparks
    this.add.particles(x, y + 10, 'ember_spark', {
      speed: { min: 20, max: 60 },
      angle: { min: 240, max: 300 }, // Upwards
      scale: { start: 1, end: 0.2 },
      alpha: { start: 0.9, end: 0 },
      lifespan: { min: 600, max: 1200 },
      frequency: 60,
    });
  }

  createEmberWeather(width, height) {
    // Ambient floating embers rising across the atmosphere (Souls Cinders)
    this.emberParticles = this.add.particles(0, 0, 'ember_spark', {
      emitZone: {
        source: new Phaser.Geom.Rectangle(0, 0, width, height),
        type: 'random',
      },
      speedY: { min: -40, max: -15 },
      speedX: { min: -10, max: 10 },
      scale: { start: 0.8, end: 0.1 },
      alpha: { start: 0.6, end: 0 },
      lifespan: { min: 2500, max: 4500 },
      frequency: 90,
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

  spawnEnemies(centerX, centerY) {
    // Left colonnade patrol
    const enemy1 = new Enemy(this, centerX - 180, centerY - 200);
    this.enemies.add(enemy1);

    // Right colonnade patrol
    const enemy2 = new Enemy(this, centerX + 180, centerY - 200);
    this.enemies.add(enemy2);

    // Northern sanctuary guard
    const enemy3 = new Enemy(this, centerX, centerY - 380);
    this.enemies.add(enemy3);
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
