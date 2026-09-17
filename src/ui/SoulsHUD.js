import Phaser from 'phaser';

export default class SoulsHUD {
  constructor(scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.graphics.setScrollFactor(0);
    this.graphics.setDepth(1000);

    // Create HUD texts
    this.createHUDTexts();
  }

  createHUDTexts() {
    // Soul counter in bottom right
    this.soulContainer = this.scene.add.container(
      this.scene.cameras.main.width - 180,
      this.scene.cameras.main.height - 48
    );
    this.soulContainer.setScrollFactor(0);
    this.soulContainer.setDepth(1001);

    // Soul Icon (stylized radiant diamond)
    const soulGfx = this.scene.add.graphics();
    soulGfx.fillStyle(0xd4af37, 0.9);
    soulGfx.beginPath();
    soulGfx.moveTo(0, -10);
    soulGfx.lineTo(8, 0);
    soulGfx.lineTo(0, 10);
    soulGfx.lineTo(-8, 0);
    soulGfx.closePath();
    soulGfx.fill();

    soulGfx.fillStyle(0xfff3a0, 0.9);
    soulGfx.fillCircle(0, 0, 3);
    this.soulContainer.add(soulGfx);

    // Soul text
    this.soulText = this.scene.add.text(20, -10, '2,450', {
      fontFamily: 'Cinzel, serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#e2d3af',
      stroke: '#000000',
      strokeThickness: 3,
    });
    this.soulContainer.add(this.soulText);

    // Bottom Left Estus Flask slot
    this.estusContainer = this.scene.add.container(48, this.scene.cameras.main.height - 56);
    this.estusContainer.setScrollFactor(0);
    this.estusContainer.setDepth(1001);

    const estusBox = this.scene.add.graphics();
    // Diamond frame
    estusBox.lineStyle(1.5, 0x9b783e, 0.8);
    estusBox.fillStyle(0x0e0c10, 0.75);
    estusBox.strokeRect(-18, -18, 36, 36);
    estusBox.fillRect(-18, -18, 36, 36);

    // Estus liquid indicator
    estusBox.fillStyle(0xf59e0b, 0.85);
    estusBox.fillRoundedRect(-10, -8, 20, 20, 3);
    this.estusContainer.add(estusBox);

    this.estusCountText = this.scene.add.text(8, 6, '5', {
      fontFamily: 'Cinzel, serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#fff',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.estusContainer.add(this.estusCountText);

    this.estusLabel = this.scene.add.text(-20, 24, 'Estus Flask', {
      fontFamily: 'Cinzel, serif',
      fontSize: '11px',
      color: '#b0a495',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.estusContainer.add(this.estusLabel);

    // Resize listener to keep HUD anchored
    this.scene.scale.on('resize', (gameSize) => {
      this.soulContainer.setPosition(gameSize.width - 180, gameSize.height - 48);
      this.estusContainer.setPosition(48, gameSize.height - 56);
    });
  }

  update(player) {
    this.graphics.clear();

    const startX = 32;
    const startY = 32;

    // HP Bar (Crimson Red)
    const hpMaxW = 260;
    const hpRatio = Phaser.Math.Clamp(player.health / player.maxHealth, 0, 1);
    this.drawSoulsBar(startX, startY, hpMaxW, 14, hpRatio, 0x8b1818, 0xbf2a2a);

    // FP Bar (Cobalt Blue)
    const fpMaxW = 190;
    const fpRatio = 1.0;
    this.drawSoulsBar(startX, startY + 18, fpMaxW, 9, fpRatio, 0x1d4ed8, 0x3b82f6);

    // Stamina Bar (Viridian Green)
    const staMaxW = 210;
    const staRatio = Phaser.Math.Clamp(player.stamina / player.maxStamina, 0, 1);
    this.drawSoulsBar(startX, startY + 31, staMaxW, 10, staRatio, 0x15803d, 0x22c55e);
  }

  drawSoulsBar(x, y, maxWidth, height, ratio, darkColor, lightColor) {
    const barWidth = maxWidth * ratio;

    // Outer shadow / dark backing
    this.graphics.fillStyle(0x0a080d, 0.85);
    this.graphics.fillRect(x - 2, y - 2, maxWidth + 4, height + 4);

    // Background empty slot
    this.graphics.fillStyle(0x231e28, 0.7);
    this.graphics.fillRect(x, y, maxWidth, height);

    if (barWidth > 0) {
      // Main Bar fill
      this.graphics.fillStyle(darkColor, 0.95);
      this.graphics.fillRect(x, y, barWidth, height);

      // Gradient top highlight
      this.graphics.fillStyle(lightColor, 0.85);
      this.graphics.fillRect(x, y, barWidth, Math.max(2, Math.floor(height * 0.4)));

      // Subtle bright edge glow
      this.graphics.fillStyle(0xffffff, 0.25);
      this.graphics.fillRect(x, y, barWidth, 1);
    }

    // Classic Soulsborne metallic border
    this.graphics.lineStyle(1.5, 0x7c694a, 0.8);
    this.graphics.strokeRect(x - 1, y - 1, maxWidth + 2, height + 2);
  }

  destroy() {
    this.graphics.destroy();
    this.soulContainer.destroy();
    this.estusContainer.destroy();
  }
}
