import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    this.load.image('dungeon_bg', '/assets/dungeon_background.jpg');
    this.load.image('dungeon_bg_room2', '/assets/dungeon_room2.jpg');
    this.load.spritesheet('player_knight', '/assets/player_spritesheet.png', {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.image('hammer', '/assets/hammer.png');
    this.load.image('reach_arc', '/assets/reach_arc.png');
    this.load.spritesheet('ghost_pixel', '/assets/ghost_spritesheet.png', {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.image('greatsword_bloody', '/assets/greatsword_bloody.png');
    this.load.image('knight_enemy', '/assets/knight_enemy.png');
    this.load.image('ghost_enemy', '/assets/ghost_enemy.png');
    this.load.image('SoulsLevel1', '/assets/SoulsLevel1.png');
    this.load.image('dungeon_level1', '/assets/SoulsLevel1.png');
    this.load.json('SoulsChapel_vtt', '/assets/SoulsChapel.dd2vtt');
    this.load.json('level1_data', '/assets/SoulsLevel1.json');
  }

  create() {
    // Set nearest-neighbor filtering for crisp retro pixel art
    if (this.textures.exists('player_knight')) {
      this.textures.get('player_knight').setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    if (this.textures.exists('hammer')) {
      this.textures.get('hammer').setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    if (this.textures.exists('reach_arc')) {
      this.textures.get('reach_arc').setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    if (this.textures.exists('ghost_pixel')) {
      this.textures.get('ghost_pixel').setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    if (this.textures.exists('greatsword_bloody')) {
      this.textures.get('greatsword_bloody').setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    if (this.textures.exists('knight_enemy')) {
      this.textures.get('knight_enemy').setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    if (this.textures.exists('ghost_enemy')) {
      this.textures.get('ghost_enemy').setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    // Ghost floating animations
    if (!this.anims.exists('ghost_float')) {
      this.anims.create({
        key: 'ghost_float',
        frames: this.anims.generateFrameNumbers('ghost_pixel', { start: 0, end: 3 }),
        frameRate: 6,
        repeat: -1,
      });
    }
    if (!this.anims.exists('ghost_idle')) {
      this.anims.create({
        key: 'ghost_idle',
        frames: [{ key: 'ghost_pixel', frame: 0 }],
        frameRate: 1,
        repeat: -1,
      });
    }

    // Player character animations
    if (!this.anims.exists('player_idle')) {
      this.anims.create({
        key: 'player_idle',
        frames: [{ key: 'player_knight', frame: 0 }],
        frameRate: 1,
        repeat: -1,
      });
    }

    if (!this.anims.exists('player_walk')) {
      this.anims.create({
        key: 'player_walk',
        frames: this.anims.generateFrameNumbers('player_knight', { start: 0, end: 5 }),
        frameRate: 9,
        repeat: -1,
      });
    }

    // Generate all other game textures procedurally for a rich Dark Souls 3 aesthetic
    this.createFloorTexture();
    this.createPillarTexture();
    this.createWallTexture();
    // (createKnightTexture is replaced by the authentic pixel art spritesheet)
    this.createBonfireTexture();
    this.createEmberTexture();
    this.createDustTexture();
    this.createLightTexture();
    this.createSlashTexture();
    this.createHammerShockwaveTexture();
    this.createEnemyKnightTexture();
    this.createEnemySlashTexture();
    this.createGhostTexture();
    this.createGhostClawTexture();
    this.createOpenHatchTexture();

    this.scene.start('GameScene');
  }

  // Gothic Stone Tile Floor (64x64)
  createFloorTexture() {
    const canvas = this.textures.createCanvas('floor_tile', 128, 128);
    const ctx = canvas.getContext();

    // Base dark stone color
    ctx.fillStyle = '#141217';
    ctx.fillRect(0, 0, 128, 128);

    // Stone slabs with mortar grooves
    const stones = [
      { x: 2, y: 2, w: 60, h: 60, col: '#1c1920' },
      { x: 66, y: 2, w: 60, h: 60, col: '#18161d' },
      { x: 2, y: 66, w: 60, h: 60, col: '#17151b' },
      { x: 66, y: 66, w: 60, h: 60, col: '#1f1b24' },
    ];

    stones.forEach(s => {
      ctx.fillStyle = s.col;
      ctx.fillRect(s.x, s.y, s.w, s.h);

      // Stone highlight top-left
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.strokeRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2);

      // Stone crack details
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.moveTo(s.x + 15, s.y + 10);
      ctx.lineTo(s.x + 28, s.y + 24);
      ctx.lineTo(s.x + 35, s.y + 20);
      ctx.stroke();

      // Subtle grunge / noise spots
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.fillRect(s.x + 8, s.y + 40, 12, 8);
      ctx.fillRect(s.x + 38, s.y + 15, 8, 14);
    });

    // Dark mortar borders
    ctx.fillStyle = '#0a080d';
    ctx.fillRect(0, 62, 128, 4);
    ctx.fillRect(62, 0, 4, 128);

    canvas.refresh();
  }

  // Gothic Pillar with cast shadow (64x96)
  createPillarTexture() {
    const canvas = this.textures.createCanvas('pillar', 64, 96);
    const ctx = canvas.getContext();

    // Shadow at base
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(32, 84, 28, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pillar base
    ctx.fillStyle = '#26212b';
    ctx.fillRect(10, 72, 44, 14);
    ctx.fillStyle = '#17141b';
    ctx.fillRect(8, 80, 48, 8);

    // Pillar shaft
    const grad = ctx.createLinearGradient(14, 0, 50, 0);
    grad.addColorStop(0, '#1a1620');
    grad.addColorStop(0.3, '#352e3d');
    grad.addColorStop(0.7, '#2a2430');
    grad.addColorStop(1, '#151218');
    ctx.fillStyle = grad;
    ctx.fillRect(14, 18, 36, 56);

    // Fluting vertical lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 2;
    for (let x = 20; x <= 44; x += 6) {
      ctx.beginPath();
      ctx.moveTo(x, 18);
      ctx.lineTo(x, 74);
      ctx.stroke();
    }

    // Capital (top)
    ctx.fillStyle = '#312b38';
    ctx.fillRect(8, 8, 48, 12);
    ctx.fillStyle = '#211c26';
    ctx.fillRect(6, 4, 52, 6);

    // Gold / brass trim accent
    ctx.fillStyle = '#bfa157';
    ctx.fillRect(14, 16, 36, 2);
    ctx.fillRect(10, 72, 44, 2);

    canvas.refresh();
  }

  // Dungeon Wall Texture
  createWallTexture() {
    const canvas = this.textures.createCanvas('wall_tile', 64, 64);
    const ctx = canvas.getContext();

    ctx.fillStyle = '#0f0d13';
    ctx.fillRect(0, 0, 64, 64);

    // Brick pattern
    ctx.fillStyle = '#1c1822';
    ctx.fillRect(2, 2, 60, 28);
    ctx.fillRect(2, 34, 28, 28);
    ctx.fillRect(34, 34, 28, 28);

    // Highlights
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.strokeRect(3, 3, 58, 26);
    ctx.strokeRect(3, 35, 26, 26);
    ctx.strokeRect(35, 35, 26, 26);

    canvas.refresh();
  }

  // Ashen One (Dark Souls Knight Sprite - 48x48)
  createKnightTexture() {
    const canvas = this.textures.createCanvas('player_knight', 48, 48);
    const ctx = canvas.getContext();

    // Cast shadow underneath player
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(24, 40, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dark flowing cape / cloth (Ashen tattered cape)
    ctx.fillStyle = '#1c1619';
    ctx.beginPath();
    ctx.moveTo(16, 20);
    ctx.lineTo(32, 20);
    ctx.lineTo(36, 42);
    ctx.lineTo(24, 40);
    ctx.lineTo(12, 42);
    ctx.closePath();
    ctx.fill();

    // Plate legs / greaves
    ctx.fillStyle = '#3a3840';
    ctx.fillRect(18, 32, 5, 10);
    ctx.fillRect(25, 32, 5, 10);

    // Dark metal sabatons (feet)
    ctx.fillStyle = '#26242c';
    ctx.fillRect(17, 40, 6, 3);
    ctx.fillRect(25, 40, 6, 3);

    // Knight Torso (Steel Breastplate with Dark Souls engraving)
    const armorGrad = ctx.createLinearGradient(16, 18, 32, 32);
    armorGrad.addColorStop(0, '#66606d');
    armorGrad.addColorStop(0.5, '#44404b');
    armorGrad.addColorStop(1, '#2c2933');
    ctx.fillStyle = armorGrad;
    ctx.fillRect(16, 18, 16, 14);

    // Steel pauldrons (Shoulder guards)
    ctx.fillStyle = '#5a5563';
    ctx.beginPath();
    ctx.arc(14, 20, 5, 0, Math.PI * 2);
    ctx.arc(34, 20, 5, 0, Math.PI * 2);
    ctx.fill();

    // Greatsword on back / hand
    ctx.fillStyle = '#222';
    ctx.fillRect(32, 8, 3, 28); // Blade
    ctx.fillStyle = '#d6d3d1';
    ctx.fillRect(33, 8, 1, 24); // Edge shine
    ctx.fillStyle = '#bfa157'; // Brass Crossguard
    ctx.fillRect(30, 24, 7, 2);
    ctx.fillStyle = '#5c1d1d'; // Grip
    ctx.fillRect(32.5, 26, 2, 7);

    // Elite Knight Helmet (Close helm)
    ctx.fillStyle = '#54505c';
    ctx.beginPath();
    ctx.arc(24, 14, 8, 0, Math.PI * 2);
    ctx.fill();

    // Helmet crest / ridge
    ctx.fillStyle = '#7a7384';
    ctx.fillRect(23, 6, 2, 10);

    // Glowing Orange/Red Visor Slit (Ashen / Cinder inner fire)
    ctx.fillStyle = '#ff6a00';
    ctx.shadowColor = '#ff4400';
    ctx.shadowBlur = 6;
    ctx.fillRect(21, 13, 6, 2);
    ctx.fillStyle = '#fff0a0';
    ctx.fillRect(22, 13.5, 4, 1);
    ctx.shadowBlur = 0; // Reset shadow

    canvas.refresh();
  }

  // Bonfire with Coiled Sword (48x48)
  createBonfireTexture() {
    const canvas = this.textures.createCanvas('bonfire', 48, 48);
    const ctx = canvas.getContext();

    // Ash pile base
    ctx.fillStyle = '#1e1c22';
    ctx.beginPath();
    ctx.ellipse(24, 38, 20, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glowing coals in ash
    ctx.fillStyle = '#e64a19';
    ctx.fillRect(16, 36, 16, 4);
    ctx.fillStyle = '#ffb300';
    ctx.fillRect(20, 37, 8, 2);

    // Coiled Sword twisted blade
    ctx.fillStyle = '#786e68';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(24, 10);
    ctx.lineTo(26, 18);
    ctx.lineTo(22, 26);
    ctx.lineTo(25, 36);
    ctx.stroke();

    // Coiled sword hilt
    ctx.fillStyle = '#bfa157';
    ctx.fillRect(20, 10, 8, 2);
    ctx.fillRect(23, 6, 2, 4);

    // Small flame aura
    const flameGrad = ctx.createRadialGradient(24, 28, 2, 24, 28, 14);
    flameGrad.addColorStop(0, 'rgba(255, 230, 100, 0.9)');
    flameGrad.addColorStop(0.4, 'rgba(255, 100, 20, 0.6)');
    flameGrad.addColorStop(1, 'rgba(255, 50, 0, 0)');
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.arc(24, 28, 14, 0, Math.PI * 2);
    ctx.fill();

    canvas.refresh();
  }

  // Ember Particle (Single glowing cinder spark)
  createEmberTexture() {
    const canvas = this.textures.createCanvas('ember_spark', 8, 8);
    const ctx = canvas.getContext();

    const grad = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, '#ffaa33');
    grad.addColorStop(0.8, '#ff3300');
    grad.addColorStop(1, 'rgba(200, 20, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(4, 4, 4, 0, Math.PI * 2);
    ctx.fill();

    canvas.refresh();
  }

  // Dust Puff Particle
  createDustTexture() {
    const canvas = this.textures.createCanvas('dust_puff', 16, 16);
    const ctx = canvas.getContext();

    const grad = ctx.createRadialGradient(8, 8, 1, 8, 8, 8);
    grad.addColorStop(0, 'rgba(150, 135, 120, 0.5)');
    grad.addColorStop(0.6, 'rgba(100, 90, 80, 0.25)');
    grad.addColorStop(1, 'rgba(50, 45, 40, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(8, 8, 8, 0, Math.PI * 2);
    ctx.fill();

    canvas.refresh();
  }

  // Radial Darkness Light Mask (Dark Souls 3 dynamic torchlight)
  createLightTexture() {
    const canvas = this.textures.createCanvas('light_mask', 512, 512);
    const ctx = canvas.getContext();

    const grad = ctx.createRadialGradient(256, 256, 40, 256, 256, 256);
    grad.addColorStop(0, 'rgba(255, 235, 200, 1)');
    grad.addColorStop(0.3, 'rgba(255, 180, 100, 0.85)');
    grad.addColorStop(0.65, 'rgba(180, 90, 40, 0.35)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    canvas.refresh();
  }

  // Greatsword Sweeping Slash Arc Texture (96x96)
  createSlashTexture() {
    const canvas = this.textures.createCanvas('slash_arc', 96, 96);
    const ctx = canvas.getContext();

    // Center of sweep on the left edge
    const ox = 20;
    const oy = 48;
    const rOuter = 70;
    const rInner = 26;
    const startAngle = -Math.PI * 0.32;
    const endAngle = Math.PI * 0.32;

    // Glowing blade sweep gradient
    const grad = ctx.createRadialGradient(ox, oy, rInner, ox, oy, rOuter);
    grad.addColorStop(0, 'rgba(255, 240, 200, 0.05)');
    grad.addColorStop(0.45, 'rgba(200, 210, 240, 0.5)');
    grad.addColorStop(0.85, 'rgba(255, 255, 255, 0.9)');
    grad.addColorStop(1, 'rgba(255, 180, 70, 0.95)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ox, oy, rOuter, startAngle, endAngle, false);
    ctx.arc(ox, oy, rInner, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fill();

    // Razor-sharp incandescent outer edge
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ff8800';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(ox, oy, rOuter - 1, startAngle, endAngle);
    ctx.stroke();

    // Secondary inner motion streak
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(ox, oy, rOuter - 9, startAngle * 0.8, endAngle * 0.8);
    ctx.stroke();

    canvas.refresh();
  }

  // Hollow Knight / Cursed Wanderer Enemy Texture (48x48)
  createEnemyKnightTexture() {
    const canvas = this.textures.createCanvas('enemy_hollow_knight', 48, 48);
    const ctx = canvas.getContext();

    // Dark shadow underneath enemy
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.ellipse(24, 40, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Slit ragged crimson / cursed cape
    ctx.fillStyle = '#3b0b12';
    ctx.beginPath();
    ctx.moveTo(15, 18);
    ctx.lineTo(33, 18);
    ctx.lineTo(37, 43);
    ctx.lineTo(24, 39);
    ctx.lineTo(11, 43);
    ctx.closePath();
    ctx.fill();

    // Rusted dark iron greaves (legs)
    ctx.fillStyle = '#2a2228';
    ctx.fillRect(17, 32, 6, 10);
    ctx.fillRect(25, 32, 6, 10);

    // Spiked heavy sabatons (feet)
    ctx.fillStyle = '#1c151b';
    ctx.fillRect(16, 40, 7, 3);
    ctx.fillRect(25, 40, 7, 3);

    // Blackened plate armor with bloodstains
    const armorGrad = ctx.createLinearGradient(16, 18, 32, 32);
    armorGrad.addColorStop(0, '#423640');
    armorGrad.addColorStop(0.5, '#2c222a');
    armorGrad.addColorStop(1, '#1a1318');
    ctx.fillStyle = armorGrad;
    ctx.fillRect(15, 18, 18, 14);

    // Jagged pauldrons (heavy spiked shoulder guards)
    ctx.fillStyle = '#3a2d36';
    ctx.beginPath();
    ctx.arc(13, 20, 6, 0, Math.PI * 2);
    ctx.arc(35, 20, 6, 0, Math.PI * 2);
    ctx.fill();

    // Rusted Broadsword
    ctx.fillStyle = '#161317';
    ctx.fillRect(33, 6, 4, 30); // Blade
    ctx.fillStyle = '#991b1b'; // Crimson cursed blood rune down fuller
    ctx.fillRect(34.5, 8, 1, 26);
    ctx.fillStyle = '#5c4533'; // Rusted crossguard
    ctx.fillRect(30, 24, 10, 2.5);
    ctx.fillStyle = '#222'; // Grip
    ctx.fillRect(34, 26.5, 2, 7);

    // Horned Skull / Executioner Helm
    ctx.fillStyle = '#332731';
    ctx.beginPath();
    ctx.arc(24, 13, 8.5, 0, Math.PI * 2);
    ctx.fill();

    // Horns / crest spikes
    ctx.fillStyle = '#4a3847';
    ctx.beginPath();
    ctx.moveTo(17, 10);
    ctx.lineTo(13, 3);
    ctx.lineTo(19, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(31, 10);
    ctx.lineTo(35, 3);
    ctx.lineTo(29, 7);
    ctx.fill();

    // Menacing glowing crimson red eyes (Souls hollow fury)
    ctx.fillStyle = '#ff1a1a';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 8;
    ctx.fillRect(20, 12, 3, 2);
    ctx.fillRect(25, 12, 3, 2);
    ctx.fillStyle = '#ffcccc';
    ctx.fillRect(21, 12.5, 1.5, 1);
    ctx.fillRect(26, 12.5, 1.5, 1);
    ctx.shadowBlur = 0;

    canvas.refresh();
  }

  // Enemy Crimson Cleave Slash Arc Texture (80x80)
  createEnemySlashTexture() {
    const canvas = this.textures.createCanvas('enemy_slash_arc', 80, 80);
    const ctx = canvas.getContext();

    const ox = 16;
    const oy = 40;
    const rOuter = 58;
    const rInner = 20;
    const startAngle = -Math.PI * 0.32;
    const endAngle = Math.PI * 0.32;

    const grad = ctx.createRadialGradient(ox, oy, rInner, ox, oy, rOuter);
    grad.addColorStop(0, 'rgba(255, 30, 30, 0.05)');
    grad.addColorStop(0.5, 'rgba(180, 20, 20, 0.55)');
    grad.addColorStop(0.85, 'rgba(255, 50, 50, 0.85)');
    grad.addColorStop(1, 'rgba(255, 120, 120, 0.95)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ox, oy, rOuter, startAngle, endAngle, false);
    ctx.arc(ox, oy, rInner, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#ff3333';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(ox, oy, rOuter - 1, startAngle, endAngle);
    ctx.stroke();

    canvas.refresh();
  }

  // Cursed Wraith / Ghost Enemy Texture (48x48) with Eerie Glowing Red Eyes
  createGhostTexture() {
    const canvas = this.textures.createCanvas('ghost_wraith', 48, 48);
    const ctx = canvas.getContext();

    // Soft spectral glow behind ghost
    const auraGrad = ctx.createRadialGradient(24, 22, 6, 24, 22, 22);
    auraGrad.addColorStop(0, 'rgba(80, 110, 140, 0.35)');
    auraGrad.addColorStop(0.6, 'rgba(40, 50, 80, 0.15)');
    auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(24, 22, 22, 0, Math.PI * 2);
    ctx.fill();

    // Floating ethereal shroud / ragged spirit cowl
    const ghostGrad = ctx.createLinearGradient(14, 8, 34, 44);
    ghostGrad.addColorStop(0, 'rgba(150, 175, 205, 0.82)');
    ghostGrad.addColorStop(0.4, 'rgba(95, 120, 150, 0.7)');
    ghostGrad.addColorStop(0.8, 'rgba(45, 60, 85, 0.45)');
    ghostGrad.addColorStop(1, 'rgba(20, 30, 50, 0)');

    ctx.fillStyle = ghostGrad;
    ctx.beginPath();
    // Hood top
    ctx.arc(24, 15, 11, Math.PI, 0, false);
    // Right flowing wisp
    ctx.quadraticCurveTo(37, 24, 34, 38);
    ctx.lineTo(31, 44);
    ctx.lineTo(27, 39);
    // Center wisp
    ctx.lineTo(24, 46);
    ctx.lineTo(21, 39);
    // Left flowing wisp
    ctx.lineTo(17, 44);
    ctx.quadraticCurveTo(11, 24, 13, 15);
    ctx.closePath();
    ctx.fill();

    // Inner shadow of the hood
    ctx.fillStyle = 'rgba(8, 10, 16, 0.95)';
    ctx.beginPath();
    ctx.ellipse(24, 16, 7.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Spectral skeletal claws hovering forward
    ctx.strokeStyle = 'rgba(190, 215, 235, 0.75)';
    ctx.lineWidth = 1.5;
    // Left claw fingers
    ctx.beginPath();
    ctx.moveTo(14, 25);
    ctx.lineTo(11, 30);
    ctx.lineTo(8, 33);
    ctx.moveTo(15, 26);
    ctx.lineTo(13, 32);
    ctx.moveTo(16, 27);
    ctx.lineTo(15, 33);
    ctx.stroke();

    // Right claw fingers
    ctx.beginPath();
    ctx.moveTo(34, 25);
    ctx.lineTo(37, 30);
    ctx.lineTo(40, 33);
    ctx.moveTo(33, 26);
    ctx.lineTo(35, 32);
    ctx.moveTo(32, 27);
    ctx.lineTo(33, 33);
    ctx.stroke();

    // Piercing Glowing RED EYES (Souls Specter)
    ctx.fillStyle = '#ff1111';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 10;
    // Left eye
    ctx.beginPath();
    ctx.arc(21, 15, 2.2, 0, Math.PI * 2);
    ctx.fill();
    // Right eye
    ctx.beginPath();
    ctx.arc(27, 15, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Intense hot core of red eyes
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.arc(21, 15, 0.8, 0, Math.PI * 2);
    ctx.arc(27, 15, 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; // Reset

    canvas.refresh();
  }

  // Ghost Spectral Crimson Claw Attack (64x64)
  createGhostClawTexture() {
    const canvas = this.textures.createCanvas('ghost_claw', 64, 64);
    const ctx = canvas.getContext();

    // 3 sharp slashing claw trails
    const claws = [
      { startX: 10, startY: 14, cpX: 30, cpY: 28, endX: 54, endY: 22 },
      { startX: 12, startY: 24, cpX: 32, cpY: 38, endX: 56, endY: 34 },
      { startX: 16, startY: 34, cpX: 34, cpY: 48, endX: 52, endY: 46 },
    ];

    claws.forEach(c => {
      // Red glow trail
      ctx.strokeStyle = '#ff1133';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ff0033';
      ctx.shadowBlur = 7;
      ctx.beginPath();
      ctx.moveTo(c.startX, c.startY);
      ctx.quadraticCurveTo(c.cpX, c.cpY, c.endX, c.endY);
      ctx.stroke();

      // Sharp white hot core
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(c.startX + 2, c.startY + 1);
      ctx.quadraticCurveTo(c.cpX, c.cpY, c.endX - 2, c.endY);
      ctx.stroke();
    });

    canvas.refresh();
  }

  // Open Dungeon Hatch / Stone Trapdoor with Descending Stairs (110x120)
  createOpenHatchTexture() {
    const canvas = this.textures.createCanvas('open_hatch', 110, 120);
    const ctx = canvas.getContext();

    // Dark stone pit background
    ctx.fillStyle = '#08060b';
    ctx.fillRect(8, 12, 94, 98);

    // Stone steps descending down into deep darkness
    const steps = [
      { y: 16, h: 18, color: '#38303e', highlight: '#544b5c' },
      { y: 34, h: 18, color: '#2b2430', highlight: '#413849' },
      { y: 52, h: 18, color: '#1f1a23', highlight: '#302837' },
      { y: 70, h: 18, color: '#141018', highlight: '#221b27' },
      { y: 88, h: 22, color: '#09070c', highlight: '#17121b' },
    ];

    steps.forEach((st, i) => {
      ctx.fillStyle = st.color;
      ctx.fillRect(14 + i * 4, st.y, 82 - i * 8, st.h);

      // Step edge highlight
      ctx.fillStyle = st.highlight;
      ctx.fillRect(14 + i * 4, st.y, 82 - i * 8, 2);
    });

    // Golden torchlight aura rising from the subterranean depth
    const depthGlow = ctx.createRadialGradient(55, 95, 4, 55, 70, 50);
    depthGlow.addColorStop(0, 'rgba(255, 170, 40, 0.6)');
    depthGlow.addColorStop(0.5, 'rgba(210, 110, 20, 0.3)');
    depthGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = depthGlow;
    ctx.fillRect(10, 20, 90, 90);

    // Heavy carved stone border frame around pit
    ctx.strokeStyle = '#473d4e';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 12, 94, 98);

    // Brass corner braces
    ctx.fillStyle = '#c49a45';
    ctx.fillRect(6, 10, 10, 6);
    ctx.fillRect(94, 10, 10, 6);
    ctx.fillRect(6, 104, 10, 6);
    ctx.fillRect(94, 104, 10, 6);

    // Heavy wooden door swung open against the wall (tilted perspective)
    ctx.fillStyle = '#4a2f1c';
    ctx.fillRect(2, 6, 12, 106);
    ctx.fillStyle = '#2e1c0f';
    ctx.fillRect(14, 8, 4, 102);

    // Iron hinges on the door
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 24, 16, 5);
    ctx.fillRect(0, 84, 16, 5);

    // Iron ring handle
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(8, 54, 4, 0, Math.PI * 2);
    ctx.stroke();

    canvas.refresh();
  }

  // Stone crack fissure and dust shockwave on colossal hammer ground impact
  createHammerShockwaveTexture() {
    const canvas = this.textures.createCanvas('hammer_shockwave', 96, 96);
    const ctx = canvas.getContext();

    // Radial gold/ember impact glow
    const grad = ctx.createRadialGradient(48, 48, 8, 48, 48, 46);
    grad.addColorStop(0, 'rgba(255, 230, 160, 0.9)');
    grad.addColorStop(0.35, 'rgba(230, 140, 40, 0.65)');
    grad.addColorStop(0.7, 'rgba(120, 60, 20, 0.35)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(48, 48, 46, 0, Math.PI * 2);
    ctx.fill();

    // Heavy jagged stone fractures
    ctx.strokeStyle = '#fff5d0';
    ctx.lineWidth = 2.5;
    const crackAngles = [0, 45, 90, 135, 180, 225, 270, 315];
    crackAngles.forEach((deg, idx) => {
      const rad = deg * (Math.PI / 180);
      ctx.beginPath();
      ctx.moveTo(48, 48);
      const midR = 20 + ((idx % 2 === 0) ? 6 : -4);
      const midX = 48 + Math.cos(rad + 0.15) * midR;
      const midY = 48 + Math.sin(rad + 0.15) * midR;
      ctx.lineTo(midX, midY);
      const endR = 38 + ((idx % 3 === 0) ? 6 : -3);
      ctx.lineTo(48 + Math.cos(rad - 0.12) * endR, 48 + Math.sin(rad - 0.12) * endR);
      ctx.stroke();
    });

    canvas.refresh();
  }
}
