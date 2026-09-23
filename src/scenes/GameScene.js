import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import GhostEnemy from '../entities/GhostEnemy.js';
import SoulsHUD from '../ui/SoulsHUD.js';
import level1Data from '../data/SoulsLevel1.json';
import DD2VTTParser from '../utils/DD2VTTParser.js';
import { getMapConfig, MAP_CONFIGS } from '../data/MapConfig.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data) {
    this.currentMapKey = (data && data.mapKey) ? data.mapKey : 'SoulsChapel';
    this.mapConfig = getMapConfig(this.currentMapKey);
    this.spawnOverride = (data && data.spawnX !== undefined && data.spawnY !== undefined)
      ? { x: data.spawnX, y: data.spawnY }
      : null;

    // Retain full player stats across room / map transitions
    this.initialSouls = (data && data.souls !== undefined) ? data.souls : 2450;
    this.initialHealth = (data && data.health !== undefined) ? data.health : 100;
    this.initialMaxHealth = (data && data.maxHealth !== undefined) ? data.maxHealth : 100;
    this.initialStamina = (data && data.stamina !== undefined) ? data.stamina : 100;
    this.initialMaxStamina = (data && data.maxStamina !== undefined) ? data.maxStamina : 100;

    this.floor = data && data.floor ? data.floor : (this.currentMapKey === 'SoulsChapel' ? 1 : 2);
  }

  create() {
    const mapScale = 0.42;
    this.mapScale = mapScale;

    // Parse active map's Universal VTT (.dd2vtt) data
    const vttData = this.cache.json.get(this.mapConfig.vttKey) || this.cache.json.get('SoulsChapel_vtt');
    this.vttParser = vttData ? new DD2VTTParser(vttData, mapScale) : null;

    const worldWidth = this.vttParser
      ? this.vttParser.worldWidth
      : (this.floor === 1 ? Math.round(6750 * mapScale) : 2048);
    const worldHeight = this.vttParser
      ? this.vttParser.worldHeight
      : (this.floor === 1 ? Math.round(4800 * mapScale) : 1536);

    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    // State flags for hatch and room progression
    this.hatchUnlocked = false;
    this.isTransitioning = false;

    // 1. Render Background based on active map
    let bgKey = 'SoulsChapel_bg';
    if (this.mapConfig && this.textures.exists(this.mapConfig.bgKey)) {
      bgKey = this.mapConfig.bgKey;
    } else if (this.textures.exists('SoulsLevel1')) {
      bgKey = 'SoulsLevel1';
    }
    const bg = this.add.image(0, 0, bgKey).setOrigin(0, 0);
    bg.setDisplaySize(worldWidth, worldHeight);
    bg.setDepth(0);

    // 2. Setup Collision Groups
    this.obstacles = this.physics.add.staticGroup();

    // 3. Build Collision Boundaries matching the active floor & DD2VTT walls
    this.buildObstacles(worldWidth, worldHeight);

    // 4. Setup Interactive Door Triggers from DD2VTT portals
    this.setupDoorTriggers();

    // 5. Dynamic Lighting for active room
    this.createLighting();

    // 6. Spawn Ashen One (Player) with preserved stats
    let spawnX, spawnY;
    if (this.spawnOverride) {
      spawnX = this.spawnOverride.x;
      spawnY = this.spawnOverride.y;
    } else if (this.mapConfig && this.mapConfig.defaultSpawn) {
      spawnX = this.mapConfig.defaultSpawn.x;
      spawnY = this.mapConfig.defaultSpawn.y;
    } else {
      spawnX = this.floor === 1 ? Math.round(1550 * mapScale) : 988;
      spawnY = this.floor === 1 ? Math.round(2527 * mapScale) : 200;
    }

    this.player = new Player(this, spawnX, spawnY);
    this.player.souls = this.initialSouls;
    this.player.health = this.initialHealth;
    this.player.maxHealth = this.initialMaxHealth;
    this.player.stamina = this.initialStamina;
    this.player.maxStamina = this.initialMaxStamina;

    // 7. Spawn Enemies
    this.enemies = this.add.group();
    this.knights = this.add.group();
    this.spawnEnemies();

    // 8. Physics Collisions
    this.physics.add.collider(this.player, this.obstacles);
    this.physics.add.collider(this.knights, this.obstacles);
    this.physics.add.collider(this.player, this.enemies);

    // 9. Ambient Floating Cinders / Weather
    this.createEmberWeather(worldWidth, worldHeight);

    // 10. Camera Settings - Smooth Soulsborne Lerp
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setZoom(1.0);
    this.cameras.main.fadeIn(700, 0, 0, 0);

    // 11. HUD System
    this.hud = new SoulsHUD(this);

    // 12. Atmospheric Location Title Display
    if (this.mapConfig) {
      this.displayAreaTitle(this.mapConfig.areaTitle, this.mapConfig.areaSubtitle);
    } else if (this.floor === 1) {
      this.displayAreaTitle('FÖRBANNADE SALEN', 'The Accursed Crypts & Grand Halls - Våning 1');
    } else {
      this.displayAreaTitle('TORTYRKAMMAREN', 'The Torture Chamber - Våning 2');
    }

    // 13. Interaction Key (E)
    this.keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // Handle Window Resize
    this.scale.on('resize', (gameSize) => {
      this.cameras.main.setSize(gameSize.width, gameSize.height);
      if (this.doorPromptContainer) {
        this.doorPromptContainer.setPosition(gameSize.width / 2, gameSize.height - 85);
      }
    });
  }

  setupDoorTriggers() {
    this.doorTriggers = [];
    if (!this.mapConfig || !this.mapConfig.doors || !this.vttParser) return;

    const leftmostDoor = this.vttParser.getLeftmostDoor();

    this.mapConfig.doors.forEach(doorCfg => {
      let doorX = null;
      let doorY = null;
      let doorData = null;

      if (doorCfg.position) {
        doorX = doorCfg.position.x;
        doorY = doorCfg.position.y;
      } else if (doorCfg.match === 'leftmost' && leftmostDoor) {
        doorData = leftmostDoor;
        doorX = doorData.worldX;
        doorY = doorData.worldY;
      } else if (typeof doorCfg.match === 'number' && this.vttParser) {
        doorData = this.vttParser.getDoorByIndex(doorCfg.match);
        if (doorData) {
          doorX = doorData.worldX;
          doorY = doorData.worldY;
        }
      }

      if (doorX === null || doorY === null) return;

      // Ethereal doorway rune glow on the floor
      const rune = this.add.image(doorX, doorY, 'door_rune');
      rune.setDisplaySize(44, 44);
      rune.setAlpha(0.65);
      rune.setDepth(2);
      rune.setBlendMode(Phaser.BlendModes.ADD);

      // Pulsating rune glow animation
      this.tweens.add({
        targets: rune,
        alpha: { from: 0.35, to: 0.9 },
        scale: { from: 0.85, to: 1.15 },
        duration: 1600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // Subtle rising ember particles at the threshold
      const doorParticles = this.add.particles(doorX, doorY, 'ember_spark', {
        speed: { min: 10, max: 28 },
        angle: { min: -120, max: -60 },
        scale: { start: 0.5, end: 0.1 },
        alpha: { start: 0.75, end: 0 },
        tint: 0xffd700,
        lifespan: 800,
        frequency: 200,
        blendMode: 'ADD',
      });
      doorParticles.setDepth(3);

      this.doorTriggers.push({
        x: doorX,
        y: doorY,
        radius: 65,
        config: doorCfg,
        doorData,
        rune,
      });
    });

    this.createDoorPromptUI();
  }

  createDoorPromptUI() {
    const cam = this.cameras.main;
    this.doorPromptContainer = this.add.container(cam.width / 2, cam.height - 85);
    this.doorPromptContainer.setScrollFactor(0);
    this.doorPromptContainer.setDepth(2000);
    this.doorPromptContainer.setVisible(false);

    // Dark parchment / iron backdrop with gold filigree border
    const bg = this.add.graphics();
    bg.fillStyle(0x08060a, 0.88);
    bg.fillRoundedRect(-180, -22, 360, 44, 6);
    bg.lineStyle(1.5, 0xc99e3a, 0.85);
    bg.strokeRoundedRect(-180, -22, 360, 44, 6);

    // Inner gold trim
    bg.lineStyle(0.8, 0x6e5223, 0.6);
    bg.strokeRoundedRect(-176, -18, 352, 36, 4);

    this.doorPromptText = this.add.text(0, 0, '', {
      fontFamily: 'Cinzel, serif',
      fontSize: '15px',
      color: '#f5efe6',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.doorPromptContainer.add([bg, this.doorPromptText]);
  }

  transitionToMap(doorConfig) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    if (this.doorPromptContainer) {
      this.doorPromptContainer.setVisible(false);
    }

    if (this.player && this.player.body) {
      this.player.body.setVelocity(0, 0);
    }

    // Camera fade to black
    this.cameras.main.fade(800, 0, 0, 0, false, (cam, progress) => {
      if (progress === 1) {
        this.scene.restart({
          mapKey: doorConfig.targetMap,
          spawnX: doorConfig.targetSpawn.x,
          spawnY: doorConfig.targetSpawn.y,
          health: this.player.health,
          maxHealth: this.player.maxHealth,
          souls: this.player.souls,
          stamina: this.player.stamina,
          maxStamina: this.player.maxStamina,
        });
      }
    });
  }

  buildObstacles(width, height) {
    // Outer perimeter boundaries (always prevent escaping the map)
    this.createObstacle(width / 2, 8, width, 16); // Top
    this.createObstacle(width / 2, height - 8, width, 16); // Bottom
    this.createObstacle(8, height / 2, 16, height); // Left
    this.createObstacle(width - 8, height / 2, 16, height); // Right

    if (this.vttParser) {
      this.buildWallsFromDD2VTT(this.vttParser, width, height);
    } else {
      this.buildWallsFromLegacyJSON(width, height);
    }
  }

  buildWallsFromDD2VTT(parser, worldWidth, worldHeight) {
    const wallThickness = 16;
    this.collisionSegments = [];

    // 1. Line of Sight (Solid Structural Walls from .dd2vtt)
    const walls = parser.getWalls();
    walls.forEach(seg => {
      this.createSegmentObstacle(seg.x1, seg.y1, seg.x2, seg.y2, wallThickness);
      this.collisionSegments.push({ ...seg, type: 'wall' });
    });

    // 2. Windows (closed: false) block player movement
    const windows = parser.getWindows();
    windows.forEach(w => {
      if (w.bounds && w.bounds.length >= 2) {
        this.createSegmentObstacle(w.bounds[0].x, w.bounds[0].y, w.bounds[1].x, w.bounds[1].y, wallThickness);
        this.collisionSegments.push({
          x1: w.bounds[0].x,
          y1: w.bounds[0].y,
          x2: w.bounds[1].x,
          y2: w.bounds[1].y,
          type: 'window',
        });
      }
    });

    // 3. Stately Stone Pillars and Props for SoulsChapel
    if (this.currentMapKey === 'SoulsChapel') {
      const s = this.mapScale;
      const pillarPositions = [
        { x: 3685, y: 2633 }, { x: 3685, y: 3873 },
        { x: 4307, y: 2632 }, { x: 4357, y: 3873 },
        { x: 5028, y: 2633 }, { x: 5028, y: 3873 },
        { x: 5700, y: 2633 }, { x: 5700, y: 3873 },
        { x: 710, y: 1537 }, { x: 710, y: 2947 },
        { x: 1285, y: 1537 }, { x: 1285, y: 2947 },
      ];
      pillarPositions.forEach(p => {
        this.createObstacle(Math.round(p.x * s), Math.round(p.y * s), 32, 32);
      });

      // Crypt Props: Central Sarcophagus & Altar
      this.createObstacle(Math.round(1550 * s), Math.round(2380 * s), Math.round(140 * s), Math.round(230 * s));
      this.createObstacle(Math.round(1550 * s), Math.round(2530 * s), Math.round(70 * s), Math.round(70 * s));

      // Floor 2 Transition Hatch in upper wooden lodge
      this.hatchObstacle = this.createObstacle(Math.round(5540 * s), Math.round(1050 * s), 60, 60);
    }

    // Setup interactive debug visualizer for collision lines (Toggle with 'C' key)
    this.setupCollisionDebugVisualizer();
  }

  buildWallsFromLegacyJSON(worldWidth, worldHeight) {
    const s = this.mapScale;
    const nonDoors = level1Data.walls.filter(w => w.door !== 1);
    const shortSegs = [];
    const longSegs = [];
    nonDoors.forEach(w => {
      const len = Math.hypot(w.c[2] - w.c[0], w.c[3] - w.c[1]);
      if (len < 80) shortSegs.push(w);
      else longSegs.push(w);
    });

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

    pillars.forEach(p => {
      this.createObstacle(Math.round(p.x * s), Math.round(p.y * s), 32, 32);
    });

    longSegs.forEach(w => {
      this.createSegmentObstacle(w.c[0] * s, w.c[1] * s, w.c[2] * s, w.c[3] * s, 16);
    });

    this.createObstacle(Math.round(1550 * s), Math.round(2380 * s), Math.round(140 * s), Math.round(230 * s));
    this.createObstacle(Math.round(1550 * s), Math.round(2530 * s), Math.round(70 * s), Math.round(70 * s));
    this.hatchObstacle = this.createObstacle(Math.round(5540 * s), Math.round(1050 * s), 60, 60);
  }

  createSegmentObstacle(x1, y1, x2, y2, thickness = 16) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    if (length < 2) return null;

    const isHorizontal = Math.abs(dy) <= Math.abs(dx);
    let cx, cy, w, h;

    if (isHorizontal) {
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      w = maxX - minX + thickness;
      h = thickness;
      cx = (minX + maxX) / 2;
      cy = (y1 + y2) / 2;
    } else {
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      w = thickness;
      h = maxY - minY + thickness;
      cx = (x1 + x2) / 2;
      cy = (minY + maxY) / 2;
    }

    return this.createObstacle(cx, cy, w, h);
  }

  setupCollisionDebugVisualizer() {
    this.collisionDebugGraphics = this.add.graphics().setDepth(999);
    this.showCollisionDebug = false;

    // Toggle collision line overlay with 'C'
    this.input.keyboard.on('keydown-C', () => {
      this.showCollisionDebug = !this.showCollisionDebug;
      this.renderCollisionDebug();
      this.showToast(
        this.showCollisionDebug ? 'Kollisionslinjer: PÅ (Tryck C för att dölja)' : 'Kollisionslinjer: AV',
        this.showCollisionDebug ? '#00ff88' : '#aaaaaa'
      );
    });
  }

  renderCollisionDebug() {
    this.collisionDebugGraphics.clear();
    if (!this.showCollisionDebug || !this.collisionSegments) return;

    this.collisionSegments.forEach(seg => {
      const color = seg.type === 'wall' ? 0x00ff88 : 0x00d4ff;
      this.collisionDebugGraphics.lineStyle(3, color, 0.9);
      this.collisionDebugGraphics.lineBetween(seg.x1, seg.y1, seg.x2, seg.y2);

      // Vertex endpoints
      this.collisionDebugGraphics.fillStyle(0xffff00, 1.0);
      this.collisionDebugGraphics.fillCircle(seg.x1, seg.y1, 4);
      this.collisionDebugGraphics.fillCircle(seg.x2, seg.y2, 4);
    });
  }

  showToast(message, color = '#ffffff') {
    const toast = this.add.text(
      this.cameras.main.width / 2,
      60,
      message,
      {
        fontFamily: 'Cinzel, serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: color,
        stroke: '#000000',
        strokeThickness: 4,
        backgroundColor: '#0a0a0edd',
        padding: { x: 16, y: 8 },
      }
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(2000);

    this.tweens.add({
      targets: toast,
      alpha: { from: 1, to: 0 },
      y: 40,
      delay: 1500,
      duration: 500,
      onComplete: () => toast.destroy(),
    });
  }

  createObstacle(x, y, w, h) {
    const rect = this.add.rectangle(x, y, w, h, 0x000000, 0); // invisible static collision box
    this.physics.add.existing(rect, true);
    this.obstacles.add(rect);
    return rect;
  }

  createFireParticles(x, y, isLarge = false) {
    const flameEmitter = this.add.particles(x, y, 'flame_particle', {
      speedY: { min: isLarge ? -24 : -18, max: isLarge ? -10 : -8 },
      speedX: { min: isLarge ? -5 : -3, max: isLarge ? 5 : 3 },
      scale: { start: isLarge ? 0.65 : 0.48, end: 0.08 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xffffff, 0xfffa65, 0xffbe76, 0xf0932b, 0xff793f, 0xeb4d4b],
      lifespan: { min: 350, max: isLarge ? 650 : 520 },
      frequency: isLarge ? 75 : 95,
      blendMode: 'ADD',
    });
    flameEmitter.setDepth(5);

    if (isLarge) {
      const emberEmitter = this.add.particles(x, y, 'ember_spark', {
        speedY: { min: -28, max: -12 },
        speedX: { min: -7, max: 7 },
        scale: { start: 0.45, end: 0.08 },
        alpha: { start: 0.7, end: 0 },
        lifespan: { min: 450, max: 800 },
        frequency: 110,
        blendMode: 'ADD',
      });
      emberEmitter.setDepth(5);
    }

    return flameEmitter;
  }

  createLighting() {
    const s = this.mapScale;
    const vttData = this.cache.json.get(this.mapConfig ? this.mapConfig.vttKey : 'SoulsChapel_vtt');
    const ppg = (vttData && vttData.resolution && vttData.resolution.pixels_per_grid) || 150;

    if (this.currentMapKey === 'SoulsChapel') {
      // 1. Exact lantern flame positions in Crypt (West)
      const cryptLanterns = [
        { x: 233, y: 641 }, { x: 228, y: 838 }, { x: 237, y: 1038 }, { x: 234, y: 1227 },
        { x: 372, y: 571 }, { x: 564, y: 573 }, { x: 826, y: 572 }, { x: 1025, y: 572 },
        { x: 374, y: 1298 }, { x: 566, y: 1298 }, { x: 830, y: 1298 }, { x: 1154, y: 1298 },
      ];

      cryptLanterns.forEach((cl) => {
        const glow = this.add.image(cl.x, cl.y, 'soft_light_glow');
        glow.setDisplaySize(32, 32);
        glow.setAlpha(0.15);
        glow.setDepth(1);
        glow.setBlendMode(Phaser.BlendModes.ADD);
        this.createFireParticles(cl.x, cl.y, false);
      });

      // 2. Central Bonfire Hearth in Crypt
      const bx = Math.round(1550 * s);
      const by = Math.round(2527 * s);
      const bonfireGlow = this.add.image(bx, by, 'soft_light_glow');
      bonfireGlow.setDisplaySize(44, 44);
      bonfireGlow.setAlpha(0.15);
      bonfireGlow.setDepth(1);
      bonfireGlow.setBlendMode(Phaser.BlendModes.ADD);
      this.createFireParticles(bx, by - 2, true);

      // 3. Torches & fountain in Grand Hall / Lodge
      if (vttData && Array.isArray(vttData.lights)) {
        vttData.lights.forEach(l => {
          if (!l.position) return;
          const lx = Math.round(l.position.x * ppg * s);
          const ly = Math.round(l.position.y * ppg * s);
          if (lx > 1180) {
            const isFountain = Math.hypot(lx - Math.round(4528 * s), ly - Math.round(3217 * s)) < 60;
            if (isFountain) {
              const fountainGlow = this.add.image(lx, ly, 'soft_cyan_glow');
              fountainGlow.setDisplaySize(48, 48);
              fountainGlow.setAlpha(0.15);
              fountainGlow.setDepth(1);
              fountainGlow.setBlendMode(Phaser.BlendModes.ADD);
            } else {
              const glow = this.add.image(lx, ly, 'soft_light_glow');
              glow.setDisplaySize(36, 36);
              glow.setAlpha(0.15);
              glow.setDepth(1);
              glow.setBlendMode(Phaser.BlendModes.ADD);
              this.createFireParticles(lx, ly - 2, false);
            }
          }
        });
      }
    } else if (this.currentMapKey === 'CemeterySouls' || this.currentMapKey === 'SoulsBossRoom1') {
      // Dynamic lights from DD2VTT
      if (vttData && Array.isArray(vttData.lights)) {
        vttData.lights.forEach(l => {
          if (!l.position) return;
          const lx = Math.round(l.position.x * ppg * s);
          const ly = Math.round(l.position.y * ppg * s);
          const glow = this.add.image(lx, ly, 'soft_light_glow');
          glow.setDisplaySize(44, 44);
          glow.setAlpha(0.18);
          glow.setDepth(1);
          glow.setBlendMode(Phaser.BlendModes.ADD);
          this.createFireParticles(lx, ly - 2, false);
        });
      }
    }
  }

  spawnEnemies() {
    // If the level configuration defines an enemy roster, spawn dynamically
    if (this.mapConfig && Array.isArray(this.mapConfig.enemies) && this.mapConfig.enemies.length > 0) {
      this.mapConfig.enemies.forEach(e => {
        if (e.type === 'ghost') {
          const ghost = new GhostEnemy(this, e.x, e.y);
          this.enemies.add(ghost);
        } else {
          const knight = new Enemy(this, e.x, e.y);
          this.knights.add(knight);
          this.enemies.add(knight);
        }
      });
      return;
    }

    const s = this.mapScale;
    if (this.currentMapKey === 'SoulsChapel') {
      // SoulsChapel: 5 Knights, 5 Ghosts distributed across rooms
      const knight1 = new Enemy(this, Math.round(1050 * s), Math.round(2200 * s));
      const knight2 = new Enemy(this, Math.round(2100 * s), Math.round(2000 * s));
      const ghost1 = new GhostEnemy(this, Math.round(800 * s), Math.round(2700 * s));

      const ghost2 = new GhostEnemy(this, Math.round(3050 * s), Math.round(3100 * s));
      const ghost3 = new GhostEnemy(this, Math.round(3200 * s), Math.round(1800 * s));

      const knight3 = new Enemy(this, Math.round(4000 * s), Math.round(3200 * s));
      const knight4 = new Enemy(this, Math.round(5300 * s), Math.round(3200 * s));
      const ghost4 = new GhostEnemy(this, Math.round(4528 * s), Math.round(3217 * s));

      const knight5 = new Enemy(this, Math.round(5500 * s), Math.round(1200 * s));
      const ghost5 = new GhostEnemy(this, Math.round(5850 * s), Math.round(850 * s));

      [knight1, knight2, knight3, knight4, knight5].forEach(k => {
        this.knights.add(k);
        this.enemies.add(k);
      });

      [ghost1, ghost2, ghost3, ghost4, ghost5].forEach(g => {
        this.enemies.add(g);
      });
    } else if (this.currentMapKey === 'CemeterySouls') {
      // Cemetery: Patrolling fallen knights and haunting ghosts among tombstones
      const k1 = new Enemy(this, 950, 750);
      const k2 = new Enemy(this, 1420, 850);
      const k3 = new Enemy(this, 1680, 1350);

      [k1, k2, k3].forEach(k => {
        this.knights.add(k);
        this.enemies.add(k);
      });

      const g1 = new GhostEnemy(this, 750, 550);
      const g2 = new GhostEnemy(this, 1200, 520);
      const g3 = new GhostEnemy(this, 1750, 680);
      const g4 = new GhostEnemy(this, 1500, 1200);
      const g5 = new GhostEnemy(this, 880, 1250);

      [g1, g2, g3, g4, g5].forEach(g => {
        this.enemies.add(g);
      });
    } else if (this.currentMapKey === 'SoulsBossRoom1') {
      // SoulsBossRoom1: Path sentinels and boss throne guardian
      const sentinel1 = new Enemy(this, 1480, 525);
      const sentinel2 = new Enemy(this, 1220, 525);
      const bossGuardian = new Enemy(this, 580, 525);
      const bossGuardian2 = new Enemy(this, 420, 420);

      [sentinel1, sentinel2, bossGuardian, bossGuardian2].forEach(k => {
        this.knights.add(k);
        this.enemies.add(k);
      });

      const throneSpirit1 = new GhostEnemy(this, 420, 620);
      const throneSpirit2 = new GhostEnemy(this, 300, 525);
      const pathSpirit = new GhostEnemy(this, 1350, 420);

      [throneSpirit1, throneSpirit2, pathSpirit].forEach(g => {
        this.enemies.add(g);
      });
    }
  }

  unlockHatch() {
    this.hatchUnlocked = true;

    if (this.hatchObstacle) {
      this.hatchObstacle.destroy();
      this.hatchObstacle = null;
    }

    const hatchX = this.floor === 1 ? Math.round(5540 * this.mapScale) : 75;
    const hatchY = this.floor === 1 ? Math.round(1050 * this.mapScale) : 715;
    const openHatch = this.add.sprite(hatchX, hatchY, 'open_hatch');
    openHatch.setOrigin(0.5, 0.5);
    openHatch.setDepth(20);

    const hatchLight = this.add.image(hatchX + 10, hatchY, 'soft_light_glow');
    hatchLight.setDisplaySize(70, 70);
    hatchLight.setAlpha(0.15);
    hatchLight.setDepth(1);
    hatchLight.setBlendMode(Phaser.BlendModes.ADD);

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

    this.displayRoomClearedBanner();

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

    const subTitleText = 'Luckan i det norra rummet har öppnats — Stig ned i djupet';

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

    const mainTitleText = this.currentMapKey === 'SoulsBossRoom1'
      ? 'TRONSALEN RENAD — SEGER'
      : 'KYRKOGÅRDEN RENAD — SEGER';
    const subTitleText = this.currentMapKey === 'SoulsBossRoom1'
      ? 'Förfädrens tronsal har befriats från mörkret'
      : 'Samtliga fasor bland gravarna har fördrivits';

    const mainTitle = this.add.text(0, -6, mainTitleText, {
      fontFamily: 'Cinzel, serif',
      fontSize: '28px',
      fontStyle: 'bold',
      letterSpacing: 6,
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    const subTitle = this.add.text(0, 20, subTitleText, {
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

    this.cameras.main.fade(800, 0, 0, 0, false, (cam, progress) => {
      if (progress === 1) {
        this.scene.restart({
          floor: 2,
          souls: this.player.souls,
          health: this.player.health,
          maxHealth: this.player.maxHealth,
          stamina: this.player.stamina,
          maxStamina: this.player.maxStamina,
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

      // Check door proximity & handle [E] key interaction
      if (!this.isTransitioning && this.doorTriggers && this.doorTriggers.length > 0) {
        let nearDoor = null;
        for (const dt of this.doorTriggers) {
          const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, dt.x, dt.y);
          if (dist <= dt.radius) {
            nearDoor = dt;
            break;
          }
        }

        if (nearDoor) {
          if (!this.doorPromptContainer.visible) {
            this.doorPromptContainer.setVisible(true);
            this.doorPromptText.setText(nearDoor.config.prompt || 'Öppna dörren [E]');
          }
          if (Phaser.Input.Keyboard.JustDown(this.keyE)) {
            this.transitionToMap(nearDoor.config);
          }
        } else {
          if (this.doorPromptContainer && this.doorPromptContainer.visible) {
            this.doorPromptContainer.setVisible(false);
          }
        }
      }

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
              const hammerDamage = 45;
              enemy.takeDamage(hammerDamage, this.player.x, this.player.y);
            }
          }
        });
      }

      // Check room cleared condition
      if (!this.hatchUnlocked && this.enemies.countActive(true) === 0) {
        if (this.currentMapKey === 'SoulsChapel') {
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
