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
    // Floor 1: SoulsLevel1 scaled (mapScale: 0.42) so an entire room is visible on screen (~900-1000px per room)
    // Floor 2: Torture Chamber Crypt (2048 x 1536)
    const mapScale = 0.42;
    this.mapScale = mapScale;
    const worldWidth = this.floor === 1 ? Math.round(6750 * mapScale) : 2048; // 2835 x 2016
    const worldHeight = this.floor === 1 ? Math.round(4800 * mapScale) : 1536;
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    // State flags for hatch and room progression
    this.hatchUnlocked = false;
    this.isTransitioning = false;

    // 1. Render Background based on active floor
    if (this.floor === 1) {
      const bg = this.add.image(0, 0, 'SoulsLevel1').setOrigin(0, 0);
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
    // Floor 1: Beside the crypt bonfire / sarcophagus (~651, 1061)
    // Floor 2: Enters from the northern door (988, 200)
    const spawnX = this.floor === 1 ? Math.round(1550 * mapScale) : 988;
    const spawnY = this.floor === 1 ? Math.round(2527 * mapScale) : 200;
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

    // 9. Camera Settings - Smooth Soulsborne Lerp & Viewport Sizing so a whole room is visible at once
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setZoom(this.floor === 1 ? 1.0 : 1.35);
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
      const vttData = this.cache.json.get('SoulsChapel_vtt');
      if (vttData) {
        this.buildWallsFromDD2VTT(vttData, width, height);
      } else {
        this.buildWallsFromLegacyJSON(width, height);
      }
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

  buildWallsFromDD2VTT(vttData, worldWidth, worldHeight) {
    const ppg = (vttData.resolution && vttData.resolution.pixels_per_grid) || 150;
    const mapSizeX = (vttData.resolution && vttData.resolution.map_size && vttData.resolution.map_size.x) || 45;
    const mapSizeY = (vttData.resolution && vttData.resolution.map_size && vttData.resolution.map_size.y) || 32;
    const nativeWidth = mapSizeX * ppg; // 6750
    const nativeHeight = mapSizeY * ppg; // 4800
    const scaleX = worldWidth / nativeWidth;
    const scaleY = worldHeight / nativeHeight;
    const s = scaleX;
    const wallThickness = 16;

    this.collisionSegments = [];

    // 1. Line of Sight (Solid Structural Walls from SoulsChapel.dd2vtt)
    if (Array.isArray(vttData.line_of_sight)) {
      vttData.line_of_sight.forEach(seg => {
        if (Array.isArray(seg) && seg.length >= 2) {
          const x1 = seg[0].x * ppg * scaleX;
          const y1 = seg[0].y * ppg * scaleY;
          const x2 = seg[1].x * ppg * scaleX;
          const y2 = seg[1].y * ppg * scaleY;
          this.createSegmentObstacle(x1, y1, x2, y2, wallThickness);
          this.collisionSegments.push({ x1, y1, x2, y2, type: 'wall' });
        }
      });
    }

    // 2. Portals (Exterior Windows and Outer Perimeter Doors)
    if (Array.isArray(vttData.portals)) {
      vttData.portals.forEach(p => {
        // Windows (closed: false) block player movement to keep character inside chapel rooms
        // Outer perimeter doors (x <= 600) block escape into the black void
        // Interior doorways (portals 12, 16, 19 connecting rooms) remain open for player passage
        const isWindow = p.closed === false;
        const isOuterDoor = p.closed === true && p.position && (p.position.x * ppg <= 600);
        if ((isWindow || isOuterDoor) && p.bounds && p.bounds.length >= 2) {
          const x1 = p.bounds[0].x * ppg * scaleX;
          const y1 = p.bounds[0].y * ppg * scaleY;
          const x2 = p.bounds[1].x * ppg * scaleX;
          const y2 = p.bounds[1].y * ppg * scaleY;
          this.createSegmentObstacle(x1, y1, x2, y2, wallThickness);
          this.collisionSegments.push({ x1, y1, x2, y2, type: isWindow ? 'window' : 'outer_door' });
        }
      });
    }

    // 3. Stately Stone Pillars in Grand Checkered Hall and Crypt (12 pillars)
    const pillarPositions = [
      { x: 3685, y: 2633 }, { x: 3685, y: 3873 },
      { x: 4307, y: 2632 }, { x: 4357, y: 3873 },
      { x: 5028, y: 2633 }, { x: 5028, y: 3873 },
      { x: 5700, y: 2633 }, { x: 5700, y: 3873 },
      { x: 710, y: 1537 }, { x: 710, y: 2947 },
      { x: 1285, y: 1537 }, { x: 1285, y: 2947 }
    ];
    pillarPositions.forEach(p => {
      this.createObstacle(Math.round(p.x * s), Math.round(p.y * s), 32, 32);
    });

    // 4. Crypt Props: Central Sarcophagus & Altar
    this.createObstacle(Math.round(1550 * s), Math.round(2380 * s), Math.round(140 * s), Math.round(230 * s));
    this.createObstacle(Math.round(1550 * s), Math.round(2530 * s), Math.round(70 * s), Math.round(70 * s)); // Bonfire base

    // 5. Floor 2 Transition Hatch in upper wooden lodge
    this.hatchObstacle = this.createObstacle(Math.round(5540 * s), Math.round(1050 * s), 60, 60);

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

  createLighting() {
    if (!this.add.pointlight || this.game.renderer.type !== Phaser.WEBGL) return;

    if (this.floor === 1) {
      const s = this.mapScale;
      const vttData = this.cache.json.get('SoulsChapel_vtt');
      const lightsList = (vttData && Array.isArray(vttData.lights)) ? vttData.lights : level1Data.lights;
      const ppg = (vttData && vttData.resolution && vttData.resolution.pixels_per_grid) || 150;

      // Deduplicate / cluster overlapping lights that are close together (< 75 px)
      // to completely prevent multiple lights stacking additively into blinding white spots
      const clusteredLights = [];
      lightsList.forEach(l => {
        let x, y, range, color;
        if (l.position) {
          x = l.position.x * ppg;
          y = l.position.y * ppg;
          range = l.range || 4;
          color = l.color;
        } else {
          x = l.x;
          y = l.y;
          range = (l.dim || 20) / 4;
          color = l.tintColor;
        }
        const existing = clusteredLights.find(c => Math.hypot(c.x - x, c.y - y) < 80);
        if (!existing) {
          clusteredLights.push({ x, y, range, color });
        }
      });

      // Render static, non-pulsing, soft-falloff light sources
      clusteredLights.forEach((l) => {
        const lx = Math.round(l.x * s);
        const ly = Math.round(l.y * s);

        // Convert to a warm, rich amber tone so it never washes out into white
        let colorHex = 0xff9a2e; // Warm firelight amber
        if (typeof l.color === 'string') {
          const hexClean = l.color.replace('#', '').replace(/^ff/i, '');
          const parsed = parseInt(hexClean, 16);
          if (!isNaN(parsed) && parsed !== 0) {
            const r = (parsed >> 16) & 0xff;
            const g = (parsed >> 8) & 0xff;
            const b = parsed & 0xff;
            // Warm the color towards rich torch amber: low blue prevents white blowout
            const warmedR = Math.min(255, r);
            const warmedG = Math.round(g * 0.72);
            const warmedB = Math.round(b * 0.2);
            colorHex = (warmedR << 16) | (warmedG << 8) | warmedB;
          }
        }

        // Soft feathered radius and 50% scale
        const radius = Math.max(30, Math.round(l.range * ppg * s * 0.32));
        const intensity = 0.35; // Lowered intensity as requested (0.3 - 0.4)
        const attenuation = 0.55; // Smoothstep S-curve falloff feathers softly to 0 at perimeter (no hard white circles)

        const pl = this.add.pointlight(lx, ly, colorHex, radius, intensity, attenuation);
        pl.setAlpha(0.35); // Opacity / alpha set to 0.35
        pl.setBlendMode(Phaser.BlendModes.SCREEN); // Screen blend mode prevents additive white clipping
      });

      // 2. Cyan Water Fountain Glow in Grand Checkered Hall (Completely static, gentle glow)
      const fx = Math.round(4528 * s);
      const fy = Math.round(3217 * s);
      const fountainGlow = this.add.pointlight(fx, fy, 0x00c8e6, 75, 0.35, 0.5);
      fountainGlow.setAlpha(0.35);
      fountainGlow.setBlendMode(Phaser.BlendModes.SCREEN);

      // 3. Bonfire / Sarcophagus Hearth Embers in Crypt (1550, 2527)
      const bx = Math.round(1550 * s);
      const by = Math.round(2527 * s);
      this.add.particles(bx, by, 'ember_spark', {
        speed: { min: 8, max: 20 },
        angle: { min: 240, max: 300 },
        scale: { start: 0.5, end: 0.1 },
        alpha: { start: 0.6, end: 0 },
        lifespan: { min: 400, max: 800 },
        frequency: 110,
        blendMode: 'ADD',
      });

      // 4. Burning Fireplace Embers in Grand Checkered Hall (5740, 3900)
      const fpx = Math.round(5740 * s);
      const fpy = Math.round(3900 * s);
      this.add.particles(fpx, fpy, 'ember_spark', {
        speed: { min: 10, max: 24 },
        angle: { min: 230, max: 310 },
        scale: { start: 0.5, end: 0.1 },
        alpha: { start: 0.6, end: 0 },
        lifespan: { min: 400, max: 700 },
        frequency: 100,
        blendMode: 'ADD',
      });
    } else {
      // Room 2 (Torture Chamber) - Completely static lights
      const torchLight = this.add.pointlight(305, 65, 0xff8811, 140, 0.35, 0.5);
      torchLight.setAlpha(0.35);
      torchLight.setBlendMode(Phaser.BlendModes.SCREEN);

      this.add.particles(305, 65, 'ember_spark', {
        speed: { min: 10, max: 25 },
        angle: { min: 240, max: 300 },
        scale: { start: 0.5, end: 0.1 },
        alpha: { start: 0.6, end: 0 },
        lifespan: 600,
        frequency: 120,
        blendMode: 'ADD',
      });

      // Ambient Candlelight on the Dining Table (1435, 1290) - Static
      const tableLight = this.add.pointlight(1435, 1290, 0xffaa44, 110, 0.35, 0.5);
      tableLight.setAlpha(0.35);
      tableLight.setBlendMode(Phaser.BlendModes.SCREEN);
    }
  }

  spawnEnemies() {
    if (this.floor === 1) {
      const s = this.mapScale;
      // Floor 1: 5 Knights, 5 Ghosts distributed across compact rooms
      // 1. Crypt Chamber (West)
      const knight1 = new Enemy(this, Math.round(1050 * s), Math.round(2200 * s));
      const knight2 = new Enemy(this, Math.round(2100 * s), Math.round(2000 * s));
      const ghost1 = new GhostEnemy(this, Math.round(800 * s), Math.round(2700 * s));

      // 2. Forest Passage & Outdoors (Mid)
      const ghost2 = new GhostEnemy(this, Math.round(3050 * s), Math.round(3100 * s));
      const ghost3 = new GhostEnemy(this, Math.round(3200 * s), Math.round(1800 * s));

      // 3. Grand Checkered Hall (East)
      const knight3 = new Enemy(this, Math.round(4000 * s), Math.round(3200 * s));
      const knight4 = new Enemy(this, Math.round(5300 * s), Math.round(3200 * s));
      const ghost4 = new GhostEnemy(this, Math.round(4528 * s), Math.round(3217 * s)); // Circling fountain

      // 4. Upper Wooden Lodge (North-East)
      const knight5 = new Enemy(this, Math.round(5500 * s), Math.round(1200 * s));
      const ghost5 = new GhostEnemy(this, Math.round(5850 * s), Math.round(850 * s));

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
    const hatchX = this.floor === 1 ? Math.round(5540 * this.mapScale) : 75;
    const hatchY = this.floor === 1 ? Math.round(1050 * this.mapScale) : 715;
    const openHatch = this.add.sprite(hatchX, hatchY, 'open_hatch');
    openHatch.setOrigin(0.5, 0.5);
    openHatch.setDepth(20);

    // 3. Golden soul beacon light emanating from the open abyss (static, soft)
    if (this.add.pointlight && this.game.renderer.type === Phaser.WEBGL) {
      const hatchLight = this.add.pointlight(hatchX + 10, hatchY, 0xffaa22, 110, 0.35, 0.5);
      hatchLight.setAlpha(0.35);
      hatchLight.setBlendMode(Phaser.BlendModes.SCREEN);
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
