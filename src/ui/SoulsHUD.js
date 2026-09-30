import Phaser from 'phaser';
import audioManager from '../utils/AudioManager.js';

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

    // Active Weapon slot positioned next to the Vial of Blood
    this.weaponContainer = this.scene.add.container(175, 129);
    this.weaponContainer.setScrollFactor(0);
    this.weaponContainer.setDepth(1001);

    this.weaponBox = this.scene.add.graphics();
    this.drawWeaponBox(0xc99e3a);
    this.weaponContainer.add(this.weaponBox);

    this.weaponImage = this.scene.add.image(0, -2, 'hammer');
    this.weaponImage.setScale(1.9);
    this.weaponContainer.add(this.weaponImage);

    // Keycap badge '[F1-F5]'
    this.weaponKeyBadge = this.scene.add.text(-36, -34, '[F1-F5]', {
      fontFamily: 'Cinzel, serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#f5efe6',
      stroke: '#000000',
      strokeThickness: 3,
    });
    this.weaponContainer.add(this.weaponKeyBadge);

    // Damage indicator
    this.weaponDmgText = this.scene.add.text(36, 18, '48 DMG', {
      fontFamily: 'Cinzel, serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#f59e0b',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(1, 0);
    this.weaponContainer.add(this.weaponDmgText);

    // Weapon title underneath
    this.weaponLabel = this.scene.add.text(0, 50, 'WARHAMMER', {
      fontFamily: 'Cinzel, serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#e2d3af',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0);
    this.weaponContainer.add(this.weaponLabel);

    // Audio status & toggle button in top right
    this.createAudioToggle();

    // Resize listener to keep HUD anchored
    this.scene.scale.on('resize', (gameSize) => {
      this.soulContainer.setPosition(gameSize.width - 180, gameSize.height - 48);
      this.estusContainer.setPosition(75, 129);
      if (this.audioContainer) {
        this.audioContainer.setPosition(gameSize.width - 105, 30);
      }
    });
  }

  createAudioToggle() {
    const startX = this.scene.cameras.main.width - 105;
    const startY = 30;

    this.audioContainer = this.scene.add.container(startX, startY);
    this.audioContainer.setScrollFactor(0);
    this.audioContainer.setDepth(1001);

    const bg = this.scene.add.graphics();
    const isBoss = () => audioManager.currentTrackKey === 'boss_music';
    const drawBg = (hover = false) => {
      bg.clear();
      const boss = isBoss();
      const bgColor = hover ? (boss ? 0x2b0f14 : 0x1f192b) : (boss ? 0x180509 : 0x090710);
      const borderColor = hover ? (boss ? 0xff4d6d : 0xd4af37) : (boss ? 0x9b1c2e : 0x7c6a46);
      bg.fillStyle(bgColor, hover ? 0.95 : 0.85);
      bg.fillRoundedRect(-65, -13, 130, 26, 6);
      bg.lineStyle(hover ? 1.6 : 1.2, borderColor, hover ? 1 : 0.85);
      bg.strokeRoundedRect(-65, -13, 130, 26, 6);
    };
    drawBg(false);
    this.audioContainer.add(bg);

    const formatText = () => {
      if (audioManager.isMuted) return '♫ [N] MUSIK: AV';
      return isBoss() ? '⚔ [N] BOSS: PÅ' : '♫ [N] MUSIK: PÅ';
    };
    const formatColor = () => {
      if (audioManager.isMuted) return '#888888';
      return isBoss() ? '#ff758f' : '#e2d3af';
    };

    this.audioText = this.scene.add.text(0, 0, formatText(), {
      fontFamily: 'Cinzel, serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: formatColor(),
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.audioContainer.add(this.audioText);

    this.audioContainer.setSize(130, 26);
    this.audioContainer.setInteractive({ useHandCursor: true });

    this.audioContainer.on('pointerdown', () => {
      audioManager.toggleMute();
    });

    this.audioContainer.on('pointerover', () => {
      drawBg(true);
    });

    this.audioContainer.on('pointerout', () => {
      drawBg(false);
    });

    audioManager.onStateChange(({ isMuted }) => {
      if (this.audioText && this.audioText.active) {
        drawBg(false);
        this.audioText.setText(formatText());
        this.audioText.setColor(formatColor());
      }
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

  drawWeaponBox(color = 0xc99e3a) {
    if (!this.weaponBox) return;
    this.weaponBox.clear();
    this.weaponBox.fillStyle(0x0e0b12, 0.90);
    this.weaponBox.fillRoundedRect(-43, -43, 86, 86, 10);

    this.weaponBox.lineStyle(2.4, color, 0.95);
    this.weaponBox.strokeRoundedRect(-43, -43, 86, 86, 10);

    this.weaponBox.lineStyle(1.0, color, 0.35);
    this.weaponBox.strokeRoundedRect(-38, -38, 76, 76, 8);
  }

  pulseWeapon() {
    if (!this.weaponContainer) return;
    this.scene.tweens.add({
      targets: this.weaponContainer,
      scaleX: { from: 1.25, to: 1.0 },
      scaleY: { from: 1.25, to: 1.0 },
      duration: 300,
      ease: 'Back.easeOut',
    });
  }

  update(player) {
    if (this.visible === false) return;
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

    // Update active weapon display
    if (player.currentWeapon && this.lastWeaponId !== player.currentWeapon.id) {
      this.lastWeaponId = player.currentWeapon.id;
      const w = player.currentWeapon;
      if (this.weaponImage) {
        this.weaponImage.setTexture(w.sprite);
        let scale = 1.7;
        if (w.id === 'hammer' || w.id === 'warhammer') scale = 1.9;
        else if (w.id === 'greatsword' || w.id === 'scimitar' || w.id === 'dagger') scale = 0.52;
        this.weaponImage.setScale(scale);
      }
      if (this.weaponDmgText) {
        if (w.statusEffect === 'burn') {
          this.weaponDmgText.setText(`${w.damage}+🔥`);
        } else {
          this.weaponDmgText.setText(`${w.damage} DMG`);
        }
        const hex = '#' + (w.slashColor || 0xf59e0b).toString(16).padStart(6, '0');
        this.weaponDmgText.setColor(hex);
      }
      if (this.weaponLabel) {
        this.weaponLabel.setText(w.name.toUpperCase());
      }
      this.drawWeaponBox(w.slashColor || 0xc99e3a);
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

  setVisible(visible) {
    this.visible = visible;
    if (this.graphics) {
      this.graphics.setVisible(visible);
      if (!visible) this.graphics.clear();
    }
    if (this.soulContainer) this.soulContainer.setVisible(visible);
    if (this.estusContainer) this.estusContainer.setVisible(visible);
    if (this.weaponContainer) this.weaponContainer.setVisible(visible);
  }

  destroy() {
    this.graphics.destroy();
    this.soulContainer.destroy();
    this.estusContainer.destroy();
    if (this.weaponContainer) {
      this.weaponContainer.destroy();
    }
  }
}
