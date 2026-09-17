import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    // Generate all game textures procedurally for a rich Dark Souls 3 aesthetic
    this.createFloorTexture();
    this.createPillarTexture();
    this.createWallTexture();
    this.createKnightTexture();
    this.createBonfireTexture();
    this.createEmberTexture();
    this.createDustTexture();
    this.createLightTexture();

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
}
