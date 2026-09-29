import Phaser from 'phaser';

/**
 * CatNPC - Katten PUMBA
 * En fridfull, sovande orange katt i SoulsBossRoom.
 */
export default class CatNPC extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x = 1244, y = 1040, width = 40, height = 38, name = 'PUMBA') {
    super(scene, x, y, 'cat_pumba');

    this.scene = scene;
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Lite mindre storlek (width: 40, height: 38)
    this.targetWidth = width;
    this.targetHeight = height;
    this.setDisplaySize(width, height);
    this.setOrigin(0.5, 0.5);
    this.setDepth(this.y);

    // Solid fysikkropp så spelaren inte kan gå rakt igenom katten
    if (this.body) {
      this.body.setImmovable(true);
      this.body.setSize(this.width * 0.75, this.height * 0.65);
      this.body.setOffset(this.width * 0.125, this.height * 0.2);
    }

    // 1. Mjuk markskugga under katten
    if (scene.textures.exists('character_drop_shadow')) {
      this.shadow = scene.add.image(x, y + height * 0.28, 'character_drop_shadow');
      this.shadow.setDisplaySize(width * 1.1, height * 0.55);
      this.shadow.setAlpha(0.65);
      this.shadow.setDepth(this.y - 1);
    }

    // 2. Namnskylt "PUMBA" svävande ovanför katten
    this.nameTag = scene.add.text(x, y - height * 0.5 - 10, name, {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#ffd166',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(this.y + 10);

    // 3. Mjuk sovande andnings-animering
    this.baseScaleX = this.scaleX;
    this.baseScaleY = this.scaleY;

    this.scene.tweens.add({
      targets: this,
      scaleY: this.baseScaleY * 1.05,
      scaleX: this.baseScaleX * 0.98,
      duration: 1700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 4. Interaktionsprompt när spelaren är nära ("[E] Klappa Pumba")
    this.promptText = scene.add.text(x, y + height * 0.5 + 8, '[E] Klappa Pumba', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#1b120cdd',
      padding: { left: 5, right: 5, top: 2, bottom: 2 },
      stroke: '#d4a373',
      strokeThickness: 1.5,
    }).setOrigin(0.5).setDepth(this.y + 15).setVisible(false);

    // Klickbar interaktion med musen
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => this.pet());

    // Timers
    this.zzzTimer = 1.5;
    this.petCooldown = 0;
    this.petCount = 0;
  }

  update(time, delta) {
    const dt = delta / 1000;
    this.setDepth(this.y);
    if (this.shadow) this.shadow.setDepth(this.y - 1);
    if (this.nameTag) this.nameTag.setDepth(this.y + 10);
    if (this.promptText) this.promptText.setDepth(this.y + 15);

    if (this.petCooldown > 0) {
      this.petCooldown -= dt;
    }

    // Spawna svävande "z"-partiklar med jämna mellanrum
    this.zzzTimer -= dt;
    if (this.zzzTimer <= 0) {
      this.zzzTimer = Phaser.Math.FloatBetween(2.2, 3.8);
      this.spawnZzz();
    }

    // Avstånd till spelaren
    if (this.scene && this.scene.player) {
      const dist = Phaser.Math.Distance.Between(this.x, this.y, this.scene.player.x, this.scene.player.y);
      const inRange = dist < 65;

      if (this.promptText) {
        this.promptText.setVisible(inRange);
      }

      // Tryck på [E] för att klappa
      if (inRange && this.scene.keyE && Phaser.Input.Keyboard.JustDown(this.scene.keyE)) {
        this.pet();
      }
    }
  }

  /**
   * Skapar ett svävande, rofyllt "z" som stiger upp från den sovande katten
   */
  spawnZzz() {
    if (!this.scene) return;
    const offsetX = Phaser.Math.Between(6, 14);
    const offsetY = Phaser.Math.Between(-12, -4);

    const zText = this.scene.add.text(this.x + offsetX, this.y + offsetY, 'z', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '10px',
      color: '#ffdd99',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(this.y + 20).setAlpha(0.85);

    this.scene.tweens.add({
      targets: zText,
      y: zText.y - 24,
      x: zText.x + Phaser.Math.Between(3, 8),
      alpha: 0,
      scale: 1.3,
      duration: 2200,
      ease: 'Quad.easeOut',
      onComplete: () => {
        zText.destroy();
      },
    });
  }

  /**
   * Spelaren klappar Pumba!
   */
  pet() {
    if (this.petCooldown > 0) return;
    this.petCooldown = 0.8;
    this.petCount++;

    // Liten mysig sträcknings-/kurr-tween
    this.scene.tweens.add({
      targets: this,
      scaleY: this.baseScaleY * 1.12,
      scaleX: this.baseScaleX * 1.08,
      duration: 220,
      yoyo: true,
      ease: 'Back.easeOut',
    });

    // Skapa svävande hjärtan ♥
    for (let i = 0; i < 4; i++) {
      const heart = this.scene.add.text(
        this.x + Phaser.Math.Between(-14, 14),
        this.y - Phaser.Math.Between(8, 16),
        '♥',
        {
          fontSize: `${Phaser.Math.Between(12, 15)}px`,
          color: '#ff6b8b',
          stroke: '#4a0e1c',
          strokeThickness: 2,
        }
      ).setOrigin(0.5).setDepth(this.y + 30);

      this.scene.tweens.add({
        targets: heart,
        y: heart.y - Phaser.Math.Between(22, 38),
        x: heart.x + Phaser.Math.Between(-12, 12),
        alpha: 0,
        scale: 1.35,
        duration: 1000 + i * 180,
        ease: 'Cubic.easeOut',
        onComplete: () => heart.destroy(),
      });
    }

    // Läk spelaren lite vid kel (+10 HP)
    if (this.scene.player && this.scene.player.health < this.scene.player.maxHealth) {
      this.scene.player.health = Math.min(this.scene.player.maxHealth, this.scene.player.health + 10);
    }

    // Observera: Ingen popup-textruta visas efter [E] enligt användarens önskemål!
  }

  destroy(fromScene) {
    if (this.shadow) this.shadow.destroy();
    if (this.nameTag) this.nameTag.destroy();
    if (this.promptText) this.promptText.destroy();
    super.destroy(fromScene);
  }
}
