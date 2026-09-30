import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import GhostEnemy from '../entities/GhostEnemy.js';
import SkeletonEnemy from '../entities/SkeletonEnemy.js';
import BossEnemy from '../entities/BossEnemy.js';
import ChickenNPC from '../entities/ChickenNPC.js';
import CatNPC from '../entities/CatNPC.js';
import GravekeeperNPC from '../entities/GravekeeperNPC.js';
import SoulsHUD from '../ui/SoulsHUD.js';
import level1Data from '../data/SoulsLevel1.json';
import DD2VTTParser from '../utils/DD2VTTParser.js';
import { getMapConfig, MAP_CONFIGS } from '../data/MapConfig.js';
import CollisionManager from '../utils/CollisionManager.js';
import { MAP_OBSTACLES, obstacles as defaultObstacles } from '../data/obstacles.js';
import audioManager from '../utils/AudioManager.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data) {
    let defaultMap = 'SoulsChapel';
    if (typeof window !== 'undefined' && window.location) {
      const urlParams = new URLSearchParams(window.location.search);
      const urlMap = urlParams.get('map');
      if (urlMap && (MAP_CONFIGS[urlMap] || MAP_OBSTACLES[urlMap])) {
        defaultMap = urlMap;
      }
    }

    this.currentMapKey = (data && data.mapKey) ? data.mapKey : defaultMap;
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
    this.initialFlaskCharges = (data && data.flaskCharges !== undefined) ? data.flaskCharges : 3;

    this.floor = data && data.floor ? data.floor : (this.currentMapKey === 'SoulsChapel' ? 1 : 2);
    this.monstersActive = (data && data.monstersActive !== undefined) ? data.monstersActive : true;

    // Spellägen (gameState): 'MENU', 'PLAYING', 'GAME_OVER' - Spelet startar i läget 'MENU'
    this.gameState = (data && data.gameState) ? data.gameState : 'MENU';

    // Global master-volym för spelet (0.0 till 1.0 / 0 till 100%) - hämtas från localStorage om sparad (standard 80%)
    let savedVol = null;
    try {
      if (typeof localStorage !== 'undefined') {
        savedVol = localStorage.getItem('souls_game_volume');
      }
    } catch (e) {}
    this.gameVolume = savedVol !== null ? Phaser.Math.Clamp(parseFloat(savedVol), 0, 1) : 0.80;
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

    // State flags for hatch, transitions, and player death
    this.hatchUnlocked = false;
    this.isTransitioning = false;
    this.isPlayerDead = false;

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
    // Dim background layer by ~20% so foreground characters and visual effects pop with clear contrast
    bg.setTint(0xc4c4c4);

    // 2. Setup Collision Groups
    this.obstacles = this.physics.add.staticGroup();

    // 2b. Setup AABB Collision Manager (Datalista med rektangulära hinder, axelseparation, debugColliders & editor)
    const activeMapObstacles = (MAP_OBSTACLES && MAP_OBSTACLES[this.currentMapKey])
      ? MAP_OBSTACLES[this.currentMapKey]
      : defaultObstacles;
    this.collisionManager = new CollisionManager(this, activeMapObstacles, {
      x: 0,
      y: 0,
      width: worldWidth,
      height: worldHeight,
    });

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

    this.defaultSpawn = { x: spawnX, y: spawnY };
    this.player = new Player(this, spawnX, spawnY);
    this.player.souls = this.initialSouls;
    this.player.health = this.initialHealth;
    this.player.maxHealth = this.initialMaxHealth;
    this.player.stamina = this.initialStamina;
    this.player.maxStamina = this.initialMaxStamina;
    this.player.flaskCharges = this.initialFlaskCharges;

    // 7. Spawn Enemies & Neutral NPCs
    this.enemies = this.add.group();
    this.knights = this.add.group();
    this.enemyProjectiles = this.physics.add.group({ runChildUpdate: true });
    delete this.enemyProjectiles.defaults.setVelocityX;
    delete this.enemyProjectiles.defaults.setVelocityY;
    this.slashes = this.add.group({ runChildUpdate: true });
    this.spawnEnemies();
    this.spawnChickens();
    this.spawnNPCs();
    this.spawnChests();

    // Globala kontroller och snabbtangenter för att deaktivera/aktivera monster
    window.gameScene = this;
    window.toggleMonsters = () => this.toggleMonsters();
    window.disableMonsters = () => this.setMonstersActive(false);
    window.enableMonsters = () => this.setMonstersActive(true);

    if (!this.monstersActive) {
      this.setMonstersActive(false);
    }

    // Tangent [M] för att slå av/på monster
    this.input.keyboard.on('keydown-M', () => {
      this.toggleMonsters();
    });

    // Tangent [N] för att slå av/på bakgrundsmusik
    this.input.keyboard.on('keydown-N', () => {
      const isPlaying = audioManager.toggleMute();
      console.log(`[Audio] Bakgrundsmusik: ${isPlaying ? 'PÅ' : 'AV'}`);
    });

    // Bakgrundsmusik startas/fortsätter (anpassas automatiskt efter rum, t.ex. bossmusik i SoulsBossRoom1)
    audioManager.init(this, this.currentMapKey);

    // Applicera sparad mastervolym för ljud och musik
    this.setGameVolume(this.gameVolume);

    // Snabbväxling mellan kartor med siffrorna 1, 2, 3
    window.loadMap = (mapKey) => this.switchMap(mapKey);
    this.input.keyboard.on('keydown-ONE', () => this.switchMap('SoulsChapel'));
    this.input.keyboard.on('keydown-TWO', () => this.switchMap('CemeterySouls'));
    this.input.keyboard.on('keydown-THREE', () => this.switchMap('SoulsBossRoom1'));

    // 8. Physics Collisions
    this.physics.add.collider(this.player, this.obstacles);
    this.physics.add.collider(this.knights, this.obstacles);
    this.physics.add.collider(this.chickens, this.obstacles);
    this.physics.add.collider(this.player, this.enemies);
    this.physics.add.collider(this.enemyProjectiles, this.obstacles, (arrow) => {
      if (arrow && arrow.onHitObstacle) arrow.onHitObstacle();
    });
    this.physics.add.overlap(this.enemyProjectiles, this.player, (arrow, player) => {
      if (this.gameState !== 'PLAYING') return;
      if (arrow && arrow.onHitPlayer) arrow.onHitPlayer(player);
    });
    this.physics.add.overlap(this.enemyProjectiles, this.chickens, (arrow, chicken) => {
      if (this.gameState !== 'PLAYING') return;
      if (chicken && chicken.state !== 'DEAD') {
        chicken.takeDamage(1, arrow.x, arrow.y);
        if (arrow.onHitObstacle) arrow.onHitObstacle();
      }
    });

    // 9. Ambient Floating Cinders / Weather
    this.createEmberWeather(worldWidth, worldHeight);

    // 10. Camera Settings - Smooth Soulsborne Lerp
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setZoom(1.0);
    this.cameras.main.fadeIn(700, 0, 0, 0);

    // 11. HUD System
    this.hud = new SoulsHUD(this);
    if (this.gameState === 'MENU') {
      this.hud.setVisible(false);
    }

    // 12. Atmospheric Location Title Display (visas endast i spelläge PLAYING)
    if (this.gameState === 'PLAYING') {
      if (this.mapConfig) {
        this.displayAreaTitle(this.mapConfig.areaTitle, this.mapConfig.areaSubtitle);
      } else if (this.floor === 1) {
        this.displayAreaTitle('FÖRBANNADE SALEN', 'The Accursed Crypts & Grand Halls - Våning 1');
      } else {
        this.displayAreaTitle('TORTYRKAMMAREN', 'The Torture Chamber - Våning 2');
      }
    }

    // 13. Startskärm (Titelmeny)
    if (this.gameState === 'MENU') {
      this.createTitleMenu();
    }

    // 14. Interaction Key (E)
    this.keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // 15. Paus-tangent (ESC) för att öppna/stänga paus-menyn
    this.keyESC = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyESC.on('down', () => {
      this.togglePause();
    });

    // Handle Window Resize
    this.scale.on('resize', (gameSize) => {
      this.cameras.main.setSize(gameSize.width, gameSize.height);
      if (this.doorPromptContainer) {
        this.doorPromptContainer.setPosition(gameSize.width / 2, gameSize.height - 85);
      }
      if (this.audioSettingsContainer) {
        this.openAudioSettings(this.audioSettingsFrom || 'MENU');
      } else if (this.gameState === 'MENU' && this.titleMenuContainer) {
        this.createTitleMenu();
      } else if (this.gameState === 'PAUSED' && this.pauseMenuContainer) {
        this.createPauseMenu();
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
          flaskCharges: this.player.flaskCharges,
          monstersActive: this.monstersActive,
          gameState: 'PLAYING',
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
        } else if (e.type === 'skeleton') {
          const skeleton = new SkeletonEnemy(this, e.x, e.y);
          this.enemies.add(skeleton);
        } else if (e.type === 'boss') {
          const boss = new BossEnemy(this, e.x, e.y);
          this.enemies.add(boss);
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

      const s1 = new SkeletonEnemy(this, 1350, 680);
      const s2 = new SkeletonEnemy(this, 1050, 1100);
      const s3 = new SkeletonEnemy(this, 1620, 1050);
      const s4 = new SkeletonEnemy(this, 820, 920);

      [s1, s2, s3, s4].forEach(s => {
        this.enemies.add(s);
      });
    } else if (this.currentMapKey === 'SoulsBossRoom1') {
      // SoulsBossRoom1: Vålnadens Drottning at the chest - the sole boss of this realm
      const boss = new BossEnemy(this, 310, 515);
      this.enemies.add(boss);
    }
  }

  spawnChickens() {
    this.chickens = this.physics.add.group();

    // Random count between 1 and 3 (max 3 chickens per map)
    const chickenCount = Phaser.Math.Between(1, 3);

    let candidates = [];
    if (this.mapConfig && Array.isArray(this.mapConfig.chickenSpawns) && this.mapConfig.chickenSpawns.length > 0) {
      candidates = [...this.mapConfig.chickenSpawns];
    } else {
      const center = (this.mapConfig && this.mapConfig.defaultSpawn) ? this.mapConfig.defaultSpawn : { x: 500, y: 500 };
      for (let i = 0; i < 4; i++) {
        candidates.push({
          x: center.x + Phaser.Math.Between(-100, 100),
          y: center.y + Phaser.Math.Between(-100, 100),
        });
      }
    }

    Phaser.Utils.Array.Shuffle(candidates);

    const countToSpawn = Math.min(chickenCount, candidates.length);
    for (let i = 0; i < countToSpawn; i++) {
      const spot = candidates[i];
      const jx = spot.x + Phaser.Math.Between(-20, 20);
      const jy = spot.y + Phaser.Math.Between(-20, 20);
      const chicken = new ChickenNPC(this, jx, jy);
      this.chickens.add(chicken);
    }
  }

  spawnNPCs() {
    this.catPumba = null;
    this.gregGravekeeper = null;

    // 1. Katten PUMBA i SoulsBossRoom1 på koordinaterna x: 1244, y: 1040, storlek: 40x38
    if (this.currentMapKey === 'SoulsBossRoom1') {
      this.catPumba = new CatNPC(this, 1244, 1040, 40, 38);
      this.physics.add.collider(this.player, this.catPumba);
      if (this.chickens) {
        this.physics.add.collider(this.chickens, this.catPumba);
      }
      if (this.enemies) {
        this.physics.add.collider(this.enemies, this.catPumba);
      }
    }

    // 2. GREG THE GRAVEKEEPER på CemeterySouls (x: 522, y: 732, storlek: 80x55)
    if (this.currentMapKey === 'CemeterySouls') {
      const npcCfg = (this.mapConfig && this.mapConfig.npcs)
        ? this.mapConfig.npcs.find(n => n.type === 'gravekeeper' || (n.name && n.name.includes('GREG')))
        : null;
      const gx = npcCfg ? npcCfg.x : 522;
      const gy = npcCfg ? npcCfg.y : 732;
      const gw = npcCfg ? npcCfg.width : 80;
      const gh = npcCfg ? npcCfg.height : 55;
      const gname = npcCfg ? npcCfg.name : 'GREG THE GRAVEKEEPER';

      this.gregGravekeeper = new GravekeeperNPC(this, gx, gy, gw, gh, gname);
      this.physics.add.collider(this.player, this.gregGravekeeper);
      if (this.chickens) {
        this.physics.add.collider(this.chickens, this.gregGravekeeper);
      }
      if (this.enemies) {
        this.physics.add.collider(this.enemies, this.gregGravekeeper);
      }
      if (this.enemyProjectiles) {
        this.physics.add.collider(this.enemyProjectiles, this.gregGravekeeper, (arrow) => {
          if (arrow && arrow.onHitObstacle) arrow.onHitObstacle();
        });
      }
    }

    window.greg = this.gregGravekeeper;
  }

  spawnChests() {
    this.chests = [];
    const chestList = (this.mapConfig && this.mapConfig.chests)
      ? this.mapConfig.chests
      : (this.currentMapKey === 'CemeterySouls' ? [{ x: 744, y: 384, width: 48, height: 31, name: 'Förbannad Kista' }] : []);

    chestList.forEach(cfg => {
      this.createChest(cfg);
    });

    // Global hjälpfunktion för snabbtestning
    window.spawnChest = (x, y, w, h) => this.createChest({ x, y, width: w, height: h });
  }

  createChest(cfg) {
    const x = cfg.x;
    const y = cfg.y;
    const w = cfg.width;
    const h = cfg.height;
    const cx = x + w / 2;
    const cy = y + h / 2;

    // 1. Mjuk markskugga under kistan för jordad placering
    const shadow = this.add.ellipse(cx, y + h - 2, w * 0.92, 10, 0x000000, 0.45);
    shadow.setDepth(Math.max(1, y + h - 6));

    // 1b. Mjukt vitt bakomliggande sken som lyfter fram kistans konturer mot den mörka stenväggen
    const backingGlow = this.add.ellipse(cx, cy, w + 6, h + 6, 0xffffff, 0.22);
    backingGlow.setDepth(Math.max(1, y + h - 2));
    backingGlow.setBlendMode(Phaser.BlendModes.ADD);

    // 2. Kist-sprite
    const sprite = this.add.image(cx, cy, 'treasure_chest');
    sprite.setDisplaySize(w, h);
    sprite.setOrigin(0.5, 0.5);
    sprite.setDepth(y + h);

    // Bas-alpha 0.85 och balanserad nyans
    sprite.setAlpha(0.85);
    sprite.setTint(0x9c9ca6);

    // Vitt glöd runtom kistans kanter (PreFX / PostFX GPU-shader)
    if (sprite.preFX) {
      sprite.glowFX = sprite.preFX.addGlow(0xffffff, 2.2, 0, false, 0.2, 6);
    } else if (sprite.postFX) {
      sprite.glowFX = sprite.postFX.addGlow(0xffffff, 2.2, 0, false, 0.2, 6);
    }

    // 3. Fysisk kollisionsruta
    const collider = this.createObstacle(cx, cy, w, h);

    const chestObj = {
      cfg,
      cx,
      cy,
      w,
      h,
      sprite,
      shadow,
      backingGlow,
      collider,
      isOpened: false,
    };

    this.chests.push(chestObj);
    return chestObj;
  }

  openChest(chest) {
    if (!chest || chest.isOpened) return;
    chest.isOpened = true;

    // Belöning i själar
    const reward = 500;
    if (this.player) {
      this.player.addSouls(reward);
      if (typeof this.player.showFloatingText === 'function') {
        this.player.showFloatingText(`+${reward} Själar!`, 0xffd700);
      }
    }

    // Visuell guldeffekt / gnistor vid öppning
    const flash = this.add.circle(chest.cx, chest.cy, 52, 0xffd700, 0.9);
    flash.setScale(0.42);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    flash.setDepth(chest.sprite.depth + 1);
    this.tweens.add({
      targets: flash,
      scaleX: 1.0,
      scaleY: 1.0,
      alpha: 0,
      duration: 650,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });

    // Ljud & stämningsmeddelande
    if (this.sound && this.cache.audio.exists('flask_drink')) {
      this.sound.play('flask_drink', { volume: 0.65, rate: 1.35 });
    }
    this.showToast('Gammal kista öppnad! Du fann 500 själar.', '#ffd700');
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
          flaskCharges: this.player.flaskCharges,
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

  handlePlayerDeath() {
    if (this.isPlayerDead) return;
    this.isPlayerDead = true;
    this.gameState = 'GAME_OVER';

    if (this.doorPromptContainer) {
      this.doorPromptContainer.setVisible(false);
    }

    if (this.player) {
      this.player.isDead = true;
      if (this.player.body) {
        this.player.body.setVelocity(0, 0);
      }
      if (this.player.hammer) {
        this.player.hammer.setVisible(false);
      }
      this.player.play('player_death', true);
    }

    // Play visceral impact sound if loaded
    try {
      if (this.sound && this.sound.get('blood_splat')) {
        this.sound.play('blood_splat', { volume: 0.8 });
      }
    } catch (e) {}

    // Subtle dramatic camera zoom on the fallen player
    this.cameras.main.zoomTo(1.15, 3000, 'Sine.easeOut');

    // Wait for player collapse animation to complete, then show the iconic YOU SUCK banner
    this.time.delayedCall(800, () => {
      this.displayYouSuckBanner();
    });
  }

  displayYouSuckBanner() {
    const cam = this.cameras.main;

    // Fullscreen UI container fixed to camera
    const container = this.add.container(cam.width / 2, cam.height / 2);
    container.setScrollFactor(0);
    container.setDepth(5000);
    container.setAlpha(0);

    // Dark atmospheric vignette overlay across the screen
    const dimOverlay = this.add.graphics();
    dimOverlay.fillStyle(0x060102, 0.68);
    dimOverlay.fillRect(-cam.width / 2, -cam.height / 2, cam.width, cam.height);

    // Classic Dark Souls horizontal black banner
    const bannerHeight = 130;
    const bannerGfx = this.add.graphics();
    bannerGfx.fillStyle(0x020001, 0.92);
    bannerGfx.fillRect(-cam.width / 2, -bannerHeight / 2, cam.width, bannerHeight);

    // Glowing blood-red border lines
    bannerGfx.lineStyle(2.5, 0x9b1118, 0.95);
    bannerGfx.strokeLineShape(new Phaser.Geom.Line(-cam.width / 2, -bannerHeight / 2, cam.width / 2, -bannerHeight / 2));
    bannerGfx.strokeLineShape(new Phaser.Geom.Line(-cam.width / 2, bannerHeight / 2, cam.width / 2, bannerHeight / 2));

    // Subtle dark red inner pinstripe
    bannerGfx.lineStyle(1, 0x4e0509, 0.7);
    bannerGfx.strokeLineShape(new Phaser.Geom.Line(-cam.width / 2, -bannerHeight / 2 + 5, cam.width / 2, -bannerHeight / 2 + 5));
    bannerGfx.strokeLineShape(new Phaser.Geom.Line(-cam.width / 2, bannerHeight / 2 - 5, cam.width / 2, bannerHeight / 2 - 5));

    // "YOU SUCK" in iconic Dark Souls typography with ominous deep red color
    const deathText = this.add.text(0, 0, 'YOU SUCK', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '66px',
      fontStyle: 'bold',
      letterSpacing: 14,
      color: '#cf1823',
      stroke: '#220003',
      strokeThickness: 8,
      shadow: {
        offsetX: 0,
        offsetY: 6,
        color: '#4a0408',
        blur: 24,
        stroke: true,
        fill: true,
      },
    }).setOrigin(0.5);

    container.add([dimOverlay, bannerGfx, deathText]);

    // Dramatic creeping scale and slow fade in (authentic Soulsborne text pacing)
    container.setScale(0.90);
    this.tweens.add({
      targets: container,
      alpha: 1,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 2500,
      ease: 'Cubic.easeOut',
    });

    // Hold the banner on screen, then fade to black and respawn at the start of the map
    this.time.delayedCall(2800, () => {
      this.cameras.main.fade(1000, 0, 0, 0, false, (camera, progress) => {
        if (progress === 1) {
          // Respawn at beginning of the current map
          this.scene.restart({
            mapKey: this.currentMapKey,
            souls: this.player ? this.player.souls : 2450,
            health: 100,
            maxHealth: 100,
            stamina: 100,
            maxStamina: 100,
            flaskCharges: 3,
            monstersActive: this.monstersActive,
            gameState: 'PLAYING',
          });
        }
      });
    });
  }

  update(time, delta) {
    // Pausa hela spellopen om vi är i startskärmen eller i pausmenyn
    if (this.gameState === 'MENU' || this.gameState === 'PAUSED') {
      if (this.player && this.player.body) {
        this.player.body.setVelocity(0, 0);
        this.player.vx = 0;
        this.player.vy = 0;
      }
      return;
    }

    if (this.player) {
      if (this.player.health <= 0 && !this.isPlayerDead) {
        this.handlePlayerDeath();
      }

      // 1. Spelarens uppdatering: Här körs dx/dy beräkning & AABB-kollisionskoll innan positionen ändras
      if (!this.isTransitioning && !this.isPlayerDead) {
        this.player.update(time, delta);
      }
      this.player.setDepth(this.player.y + 10);

      // 2. Debug-rendering av AABB-kollisionsrutor (Ritas som halvgenomskinliga röda rektanglar vid debugColliders = true)
      if (this.collisionManager) {
        this.collisionManager.renderDebug(this.player);
      }

      // Check door & chest proximity & handle [E] key interaction
      let activePromptText = null;
      let activePromptAction = null;

      if (!this.isTransitioning && !this.isPlayerDead) {
        // 1. Dörrar
        if (this.doorTriggers && this.doorTriggers.length > 0) {
          for (const dt of this.doorTriggers) {
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, dt.x, dt.y);
            if (dist <= dt.radius) {
              activePromptText = dt.config.prompt || 'Öppna dörren [E]';
              activePromptAction = () => this.transitionToMap(dt.config);
              break;
            }
          }
        }

        // 2. Kistor (subtil dynamisk lyktbelysning & öppning)
        if (this.chests && this.chests.length > 0) {
          for (const chest of this.chests) {
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, chest.cx, chest.cy);

            // Subtil dynamisk belysning: När spelaren närmar sig med lyktan lättar skuggorna försiktigt
            if (dist < 130) {
              const factor = 1 - (dist / 130);
              chest.sprite.setAlpha(0.85 + factor * 0.12);
              const r = Math.round(0x9c + factor * (0xfa - 0x9c));
              const g = Math.round(0x9c + factor * (0xf0 - 0x9c));
              const b = Math.round(0xa6 + factor * (0xe0 - 0xa6));
              chest.sprite.setTint((r << 16) | (g << 8) | b);
              if (chest.backingGlow) chest.backingGlow.setAlpha(0.22 + factor * 0.16);
            } else {
              chest.sprite.setAlpha(0.85);
              chest.sprite.setTint(0x9c9ca6);
              if (chest.backingGlow) chest.backingGlow.setAlpha(0.22);
            }

            if (!activePromptText && dist <= 48 && !chest.isOpened) {
              activePromptText = 'Öppna kistan [E]';
              activePromptAction = () => this.openChest(chest);
            }
          }
        }
      }

      if (activePromptText) {
        if (!this.doorPromptContainer.visible) {
          this.doorPromptContainer.setVisible(true);
        }
        this.doorPromptText.setText(activePromptText);
        if (Phaser.Input.Keyboard.JustDown(this.keyE) && activePromptAction) {
          activePromptAction();
        }
      } else {
        if (this.doorPromptContainer && this.doorPromptContainer.visible) {
          this.doorPromptContainer.setVisible(false);
        }
      }

      // Update all active enemies if monsters are enabled
      if (this.monstersActive) {
        this.enemies.getChildren().forEach(enemy => {
          enemy.update(time, delta, this.player);
        });
      }

      // Update all active chickens
      if (this.chickens) {
        this.chickens.getChildren().forEach(chicken => {
          chicken.update(time, delta);
        });
      }

      // Update Katten PUMBA om katten finns
      if (this.catPumba && this.catPumba.active) {
        this.catPumba.update(time, delta);
      }

      // Update GREG THE GRAVEKEEPER om han finns
      if (this.gregGravekeeper && this.gregGravekeeper.active) {
        this.gregGravekeeper.update(time, delta);
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

  /**
   * Hitstop: Fryser fysikvärlden under en mikropaus (30-50 ms) för 'juicy' träffkänsla
   * @param {number} duration Millisekunder att pausa fysiken
   */
  triggerHitstop(duration = 40) {
    if (this.isHitstopping) return;
    this.isHitstopping = true;

    if (this.physics && this.physics.world) {
      this.physics.world.isPaused = true;
    }

    setTimeout(() => {
      if (this.physics && this.physics.world) {
        this.physics.world.isPaused = false;
      }
      this.isHitstopping = false;
    }, duration);
  }


  /**
   * Aktiverar eller deaktiverar alla monster på kartan.
   * Vid deaktivering pausas deras AI, animationer och fysikkroppar så att de blir ofarliga.
   *
   * @param {boolean} active
   */
  setMonstersActive(active) {
    this.monstersActive = active;

    this.enemies.getChildren().forEach(enemy => {
      if (enemy.state === 'DEAD') return;

      if (!active) {
        // 1. Stanna rörelse och inaktivera kollisionsskada mot spelaren
        if (enemy.body) {
          enemy.body.setVelocity(0, 0);
          enemy.body.enable = false;
        }

        // 2. Rensa pågående telegraferingsgrafik och HP-mätare
        if (enemy.telegraphGraphics) enemy.telegraphGraphics.clear();
        if (enemy.hpBarGraphics) enemy.hpBarGraphics.clear();
        if (enemy.bowTelegraphLine) enemy.bowTelegraphLine.clear();

        // 3. Pausa animationer och sätt halvgenomskinlighet som visuell signal
        if (enemy.anims) enemy.anims.pause();
        enemy.setAlpha(0.32);

        // 4. Släck eventuell aura under monstret
        if (enemy.lightSource) enemy.lightSource.setVisible(false);
      } else {
        // Återaktivera monstret till normalläge
        if (enemy.body) {
          enemy.body.enable = true;
        }
        if (enemy.anims) enemy.anims.resume();
        enemy.setAlpha(1.0);
        if (enemy.lightSource) enemy.lightSource.setVisible(true);
      }
    });

    // Rensa eventuella flygande fiendeprojektiler (t.ex. pilar) om monstren deaktiveras
    if (!active && this.enemyProjectiles) {
      this.enemyProjectiles.clear(true, true);
    }

    const msg = this.monstersActive
      ? '👾 Monster: AKTIVERADE'
      : '💤 Monster: DEAKTIVERADE (Pausade & ofarliga)';
    const color = this.monstersActive ? '#4ade80' : '#ffa502';
    this.showToast(msg, color);

    // Uppdatera informationen i debug-rutan om CollisionManager finns
    if (this.collisionManager && typeof this.collisionManager.updateUILabel === 'function') {
      this.collisionManager.updateUILabel();
    }
  }

  /**
   * Växlar monstrens status mellan aktiverad och deaktiverad.
   */
  toggleMonsters() {
    this.setMonstersActive(!this.monstersActive);
  }

  /**
   * Byter direkt till en annan karta (t.ex. SoulsBossRoom1) för snabb testning.
   * @param {string} mapKey
   */
  switchMap(mapKey) {
    if (this.currentMapKey === mapKey) return;
    const cfg = getMapConfig(mapKey);
    const spawn = cfg && cfg.defaultSpawn ? cfg.defaultSpawn : { x: 300, y: 300 };
    this.scene.restart({
      mapKey,
      spawnX: spawn.x,
      spawnY: spawn.y,
      health: this.player ? this.player.health : 100,
      maxHealth: this.player ? this.player.maxHealth : 100,
      souls: this.player ? this.player.souls : 2450,
      stamina: this.player ? this.player.stamina : 100,
      maxStamina: this.player ? this.player.maxStamina : 100,
      flaskCharges: this.player ? this.player.flaskCharges : 3,
      monstersActive: this.monstersActive,
      gameState: this.gameState,
    });
  }

  /**
   * Skapar en stämningsfull startskärm (titelmeny) när gameState === "MENU"
   */
  createTitleMenu() {
    if (this.titleMenuContainer) {
      this.titleMenuContainer.destroy();
      this.titleMenuContainer = null;
    }

    const cam = this.cameras.main;
    const width = cam.width;
    const height = cam.height;

    const container = this.add.container(0, 0);
    container.setScrollFactor(0);
    container.setDepth(15000);
    this.titleMenuContainer = container;

    // 1. HELT SVART BAKGRUND (Dark Souls 3-stil: 100% solid kolsvart avgrund)
    const bgOverlay = this.add.graphics();
    bgOverlay.fillStyle(0x000000, 1.0);
    bgOverlay.fillRect(0, 0, width, height);
    container.add(bgOverlay);

    // 2. Levande glödande aska som långsamt stiger upp i mörkret (Dark Souls 3 Kiln Cinders)
    const emberEmitter = this.add.particles(width / 2, height + 15, 'ember_spark', {
      x: { min: -width / 2, max: width / 2 },
      speedY: { min: -52, max: -18 },
      speedX: { min: -14, max: 14 },
      scale: { start: 0.52, end: 0.08 },
      alpha: { start: 0.8, end: 0 },
      tint: [0xffffff, 0xffbe76, 0xf0932b, 0xff793f, 0xeb4d4b],
      lifespan: { min: 2800, max: 5000 },
      frequency: 110,
      blendMode: 'ADD',
    });
    container.add(emberEmitter);

    // 3. Proportioner för spelets titel 'Tribute to Insanity' (Täcker majoriteten av skärmen)
    const targetW = Math.min(width * 0.90, 980);
    const targetH = Math.min(height * 0.72, 740);
    const baseSize = Math.min(targetW, targetH * 1.15);
    const logoW = Math.min(width * 0.88, Math.round(baseSize * 1.10));
    const logoH = Math.round(baseSize);

    const glowY = Math.round(height * 0.38);

    // Subtil glöd från ugnen/elden bakom logotypen (stillastående)
    const auraGlow = this.add.graphics();
    auraGlow.fillStyle(0x7f1d1d, 0.22);
    auraGlow.fillCircle(width / 2, glowY, logoH * 0.44);
    auraGlow.fillStyle(0xd97706, 0.12);
    auraGlow.fillCircle(width / 2, glowY, logoH * 0.28);
    container.add(auraGlow);

    // Stor dominant logotyp / titel 'Tribute to Insanity' (helt stillastående)
    let logoElem;
    if (this.textures.exists('title_logo')) {
      const logo = this.add.image(width / 2, glowY, 'title_logo');
      logo.setDisplaySize(logoW, logoH);
      logoElem = logo;
      container.add(logo);
    } else {
      const titleText = this.add.text(width / 2, glowY, 'TRIBUTE TO INSANITY', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '56px',
        fontStyle: 'bold',
        color: '#e2ecf4',
        stroke: '#000000',
        strokeThickness: 10,
        letterSpacing: 10,
      }).setOrigin(0.5);
      logoElem = titleText;
      container.add(titleText);
    }

    // 4. Ikonisk Dark Souls 3 horisontell avdelarlinje
    const divY = glowY + logoH / 2 + 10;
    const divW = Math.min(width * 0.55, 520);
    const dividerGfx = this.add.graphics();
    dividerGfx.lineStyle(1.5, 0x8c7853, 0.75);
    dividerGfx.strokeLineShape(new Phaser.Geom.Line(width / 2 - divW / 2, divY, width / 2 + divW / 2, divY));
    dividerGfx.fillStyle(0xd4af37, 0.95);
    dividerGfx.fillCircle(width / 2, divY, 3.5);
    container.add(dividerGfx);

    // Gotisk subtitel
    const subtitleY = divY + 22;
    const subtitle = this.add.text(width / 2, subtitleY, '— A DARK FANTASY SOULSBORNE ODYSSEY —', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '12px',
      fontStyle: 'bold',
      letterSpacing: 7,
      color: '#9c8f7d',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    container.add(subtitle);

    // 5. Dark Souls 3 meny-knappar: NEW GAME och AUDIO
    const menuCenterY = Math.min(height - 120, Math.max(subtitleY + 65, Math.round(height * 0.74)));
    const btnGap = 56;
    const newGameY = menuCenterY - btnGap / 2;
    const audioBtnY = menuCenterY + btnGap / 2;

    this.createMenuButton(
      container,
      width / 2,
      newGameY,
      260,
      48,
      'NEW GAME',
      () => {
        this.startNewGame();
      },
      15010,
      () => this.gameState === 'MENU' && !this.audioSettingsContainer
    );

    this.createMenuButton(
      container,
      width / 2,
      audioBtnY,
      260,
      48,
      'AUDIO',
      () => {
        this.openAudioSettings('MENU');
      },
      15010,
      () => this.gameState === 'MENU' && !this.audioSettingsContainer
    );

    // 6. Tangentbords-prompt (Enter / Mellanslag)
    const keyHint = this.add.text(width / 2, audioBtnY + 40, '[ TRYCK ENTER ELLER MELLANSLAG FÖR ATT STARTA ]', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '11px',
      letterSpacing: 3,
      color: '#756c5e',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    container.add(keyHint);

    this.tweens.add({
      targets: keyHint,
      alpha: { from: 0.35, to: 0.95 },
      duration: 1300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 7. Kontrollöversikt i botten
    const footerY = height - 20;
    const footerText = this.add.text(
      width / 2,
      footerY,
      'WASD: FÖRFLYTTNING  •  MUS: SIKTA & ATTACKERA  •  MELLANSLAG: DASH  •  Q: HÄLSOBRYGD  •  1-5: VAPENBYTE',
      {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '11px',
        letterSpacing: 2,
        color: '#4e483e',
        stroke: '#000000',
        strokeThickness: 2,
      }
    ).setOrigin(0.5);
    container.add(footerText);

    // Tangentlyssnare
    const onKeyDown = (event) => {
      if (this.gameState === 'MENU' && !this.audioSettingsContainer && (event.code === 'Enter' || event.code === 'Space')) {
        this.input.setDefaultCursor('default');
        this.startNewGame();
      }
    };
    this.input.keyboard.on('keydown', onKeyDown);
    this.events.once('shutdown', () => {
      this.input.keyboard.off('keydown', onKeyDown);
    });

    // Mjuk intoning
    container.setAlpha(0);
    this.tweens.add({
      targets: container,
      alpha: 1,
      duration: 650,
      ease: 'Cubic.easeOut',
    });
  }

  /**
   * Startar ett nytt spel från titelmenyn:
   * Återställer spelarens liv, position och fiender till startvärden, och ändrar gameState = "PLAYING".
   */
  startNewGame() {
    if (this.gameState === 'PLAYING') return;

    if (this.audioSettingsContainer) {
      this.closeAudioSettings();
    }

    this.input.setDefaultCursor('default');

    // Mjuk ljudeffekt vid spelstart
    try {
      if (this.sound && this.sound.get('blood_splat')) {
        this.sound.play('blood_splat', { volume: 0.35 });
      }
    } catch (e) {}

    // Animera bort titelskärmen
    if (this.titleMenuContainer) {
      this.tweens.add({
        targets: this.titleMenuContainer,
        alpha: 0,
        scaleX: 1.03,
        scaleY: 1.03,
        duration: 400,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          if (this.titleMenuContainer) {
            this.titleMenuContainer.destroy();
            this.titleMenuContainer = null;
          }
        },
      });
    }

    // 1. Ändra gameState = "PLAYING"
    this.gameState = 'PLAYING';

    // 2. Återställ spelarens liv, position och värden
    const spawnX = (this.defaultSpawn && this.defaultSpawn.x !== undefined)
      ? this.defaultSpawn.x
      : (this.mapConfig && this.mapConfig.defaultSpawn ? this.mapConfig.defaultSpawn.x : 300);
    const spawnY = (this.defaultSpawn && this.defaultSpawn.y !== undefined)
      ? this.defaultSpawn.y
      : (this.mapConfig && this.mapConfig.defaultSpawn ? this.mapConfig.defaultSpawn.y : 300);

    if (this.player) {
      this.player.setPosition(spawnX, spawnY);
      this.player.health = this.player.maxHealth;
      this.player.stamina = this.player.maxStamina;
      this.player.flaskCharges = this.player.maxFlaskCharges || 3;
      this.player.isDead = false;
      this.player.vx = 0;
      this.player.vy = 0;
      this.player.clearTint();
      if (this.player.body) {
        this.player.body.setVelocity(0, 0);
        this.player.body.reset(spawnX, spawnY);
      }
      if (this.player.shadow) {
        this.player.shadow.setPosition(spawnX, spawnY + 18);
        this.player.shadow.setVisible(true);
      }
      if (this.player.lightSource) {
        this.player.lightSource.setPosition(spawnX, spawnY + 4);
        this.player.lightSource.setVisible(true);
      }
      if (this.player.weaponSprite) {
        this.player.weaponSprite.setVisible(true);
      }
      this.player.play('player_idle', true);
    }

    // 3. Återställ fiender till startvärden
    this.resetEnemies();

    // 4. Återställ rumstillstånd
    this.hatchUnlocked = false;
    this.isTransitioning = false;
    this.isPlayerDead = false;

    // 5. Visa HUD
    if (this.hud) {
      this.hud.setVisible(true);
      this.hud.update(this.player);
    }

    // 6. Fade in och starta områdestitel
    this.cameras.main.fadeIn(600, 0, 0, 0);

    if (this.mapConfig) {
      this.displayAreaTitle(this.mapConfig.areaTitle, this.mapConfig.areaSubtitle);
    } else if (this.floor === 1) {
      this.displayAreaTitle('FÖRBANNADE SALEN', 'The Accursed Crypts & Grand Halls - Våning 1');
    } else {
      this.displayAreaTitle('TORTYRKAMMAREN', 'The Torture Chamber - Våning 2');
    }

    // 7. Säkerställ bakgrundsmusik
    if (audioManager) {
      audioManager.init(this, this.currentMapKey);
    }
  }

  /**
   * Återställer alla fiender och projektiler till sitt initiala tillstånd.
   */
  resetEnemies() {
    if (this.enemies) {
      this.enemies.getChildren().slice().forEach(enemy => {
        if (enemy) {
          if (enemy.telegraphGraphics) enemy.telegraphGraphics.clear();
          if (enemy.hpBarGraphics) enemy.hpBarGraphics.clear();
          if (enemy.bowTelegraphLine) enemy.bowTelegraphLine.clear();
          if (typeof enemy.destroy === 'function') {
            enemy.destroy();
          }
        }
      });
      this.enemies.clear(true, true);
    }
    if (this.knights) {
      this.knights.clear(true, true);
    }
    if (this.enemyProjectiles) {
      this.enemyProjectiles.clear(true, true);
    }
    if (this.slashes) {
      this.slashes.clear(true, true);
    }

    this.spawnEnemies();
  }

  /**
   * Växlar pausläget mellan PLAYING och PAUSED via ESC.
   */
  togglePause() {
    if (this.audioSettingsContainer) {
      this.closeAudioSettings();
      return;
    }
    if (this.gameState === 'PLAYING') {
      this.pauseGame();
    } else if (this.gameState === 'PAUSED') {
      this.resumeGame();
    }
  }

  /**
   * Pausar spelet och visar paus-skärmen med Dark Souls-estetik.
   */
  pauseGame() {
    if (this.gameState !== 'PLAYING' || this.isTransitioning || this.isPlayerDead) return;

    this.gameState = 'PAUSED';

    // 1. Pausa arkadfysiken så att varken spelare eller fiender rör sig
    if (this.physics && this.physics.world) {
      this.physics.world.isPaused = true;
    }

    // 2. Nollställ eventuell pågående spelarrörelse
    if (this.player) {
      this.player.vx = 0;
      this.player.vy = 0;
      if (this.player.body) {
        this.player.body.setVelocity(0, 0);
      }
    }

    // 3. Skapa paus-menyn
    this.createPauseMenu();
  }

  /**
   * Återupptar spelet precis där man var innan ESC trycktes.
   */
  resumeGame() {
    if (this.gameState !== 'PAUSED') return;

    this.input.setDefaultCursor('default');

    // Mjuk uttoning av pausmenyn
    if (this.pauseMenuContainer) {
      this.tweens.add({
        targets: this.pauseMenuContainer,
        alpha: 0,
        scaleX: 1.02,
        scaleY: 1.02,
        duration: 160,
        ease: 'Quad.easeOut',
        onComplete: () => {
          if (this.pauseMenuContainer) {
            this.pauseMenuContainer.destroy();
            this.pauseMenuContainer = null;
          }
        },
      });
    }

    this.gameState = 'PLAYING';

    // Återuppta fysiken
    if (this.physics && this.physics.world) {
      this.physics.world.isPaused = false;
    }
  }

  /**
   * Skapar och visar paus-skärmen med Dark Souls 3-design.
   */
  createPauseMenu() {
    if (this.pauseMenuContainer) {
      this.pauseMenuContainer.destroy();
      this.pauseMenuContainer = null;
    }

    const cam = this.cameras.main;
    const width = cam.width;
    const height = cam.height;

    const container = this.add.container(0, 0);
    container.setScrollFactor(0);
    container.setDepth(16000);
    this.pauseMenuContainer = container;

    // 1. Mörk atmosfärisk vinjettslöja (spelet syns dovt i bakgrunden)
    const bgOverlay = this.add.graphics();
    bgOverlay.fillStyle(0x040306, 0.82);
    bgOverlay.fillRect(0, 0, width, height);
    container.add(bgOverlay);

    // 2. Rubrik: GAME PAUSED
    const titleY = Math.round(height * 0.32);
    const titleText = this.add.text(width / 2, titleY, 'GAME PAUSED', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '38px',
      fontStyle: 'bold',
      letterSpacing: 10,
      color: '#e2ecf4',
      stroke: '#000000',
      strokeThickness: 8,
      shadow: {
        offsetX: 0,
        offsetY: 4,
        color: '#000000',
        blur: 16,
        stroke: true,
        fill: true,
      },
    }).setOrigin(0.5);
    container.add(titleText);

    // Dark Souls 3 avdelarlinje med central gyllene romb
    const divY = titleY + 34;
    const divW = Math.min(width * 0.45, 420);
    const dividerGfx = this.add.graphics();
    dividerGfx.lineStyle(1.5, 0x8c7853, 0.75);
    dividerGfx.strokeLineShape(new Phaser.Geom.Line(width / 2 - divW / 2, divY, width / 2 + divW / 2, divY));
    dividerGfx.fillStyle(0xd4af37, 0.95);
    dividerGfx.fillCircle(width / 2, divY, 3.5);
    container.add(dividerGfx);

    // 3. Menyval: CONTINUE, AUDIO och QUIT
    const options = [
      {
        text: 'CONTINUE',
        action: () => this.resumeGame(),
      },
      {
        text: 'AUDIO',
        action: () => this.openAudioSettings('PAUSED'),
      },
      {
        text: 'QUIT',
        action: () => this.quitToMainMenu(),
      },
    ];

    const btnStartY = divY + 44;
    const btnGap = 56;
    const btnW = 280;
    const btnH = 48;

    options.forEach((opt, idx) => {
      const btnY = btnStartY + idx * btnGap;
      this.createMenuButton(
        container,
        width / 2,
        btnY,
        btnW,
        btnH,
        opt.text,
        opt.action,
        16010,
        () => this.gameState === 'PAUSED' && !this.audioSettingsContainer
      );
    });

    // 4. Tangentbords-prompt (ESC för att återuppta)
    const keyHintY = btnStartY + options.length * btnGap + 14;
    const keyHint = this.add.text(width / 2, keyHintY, '[ TRYCK ESC ELLER KLICKA CONTINUE FÖR ATT ÅTERUPPTA ]', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '11px',
      letterSpacing: 3,
      color: '#756c5e',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    container.add(keyHint);

    this.tweens.add({
      targets: keyHint,
      alpha: { from: 0.35, to: 0.95 },
      duration: 1300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Enter / Mellanslag tangentstöd för snabb continue
    const onEnterDown = (e) => {
      if (this.gameState === 'PAUSED' && !this.audioSettingsContainer && (e.code === 'Enter' || e.code === 'Space')) {
        this.resumeGame();
      }
    };
    this.input.keyboard.on('keydown', onEnterDown);
    this.pauseMenuContainer.once('destroy', () => {
      this.input.keyboard.off('keydown', onEnterDown);
    });

    // Mjuk intoning
    container.setAlpha(0);
    this.tweens.add({
      targets: container,
      alpha: 1,
      duration: 200,
      ease: 'Cubic.easeOut',
    });
  }

  /**
   * Avslutar det pågående spelet och återvänder till startskärmen (titelmenyn).
   */
  quitToMainMenu() {
    this.input.setDefaultCursor('default');

    if (this.audioSettingsContainer) {
      this.closeAudioSettings();
    }

    if (this.gregGravekeeper) {
      this.gregGravekeeper.closeDialogue();
    }

    if (this.pauseMenuContainer) {
      this.pauseMenuContainer.destroy();
      this.pauseMenuContainer = null;
    }

    // Återuppta arkadfysiken inför framtida spel
    if (this.physics && this.physics.world) {
      this.physics.world.isPaused = false;
    }

    // Sätt spelläge till MENU
    this.gameState = 'MENU';

    // Dölj HUD
    if (this.hud) {
      this.hud.setVisible(false);
    }

    // Dölj eventuell dörr-/kistprompt
    if (this.doorPromptContainer) {
      this.doorPromptContainer.setVisible(false);
    }

    // Återställ spelaren och fienderna till startvärden
    const spawnX = (this.defaultSpawn && this.defaultSpawn.x !== undefined) ? this.defaultSpawn.x : 300;
    const spawnY = (this.defaultSpawn && this.defaultSpawn.y !== undefined) ? this.defaultSpawn.y : 300;

    if (this.player) {
      this.player.setPosition(spawnX, spawnY);
      this.player.health = this.player.maxHealth;
      this.player.stamina = this.player.maxStamina;
      this.player.flaskCharges = this.player.maxFlaskCharges || 3;
      this.player.isDead = false;
      this.player.vx = 0;
      this.player.vy = 0;
      this.player.clearTint();
      if (this.player.body) {
        this.player.body.setVelocity(0, 0);
        this.player.body.reset(spawnX, spawnY);
      }
      if (this.player.shadow) {
        this.player.shadow.setPosition(spawnX, spawnY + 18);
        this.player.shadow.setVisible(true);
      }
      if (this.player.lightSource) {
        this.player.lightSource.setPosition(spawnX, spawnY + 4);
        this.player.lightSource.setVisible(true);
      }
      if (this.player.weaponSprite) {
        this.player.weaponSprite.setVisible(true);
      }
      this.player.play('player_idle', true);
    }

    this.resetEnemies();

    this.hatchUnlocked = false;
    this.isTransitioning = false;
    this.isPlayerDead = false;

    // Visa startskärmen
    this.createTitleMenu();
  }

  /**
   * Skapar en stilenlig Dark Souls 3 meny-knapp med svärdindikatorer och pålitlig musinteraktion.
   * @param {Phaser.GameObjects.Container} parentContainer
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {number} height
   * @param {string} text
   * @param {Function} onClick
   * @param {number} depth
   * @param {Function} isInteractiveCondition
   */
  createMenuButton(parentContainer, x, y, width, height, text, onClick, depth = 16010, isInteractiveCondition = () => true) {
    const btnContainer = this.add.container(x, y);

    const btnBg = this.add.graphics();
    const drawBtnBg = (hovered = false) => {
      btnBg.clear();
      btnBg.fillStyle(hovered ? 0x16131c : 0x08080c, hovered ? 0.95 : 0.85);
      btnBg.fillRoundedRect(-width / 2, -height / 2, width, height, 4);
      btnBg.lineStyle(hovered ? 1.8 : 1.0, hovered ? 0xd4af37 : 0x4a3f32, hovered ? 1 : 0.7);
      btnBg.strokeRoundedRect(-width / 2, -height / 2, width, height, 4);
      if (hovered) {
        btnBg.lineStyle(1, 0xffe27a, 0.4);
        btnBg.strokeRoundedRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4, 3);
      }
    };
    drawBtnBg(false);

    const btnText = this.add.text(0, 0, text, {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '21px',
      fontStyle: 'bold',
      letterSpacing: 8,
      color: '#c8c2b7',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    const swordOffset = width / 2 - 16;
    const swordHoverOffset = swordOffset - 14;

    const leftSword = this.add.text(-swordOffset, -1, '🗡️', {
      fontSize: '18px',
    }).setOrigin(0.5).setAlpha(0);

    const rightSword = this.add.text(swordOffset, -1, '🗡️', {
      fontSize: '18px',
    }).setOrigin(0.5).setAlpha(0).setFlipX(true);

    btnContainer.add([btnBg, btnText, leftSword, rightSword]);
    parentContainer.add(btnContainer);

    // Dedikerad hit-zone med scrollFactor(0) och useHandCursor
    const hitZone = this.add.zone(x, y, width, height);
    hitZone.setScrollFactor(0);
    hitZone.setDepth(depth);
    hitZone.setInteractive({ useHandCursor: true });
    parentContainer.add(hitZone);

    let isHovered = false;
    hitZone.on('pointerover', () => {
      if (isHovered || !isInteractiveCondition()) return;
      isHovered = true;
      drawBtnBg(true);
      btnText.setColor('#ffd700');
      btnText.setShadow(0, 0, '#eab308', 14, true, true);
      this.input.setDefaultCursor('pointer');

      this.tweens.add({
        targets: [leftSword, rightSword],
        alpha: 1,
        duration: 160,
        ease: 'Cubic.easeOut',
      });
      this.tweens.add({
        targets: leftSword,
        x: -swordHoverOffset,
        duration: 160,
        ease: 'Cubic.easeOut',
      });
      this.tweens.add({
        targets: rightSword,
        x: swordHoverOffset,
        duration: 160,
        ease: 'Cubic.easeOut',
      });
      this.tweens.add({
        targets: btnContainer,
        scaleX: 1.04,
        scaleY: 1.04,
        duration: 150,
        ease: 'Back.easeOut',
      });
    });

    hitZone.on('pointerout', () => {
      if (!isHovered) return;
      isHovered = false;
      drawBtnBg(false);
      btnText.setColor('#c8c2b7');
      btnText.setShadow(0, 0, '#000000', 0, false, false);
      this.input.setDefaultCursor('default');

      this.tweens.add({
        targets: [leftSword, rightSword],
        alpha: 0,
        duration: 150,
        ease: 'Cubic.easeIn',
      });
      this.tweens.add({
        targets: leftSword,
        x: -swordOffset,
        duration: 150,
        ease: 'Cubic.easeIn',
      });
      this.tweens.add({
        targets: rightSword,
        x: swordOffset,
        duration: 150,
        ease: 'Cubic.easeIn',
      });
      this.tweens.add({
        targets: btnContainer,
        scaleX: 1.0,
        scaleY: 1.0,
        duration: 150,
        ease: 'Cubic.easeOut',
      });
    });

    hitZone.on('pointerdown', () => {
      if (!isInteractiveCondition()) return;
      this.input.setDefaultCursor('default');
      this.tweens.add({
        targets: btnContainer,
        scaleX: 0.94,
        scaleY: 0.94,
        duration: 75,
        yoyo: true,
        onComplete: () => {
          onClick();
        },
      });
    });

    return { btnContainer, hitZone };
  }

  /**
   * Sätter spelets globala mastervolym (0.0 till 1.0 / 0 till 100%).
   * Justerar Phaser master-ljud och synkroniserar med AudioManager.
   * @param {number} vol
   */
  setGameVolume(vol) {
    this.gameVolume = Phaser.Math.Clamp(Math.round(vol * 100) / 100, 0, 1);

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('souls_game_volume', this.gameVolume.toString());
      }
    } catch (e) {}

    // 1. Phaser global master-volym för scenen (skalar alla ljudeffekter och musik)
    if (this.sound) {
      this.sound.volume = this.gameVolume;
    }

    // 2. Synkronisera AudioManager mute-status
    if (audioManager) {
      if (this.gameVolume === 0) {
        if (!audioManager.isMuted) {
          audioManager.toggleMute();
        }
      } else {
        if (audioManager.isMuted) {
          audioManager.toggleMute();
        }
        audioManager.notifyListeners();
      }
    }
  }

  /**
   * Öppnar den gotiska ljudinställningspanelen (Dark Souls 3-estetik)
   * Låter spelaren reglera spelets mastervolym från 0 till 100%.
   * @param {'MENU'|'PAUSED'} fromMenu
   */
  openAudioSettings(fromMenu = 'MENU') {
    this.audioSettingsFrom = fromMenu;

    // Dölj föräldramenyn så att vyn inte blir plottrig
    if (fromMenu === 'MENU' && this.titleMenuContainer) {
      this.titleMenuContainer.setVisible(false);
    } else if (fromMenu === 'PAUSED' && this.pauseMenuContainer) {
      this.pauseMenuContainer.setVisible(false);
    }

    if (this.audioSettingsContainer) {
      this.audioSettingsContainer.destroy();
      this.audioSettingsContainer = null;
    }

    if (this.audioSettingsCleanups) {
      this.audioSettingsCleanups.forEach(fn => fn());
      this.audioSettingsCleanups = [];
    }
    this.audioSettingsCleanups = [];

    const cam = this.cameras.main;
    const width = cam.width;
    const height = cam.height;

    const container = this.add.container(0, 0);
    container.setScrollFactor(0);
    container.setDepth(17000);
    this.audioSettingsContainer = container;

    // 1. Atmosfärisk vinjett och mörk bakgrund
    const bgOverlay = this.add.graphics();
    bgOverlay.fillStyle(0x020204, 0.88);
    bgOverlay.fillRect(0, 0, width, height);
    container.add(bgOverlay);

    // Klicka på bakgrunden utanför panelen för att stänga
    const modalW = Math.min(width * 0.90, 560);
    const modalH = Math.min(height * 0.86, 420);
    const modalX = width / 2;
    const modalY = height / 2;

    const backdropHit = this.add.zone(width / 2, height / 2, width, height);
    backdropHit.setScrollFactor(0);
    backdropHit.setDepth(17005);
    backdropHit.setInteractive();
    backdropHit.on('pointerdown', (p) => {
      if (Math.abs(p.x - modalX) > modalW / 2 || Math.abs(p.y - modalY) > modalH / 2) {
        this.closeAudioSettings();
      }
    });
    container.add(backdropHit);

    // 2. Ornat Dark Souls 3 modal-ram
    const panelBg = this.add.graphics();
    // Bakgrundsplatta i sotad mörk sten
    panelBg.fillStyle(0x0b0910, 0.96);
    panelBg.fillRoundedRect(modalX - modalW / 2, modalY - modalH / 2, modalW, modalH, 6);

    // Gyllene / sotad mässingskant
    panelBg.lineStyle(1.8, 0x8c7853, 0.85);
    panelBg.strokeRoundedRect(modalX - modalW / 2, modalY - modalH / 2, modalW, modalH, 6);

    // Inre dekorativ ram
    panelBg.lineStyle(1.0, 0x4a3f32, 0.5);
    panelBg.strokeRoundedRect(modalX - modalW / 2 + 5, modalY - modalH / 2 + 5, modalW - 10, modalH - 10, 4);

    // Hörnornament (små Dark Souls-diamanter i guld)
    const corners = [
      { x: modalX - modalW / 2 + 5, y: modalY - modalH / 2 + 5 },
      { x: modalX + modalW / 2 - 5, y: modalY - modalH / 2 + 5 },
      { x: modalX - modalW / 2 + 5, y: modalY + modalH / 2 - 5 },
      { x: modalX + modalW / 2 - 5, y: modalY + modalH / 2 - 5 },
    ];
    panelBg.fillStyle(0xd4af37, 0.95);
    corners.forEach(c => {
      panelBg.fillPoints([
        { x: c.x, y: c.y - 4 },
        { x: c.x + 4, y: c.y },
        { x: c.x, y: c.y + 4 },
        { x: c.x - 4, y: c.y },
      ], true);
    });
    container.add(panelBg);

    // 3. Titel: AUDIO SETTINGS
    const titleY = modalY - modalH / 2 + 42;
    const titleText = this.add.text(modalX, titleY, 'AUDIO SETTINGS', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '28px',
      fontStyle: 'bold',
      letterSpacing: 8,
      color: '#e2ecf4',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5);
    container.add(titleText);

    // Gyllene avdelare med romb
    const divY = titleY + 26;
    const divW = modalW * 0.70;
    const dividerGfx = this.add.graphics();
    dividerGfx.lineStyle(1.2, 0x8c7853, 0.8);
    dividerGfx.strokeLineShape(new Phaser.Geom.Line(modalX - divW / 2, divY, modalX + divW / 2, divY));
    dividerGfx.fillStyle(0xd4af37, 0.95);
    dividerGfx.fillCircle(modalX, divY, 3);
    container.add(dividerGfx);

    // 4. Underrubrik
    const subY = divY + 24;
    const subText = this.add.text(modalX, subY, '— MASTER VOLUME —', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '12px',
      letterSpacing: 5,
      color: '#9c8f7d',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    container.add(subText);

    // 5. Stor volymprocent (t.ex. '80%')
    const percentY = subY + 36;
    const percentText = this.add.text(modalX, percentY, `${Math.round(this.gameVolume * 100)}%`, {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '36px',
      fontStyle: 'bold',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 6,
      shadow: {
        offsetX: 0,
        offsetY: 2,
        color: '#eab308',
        blur: 14,
        stroke: true,
        fill: true,
      },
    }).setOrigin(0.5);
    container.add(percentText);

    // 6. Volymslider-komponent
    const sliderW = Math.min(modalW - 170, 320);
    const sliderH = 14;
    const sliderX = modalX - sliderW / 2;
    const sliderY = percentY + 44;

    const sliderBg = this.add.graphics();
    const sliderFill = this.add.graphics();
    const sliderThumb = this.add.graphics();
    container.add([sliderBg, sliderFill, sliderThumb]);

    // Rita sliderns bakgrund och markeringar
    const drawSliderTrack = () => {
      sliderBg.clear();
      // Yttre skugga/recess
      sliderBg.fillStyle(0x06050a, 0.95);
      sliderBg.fillRoundedRect(sliderX - 2, sliderY - 2, sliderW + 4, sliderH + 4, 4);
      // Inre spår
      sliderBg.fillStyle(0x15121b, 1.0);
      sliderBg.fillRoundedRect(sliderX, sliderY, sliderW, sliderH, 3);
      sliderBg.lineStyle(1.2, 0x4a3f32, 0.85);
      sliderBg.strokeRoundedRect(sliderX, sliderY, sliderW, sliderH, 3);

      // Skalstreck vid 0%, 25%, 50%, 75%, 100%
      [0, 0.25, 0.5, 0.75, 1.0].forEach(p => {
        const tx = sliderX + sliderW * p;
        sliderBg.lineStyle(1.0, 0x6e5c46, 0.55);
        sliderBg.strokeLineShape(new Phaser.Geom.Line(tx, sliderY + sliderH + 3, tx, sliderY + sliderH + 8));
      });
    };
    drawSliderTrack();

    // Funktion för att rita fyllning och draghandtag
    const updateSliderGraphics = () => {
      const vol = this.gameVolume;
      const fillW = Math.max(0, Math.min(sliderW, sliderW * vol));
      const thumbX = sliderX + fillW;
      const thumbY = sliderY + sliderH / 2;

      // Fyllning i glödande guld
      sliderFill.clear();
      if (fillW > 2) {
        sliderFill.fillStyle(vol === 0 ? 0x444444 : 0xd4af37, 0.92);
        sliderFill.fillRoundedRect(sliderX + 1, sliderY + 1, fillW - 2, sliderH - 2, 2);
        if (vol > 0) {
          sliderFill.lineStyle(1, 0xffe27a, 0.6);
          sliderFill.strokeLineShape(new Phaser.Geom.Line(sliderX + 2, sliderY + 2, sliderX + fillW - 2, sliderY + 2));
        }
      }

      // Handtag (Dark Souls guld-talisman / romb)
      sliderThumb.clear();
      // Bakomliggande glöd
      if (vol > 0) {
        sliderThumb.fillStyle(0xeab308, 0.35);
        sliderThumb.fillCircle(thumbX, thumbY, 11);
      }
      // Rombform
      sliderThumb.fillStyle(0x1a1520, 1.0);
      sliderThumb.fillPoints([
        { x: thumbX, y: thumbY - 12 },
        { x: thumbX + 8, y: thumbY },
        { x: thumbX, y: thumbY + 12 },
        { x: thumbX - 8, y: thumbY },
      ], true);
      sliderThumb.lineStyle(1.8, vol === 0 ? 0x888888 : 0xffd700, 1.0);
      sliderThumb.strokePoints([
        { x: thumbX, y: thumbY - 12 },
        { x: thumbX + 8, y: thumbY },
        { x: thumbX, y: thumbY + 12 },
        { x: thumbX - 8, y: thumbY },
      ], true);
      // Inre kärna
      sliderThumb.fillStyle(vol === 0 ? 0x666666 : 0xffffff, 0.9);
      sliderThumb.fillCircle(thumbX, thumbY, 2.5);

      // Uppdatera text
      percentText.setText(`${Math.round(vol * 100)}%`);
      percentText.setColor(vol === 0 ? '#888888' : '#ffd700');
    };

    updateSliderGraphics();

    // Interaktiv zon för att klicka och dra längs slidern
    const sliderHitZone = this.add.zone(modalX, sliderY + sliderH / 2, sliderW + 24, 38);
    sliderHitZone.setScrollFactor(0);
    sliderHitZone.setDepth(17050);
    sliderHitZone.setInteractive({ useHandCursor: true });
    container.add(sliderHitZone);

    let isDraggingSlider = false;

    const applyPointerToVolume = (pointer) => {
      const clampedX = Phaser.Math.Clamp(pointer.x, sliderX, sliderX + sliderW);
      const ratio = (clampedX - sliderX) / sliderW;
      const rounded = Math.round(ratio * 100) / 100;
      this.setGameVolume(rounded);
      updateSliderGraphics();
      updatePresetHighlights();
    };

    sliderHitZone.on('pointerdown', (pointer) => {
      isDraggingSlider = true;
      applyPointerToVolume(pointer);
    });

    const onPointerMove = (pointer) => {
      if (!isDraggingSlider) return;
      applyPointerToVolume(pointer);
    };

    const onPointerUp = () => {
      if (isDraggingSlider) {
        isDraggingSlider = false;
        this.playTestAudioCue();
      }
    };

    this.input.on('pointermove', onPointerMove);
    this.input.on('pointerup', onPointerUp);
    this.audioSettingsCleanups.push(() => {
      this.input.off('pointermove', onPointerMove);
      this.input.off('pointerup', onPointerUp);
    });

    // 7. Stegknappar [-] och [+]
    const createStepBtn = (x, y, label, delta) => {
      const stepContainer = this.add.container(x, y);
      const size = 32;

      const bg = this.add.graphics();
      const drawBg = (hovered = false) => {
        bg.clear();
        bg.fillStyle(hovered ? 0x1d1726 : 0x0c0912, hovered ? 0.95 : 0.85);
        bg.fillRoundedRect(-size / 2, -size / 2, size, size, 4);
        bg.lineStyle(hovered ? 1.5 : 1.0, hovered ? 0xd4af37 : 0x4a3f32, hovered ? 1 : 0.7);
        bg.strokeRoundedRect(-size / 2, -size / 2, size, size, 4);
      };
      drawBg(false);

      const txt = this.add.text(0, 0, label, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#c8c2b7',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5);

      stepContainer.add([bg, txt]);
      container.add(stepContainer);

      const zone = this.add.zone(x, y, size, size);
      zone.setScrollFactor(0);
      zone.setDepth(17050);
      zone.setInteractive({ useHandCursor: true });
      container.add(zone);

      zone.on('pointerover', () => {
        drawBg(true);
        txt.setColor('#ffd700');
        this.input.setDefaultCursor('pointer');
        this.tweens.add({ targets: stepContainer, scaleX: 1.08, scaleY: 1.08, duration: 120 });
      });

      zone.on('pointerout', () => {
        drawBg(false);
        txt.setColor('#c8c2b7');
        this.input.setDefaultCursor('default');
        this.tweens.add({ targets: stepContainer, scaleX: 1.0, scaleY: 1.0, duration: 120 });
      });

      zone.on('pointerdown', () => {
        const nextVol = Phaser.Math.Clamp(Math.round((this.gameVolume + delta) * 100) / 100, 0, 1);
        this.setGameVolume(nextVol);
        updateSliderGraphics();
        updatePresetHighlights();
        this.playTestAudioCue();
        this.tweens.add({
          targets: stepContainer,
          scaleX: 0.90,
          scaleY: 0.90,
          duration: 60,
          yoyo: true,
        });
      });
    };

    createStepBtn(sliderX - 26, sliderY + sliderH / 2, '–', -0.05);
    createStepBtn(sliderX + sliderW + 26, sliderY + sliderH / 2, '+', 0.05);

    // 8. Snabbval / Presets: [ 🔇 MUTE ], [ 25% ], [ 50% ], [ 75% ], [ 100% ]
    const presetsY = sliderY + 40;
    const presets = [
      { label: '🔇 MUTE', value: 0 },
      { label: '25%', value: 0.25 },
      { label: '50%', value: 0.50 },
      { label: '75%', value: 0.75 },
      { label: '100%', value: 1.00 },
    ];

    const presetElements = [];
    const totalPresetW = 340;
    const presetGap = 8;
    const itemW = (totalPresetW - (presets.length - 1) * presetGap) / presets.length;
    const startPresetX = modalX - totalPresetW / 2 + itemW / 2;

    presets.forEach((p, idx) => {
      const px = startPresetX + idx * (itemW + presetGap);
      const pContainer = this.add.container(px, presetsY);
      const pH = 26;

      const pBg = this.add.graphics();
      const pText = this.add.text(0, 0, p.label, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '11px',
        fontStyle: 'bold',
        letterSpacing: 1,
        color: '#a0988a',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5);

      pContainer.add([pBg, pText]);
      container.add(pContainer);

      const pZone = this.add.zone(px, presetsY, itemW, pH);
      pZone.setScrollFactor(0);
      pZone.setDepth(17050);
      pZone.setInteractive({ useHandCursor: true });
      container.add(pZone);

      const renderPresetBg = (isHovered = false) => {
        const isActive = Math.abs(this.gameVolume - p.value) < 0.02;
        pBg.clear();
        pBg.fillStyle(isActive ? 0x241d14 : (isHovered ? 0x16131c : 0x0c0a10), 0.9);
        pBg.fillRoundedRect(-itemW / 2, -pH / 2, itemW, pH, 3);
        pBg.lineStyle(isActive ? 1.5 : (isHovered ? 1.2 : 0.8), isActive ? 0xd4af37 : (isHovered ? 0x8c7853 : 0x3d352b), 1);
        pBg.strokeRoundedRect(-itemW / 2, -pH / 2, itemW, pH, 3);
        pText.setColor(isActive ? '#ffd700' : (isHovered ? '#f3eee3' : '#a0988a'));
      };

      renderPresetBg(false);
      presetElements.push(renderPresetBg);

      pZone.on('pointerover', () => {
        renderPresetBg(true);
        this.input.setDefaultCursor('pointer');
      });

      pZone.on('pointerout', () => {
        renderPresetBg(false);
        this.input.setDefaultCursor('default');
      });

      pZone.on('pointerdown', () => {
        this.setGameVolume(p.value);
        updateSliderGraphics();
        updatePresetHighlights();
        this.playTestAudioCue();
      });
    });

    const updatePresetHighlights = () => {
      presetElements.forEach(fn => fn(false));
    };

    // 9. Horisontell delningslinje före BACK-knapp
    const lowerDivY = presetsY + 34;
    const lowerDivW = modalW * 0.55;
    const lowerDivGfx = this.add.graphics();
    lowerDivGfx.lineStyle(1.0, 0x4a3f32, 0.7);
    lowerDivGfx.strokeLineShape(new Phaser.Geom.Line(modalX - lowerDivW / 2, lowerDivY, modalX + lowerDivW / 2, lowerDivY));
    container.add(lowerDivGfx);

    // 10. 'BACK' Dark Souls 3 knapp
    const backBtnY = lowerDivY + 40;
    this.createMenuButton(
      container,
      modalX,
      backBtnY,
      220,
      44,
      'BACK',
      () => this.closeAudioSettings(),
      17060,
      () => !!this.audioSettingsContainer
    );

    // 11. Tangentbords-prompt i botten
    const hintY = modalY + modalH / 2 - 18;
    const hintText = this.add.text(modalX, hintY, '[ ◄ / ► : FINJUSTERA  •  ESC / KLICKA BACK FÖR ATT STÄNGA ]', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '10px',
      letterSpacing: 2,
      color: '#655d51',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    container.add(hintText);

    // 12. Tangentbordslyssnare för Audio-skärmen
    const onKeyDown = (event) => {
      if (!this.audioSettingsContainer) return;

      if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
        const nextVol = Phaser.Math.Clamp(Math.round((this.gameVolume - 0.05) * 100) / 100, 0, 1);
        this.setGameVolume(nextVol);
        updateSliderGraphics();
        updatePresetHighlights();
        this.playTestAudioCue();
      } else if (event.code === 'ArrowRight' || event.code === 'KeyD') {
        const nextVol = Phaser.Math.Clamp(Math.round((this.gameVolume + 0.05) * 100) / 100, 0, 1);
        this.setGameVolume(nextVol);
        updateSliderGraphics();
        updatePresetHighlights();
        this.playTestAudioCue();
      } else if (event.code === 'Escape') {
        this.closeAudioSettings();
      }
    };
    this.input.keyboard.on('keydown', onKeyDown);
    this.audioSettingsCleanups.push(() => {
      this.input.keyboard.off('keydown', onKeyDown);
    });

    // Mjuk intoning
    container.setAlpha(0);
    this.tweens.add({
      targets: container,
      alpha: 1,
      duration: 180,
      ease: 'Cubic.easeOut',
    });
  }

  /**
   * Spelar en mjuk ljudeffekt som ljudprov när volymen justeras.
   */
  playTestAudioCue() {
    try {
      if (this.sound && this.gameVolume > 0) {
        if (this.sound.get('flask_drink') || this.cache.audio.exists('flask_drink')) {
          this.sound.play('flask_drink', { volume: 0.35, rate: 1.6 });
        } else if (this.sound.get('blood_splat') || this.cache.audio.exists('blood_splat')) {
          this.sound.play('blood_splat', { volume: 0.25 });
        }
      }
    } catch (e) {}
  }

  /**
   * Stänger ljudinställningspanelen och återställer föräldramenyn (startmeny eller pausmeny).
   */
  closeAudioSettings() {
    this.input.setDefaultCursor('default');

    if (this.audioSettingsCleanups) {
      this.audioSettingsCleanups.forEach(fn => fn());
      this.audioSettingsCleanups = [];
    }

    if (this.audioSettingsContainer) {
      const containerToDestroy = this.audioSettingsContainer;
      this.audioSettingsContainer = null;

      this.tweens.add({
        targets: containerToDestroy,
        alpha: 0,
        scaleX: 0.98,
        scaleY: 0.98,
        duration: 140,
        ease: 'Quad.easeOut',
        onComplete: () => {
          containerToDestroy.destroy();

          // Återställ och tona in föräldramenyn
          if (this.audioSettingsFrom === 'MENU') {
            if (this.titleMenuContainer) {
              this.titleMenuContainer.setVisible(true);
              this.titleMenuContainer.setAlpha(0);
              this.tweens.add({
                targets: this.titleMenuContainer,
                alpha: 1,
                duration: 180,
                ease: 'Cubic.easeOut',
              });
            } else {
              this.createTitleMenu();
            }
          } else if (this.audioSettingsFrom === 'PAUSED') {
            if (this.pauseMenuContainer) {
              this.pauseMenuContainer.setVisible(true);
              this.pauseMenuContainer.setAlpha(0);
              this.tweens.add({
                targets: this.pauseMenuContainer,
                alpha: 1,
                duration: 180,
                ease: 'Cubic.easeOut',
              });
            } else {
              this.createPauseMenu();
            }
          }
        },
      });
    }
  }
}
