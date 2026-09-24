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

    // Vial of Blood slot positioned directly under stamina bar (drink_flask on [Q])
    this.estusContainer = this.scene.add.container(75, 129);
    this.estusContainer.setScrollFactor(0);
    this.estusContainer.setDepth(1001);

    this.estusBox = this.scene.add.graphics();
    this.drawFlaskBox(false);
    this.estusContainer.add(this.estusBox);

    // Large Vial of Blood Sprite (128x128 scaled to ~83px)
    this.flaskImage = this.scene.add.image(0, -1, 'flask_red');
    this.flaskImage.setScale(0.65);
    this.estusContainer.add(this.flaskImage);

    // Keycap badge '[Q]' at top-left
    this.keyBadge = this.scene.add.text(-30, -32, '[Q]', {
      fontFamily: 'Cinzel, serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#f5efe6',
      stroke: '#000000',
      strokeThickness: 3,
    });
    this.estusContainer.add(this.keyBadge);

    // Charges count in bottom-right (large 22px bold)
    this.estusCountText = this.scene.add.text(18, 14, '3', {
      fontFamily: 'Cinzel, serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    });
    this.estusContainer.add(this.estusCountText);

    // Vial of Blood title underneath
    this.estusLabel = this.scene.add.text(0, 50, 'VIAL OF BLOOD', {
      fontFamily: 'Cinzel, serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#e2d3af',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0);
    this.estusContainer.add(this.estusLabel);

    // Resize listener to keep HUD anchored
    this.scene.scale.on('resize', (gameSize) => {
      this.soulContainer.setPosition(gameSize.width - 180, gameSize.height - 48);
      this.estusContainer.setPosition(75, 129);
    });
  }

  drawFlaskBox(isEmpty = false) {
    this.estusBox.clear();
    // Outer shadow / dark backdrop
    this.estusBox.fillStyle(0x070509, 0.92);
    this.estusBox.fillRoundedRect(-43, -43, 86, 86, 10);

    // Ornate metallic frame
    const borderColor = isEmpty ? 0x5a4444 : 0xc99e3a;
    this.estusBox.lineStyle(2.4, borderColor, 0.95);
    this.estusBox.strokeRoundedRect(-43, -43, 86, 86, 10);

    // Inner subtle crimson/gold trim
    if (!isEmpty) {
      this.estusBox.lineStyle(1.0, 0xef233c, 0.45);
      this.estusBox.strokeRoundedRect(-38, -38, 76, 76, 8);
    }
  }

  pulseFlask() {
    if (!this.estusContainer) return;
    this.scene.tweens.add({
      targets: this.estusContainer,
      scaleX: { from: 1.3, to: 1.0 },
      scaleY: { from: 1.3, to: 1.0 },
      duration: 350,
      ease: 'Back.easeOut',
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

    // Update Souls Text dynamically
    if (player.souls !== undefined) {
      this.soulText.setText(player.souls.toLocaleString());
    }

    // Update Flask Count & visuals dynamically
    const charges = (player.flaskCharges !== undefined) ? player.flaskCharges : 0;
    this.estusCountText.setText(charges.toString());

    if (charges <= 0) {
      if (this.flaskImage.texture.key !== 'flask_red_empty') {
        this.flaskImage.setTexture('flask_red_empty');
        this.flaskImage.setAlpha(0.4);
        this.drawFlaskBox(true);
      }
      this.estusCountText.setColor('#ef4444');
      this.estusLabel.setColor('#777777');
    } else {
      if (this.flaskImage.texture.key !== 'flask_red') {
        this.flaskImage.setTexture('flask_red');
        this.flaskImage.setAlpha(1.0);
        this.drawFlaskBox(false);
      }
      this.estusCountText.setColor('#ffffff');
      this.estusLabel.setColor('#d4af37');
    }
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
