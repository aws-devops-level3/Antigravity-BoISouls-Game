import Phaser from 'phaser';

/**
 * =========================================================================
 * KONVERSATION MED GREG THE GRAVEKEEPER:
 * Här kan du enkelt redigera, lägga till eller ta bort repliker i dialogen!
 * =========================================================================
 */
export const GREG_DIALOGUE = [
  "... Blasted fanatics.. Even in death these poor souls would not find peace",
  "Huh? Ohh, a traveller... Greetings to you... I am Greg, Greg the Gravekeeper.",
  "This here is my cemetery... or well it was, before those maniacs performed some wicked incantation that twisted these poor souls into these monstrosities. Even death is not sacred to these ''priests''...",
  "And as if that was not enough, they burned down my humble home just north of here",
  "There's an old chest of mine amongst the charred remains of my home... Take the contents of the chest for youself, I no longer have need of it..."
];

/**
 * GravekeeperNPC - GREG THE GRAVEKEEPER
 * En vänlig, gammal gravvårdare som sitter på kyrkogården (CemeterySouls).
 */
export default class GravekeeperNPC extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x = 522, y = 732, width = 80, height = 55, name = 'GREG THE GRAVEKEEPER') {
    // Säkerställ att textur finns även vid direkt inhopp
    if (!scene.textures.exists('greg_gravekeeper')) {
      scene.load.image('greg_gravekeeper', '/assets/greg_gravekeeper.png');
      scene.load.once('filecomplete-image-greg_gravekeeper', () => {
        this.setTexture('greg_gravekeeper');
      });
      scene.load.start();
    }

    super(scene, x, y, scene.textures.exists('greg_gravekeeper') ? 'greg_gravekeeper' : 'chicken_npc');

    this.scene = scene;
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.targetWidth = width;
    this.targetHeight = height;
    this.setDisplaySize(width, height);
    this.setOrigin(0.5, 0.5);
    this.setDepth(this.y);

    // Subtilt vitt ljus runtom kanterna (PreFX / PostFX GPU-shader) så han syns tydligt i mörkret
    if (this.preFX) {
      this.glowFX = this.preFX.addGlow(0xffffff, 2.0, 0, false, 0.22, 6);
    } else if (this.postFX) {
      this.glowFX = this.postFX.addGlow(0xffffff, 2.0, 0, false, 0.22, 6);
    }

    // Solid fysikkropp så spelaren inte kan gå rakt igenom Greg
    if (this.body) {
      this.body.setImmovable(true);
      this.body.setSize(this.width * 0.72, this.height * 0.55);
      this.body.setOffset(this.width * 0.14, this.height * 0.35);
    }

    // 1. Mjuk markskugga under Greg
    this.shadow = scene.add.ellipse(x, y + height * 0.40, width * 0.90, 14, 0x000000, 0.55);
    this.shadow.setDepth(Math.max(1, this.y - 2));

    // 1b. Mjukt vitt bakomliggande sken som lyfter fram Gregs siluett i kyrkogårdens mörker
    this.backingGlow = scene.add.ellipse(x, y + 2, width + 8, height + 6, 0xffffff, 0.20);
    this.backingGlow.setDepth(Math.max(1, this.y - 1));
    this.backingGlow.setBlendMode(Phaser.BlendModes.ADD);

    scene.tweens.add({
      targets: this.backingGlow,
      alpha: { from: 0.14, to: 0.26 },
      scale: { from: 0.95, to: 1.06 },
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 1c. Liten stämningsfull lyktglöd/ljusglöd vid Gregs sida
    this.lanternGlow = scene.add.ellipse(x - width * 0.36, y + height * 0.26, 26, 18, 0xffaa44, 0.28);
    this.lanternGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.lanternGlow.setDepth(Math.max(1, this.y - 1));

    scene.tweens.add({
      targets: this.lanternGlow,
      alpha: { from: 0.16, to: 0.38 },
      scale: { from: 0.92, to: 1.14 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 2. Namnskylt "GREG THE GRAVEKEEPER" svävande ovanför huvudet
    this.npcName = name;
    this.nameTag = scene.add.text(x, y - height * 0.5 - 13, name, {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '11px',
      fontStyle: 'bold',
      letterSpacing: 2,
      color: '#ffd166',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(this.y + 10);

    // 3. Mjuk andnings-animering (subtil top-down idle)
    this.baseScaleX = this.scaleX;
    this.baseScaleY = this.scaleY;

    this.scene.tweens.add({
      targets: this,
      scaleY: this.baseScaleY * 1.04,
      scaleX: this.baseScaleX * 0.98,
      duration: 2100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 4. Interaktionsprompt när spelaren är nära ("[E] Prata med Greg")
    this.promptText = scene.add.text(x, y + height * 0.5 + 8, '[E] Prata med Greg', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#16121add',
      padding: { left: 6, right: 6, top: 3, bottom: 3 },
      stroke: '#d4af37',
      strokeThickness: 1.5,
    }).setOrigin(0.5).setDepth(this.y + 15).setVisible(false);

    // Klickbar musinteraktion
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => this.talk());

    // Konversationshantering
    this.dialogueLines = [...GREG_DIALOGUE];
    this.currentDialogueIndex = 0;
    this.isTalking = false;
    this.dialogueContainer = null;
    this.talkCooldown = 0;
  }

  update(time, delta) {
    const dt = delta / 1000;
    this.setDepth(this.y);
    if (this.shadow) this.shadow.setDepth(Math.max(1, this.y - 2));
    if (this.backingGlow) this.backingGlow.setDepth(Math.max(1, this.y - 1));
    if (this.lanternGlow) this.lanternGlow.setDepth(Math.max(1, this.y - 1));
    if (this.nameTag) this.nameTag.setDepth(this.y + 10);
    if (this.promptText) this.promptText.setDepth(this.y + 15);

    if (this.talkCooldown > 0) {
      this.talkCooldown -= dt;
    }

    // Avstånd till spelaren
    if (this.scene && this.scene.player) {
      const dist = Phaser.Math.Distance.Between(this.x, this.y, this.scene.player.x, this.scene.player.y);
      const inRange = dist < 70;

      if (this.promptText) {
        this.promptText.setVisible(inRange && !this.isTalking);
      }

      // Om spelaren går för långt bort under ett samtal, stäng dialogen mjukt
      if (!inRange && this.isTalking) {
        this.closeDialogue();
      }

      // Tryck på [E] för att prata
      if (inRange && this.scene.keyE && Phaser.Input.Keyboard.JustDown(this.scene.keyE)) {
        this.talk();
      }
    }
  }

  /**
   * Startar eller stegar framåt i konversationen med Greg.
   */
  talk() {
    if (this.talkCooldown > 0) return;
    this.talkCooldown = 0.25;

    if (!this.isTalking) {
      this.openDialogue();
    } else {
      this.advanceDialogue();
    }
  }

  /**
   * Öppnar den gotiska dialogrutan i Dark Souls-stil.
   */
  openDialogue() {
    this.isTalking = true;
    this.currentDialogueIndex = 0;
    if (this.promptText) this.promptText.setVisible(false);

    const cam = this.scene.cameras.main;
    const width = cam.width;
    const height = cam.height;

    if (this.dialogueContainer) {
      this.dialogueContainer.destroy();
    }

    const container = this.scene.add.container(0, 0);
    container.setScrollFactor(0);
    container.setDepth(25000);
    this.dialogueContainer = container;

    // Räckvidd och storlek på dialogboxen
    const boxW = Math.min(width * 0.88, 620);
    const boxH = 110;
    const boxX = width / 2;
    const boxY = height - 90;

    // Bakgrund i mörk pergament / sotad obsidian
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0810, 0.94);
    bg.fillRoundedRect(boxX - boxW / 2, boxY - boxH / 2, boxW, boxH, 6);
    bg.lineStyle(1.8, 0x8c7853, 0.9);
    bg.strokeRoundedRect(boxX - boxW / 2, boxY - boxH / 2, boxW, boxH, 6);

    // Inre guldram
    bg.lineStyle(0.8, 0x4a3f32, 0.6);
    bg.strokeRoundedRect(boxX - boxW / 2 + 4, boxY - boxH / 2 + 4, boxW - 8, boxH - 8, 4);

    // Små hörnromber i guld
    const corners = [
      { x: boxX - boxW / 2 + 4, y: boxY - boxH / 2 + 4 },
      { x: boxX + boxW / 2 - 4, y: boxY - boxH / 2 + 4 },
      { x: boxX - boxW / 2 + 4, y: boxY + boxH / 2 - 4 },
      { x: boxX + boxW / 2 - 4, y: boxY + boxH / 2 - 4 },
    ];
    bg.fillStyle(0xd4af37, 0.95);
    corners.forEach(c => {
      bg.fillPoints([
        { x: c.x, y: c.y - 3 },
        { x: c.x + 3, y: c.y },
        { x: c.x, y: c.y + 3 },
        { x: c.x - 3, y: c.y },
      ], true);
    });
    container.add(bg);

    // Talarens namn: GREG THE GRAVEKEEPER
    const speakerText = this.scene.add.text(boxX - boxW / 2 + 22, boxY - boxH / 2 + 18, this.npcName, {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '13px',
      fontStyle: 'bold',
      letterSpacing: 3,
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 3,
    });
    container.add(speakerText);

    // Liten avdelarlinje under namnet
    const divGfx = this.scene.add.graphics();
    divGfx.lineStyle(1.0, 0x6e5c46, 0.65);
    divGfx.strokeLineShape(new Phaser.Geom.Line(boxX - boxW / 2 + 22, boxY - boxH / 2 + 34, boxX - boxW / 2 + 200, boxY - boxH / 2 + 34));
    container.add(divGfx);

    // Dialogtext
    this.dialogueText = this.scene.add.text(boxX - boxW / 2 + 24, boxY - boxH / 2 + 42, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '14px',
      color: '#e2ecf4',
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: { width: boxW - 48, useAdvancedWrap: true },
      lineSpacing: 5,
    });
    container.add(this.dialogueText);

    // Handlingsprompt i hörnet [ E / MELLANSLAG : NÄSTA  •  ESC : STÄNG ]
    const promptHint = this.scene.add.text(boxX + boxW / 2 - 20, boxY + boxH / 2 - 14, '[ E / MELLANSLAG : NÄSTA  •  ESC : STÄNG ]', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '9px',
      letterSpacing: 1.5,
      color: '#8b8070',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(1, 0.5);
    container.add(promptHint);

    // Klicka på dialogboxen för att stega vidare
    const boxHit = this.scene.add.zone(boxX, boxY, boxW, boxH);
    boxHit.setScrollFactor(0);
    boxHit.setDepth(25010);
    boxHit.setInteractive({ useHandCursor: true });
    boxHit.on('pointerdown', () => this.advanceDialogue());
    container.add(boxHit);

    // Tangentbordslyssnare för ESC, Mellanslag och Enter
    this.dialogueKeyHandler = (e) => {
      if (!this.isTalking) return;
      if (e.code === 'Escape') {
        this.closeDialogue();
      } else if (e.code === 'Space' || e.code === 'Enter') {
        this.advanceDialogue();
      }
    };
    this.scene.input.keyboard.on('keydown', this.dialogueKeyHandler);

    // Mjuk intoning
    container.setAlpha(0);
    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      duration: 160,
      ease: 'Cubic.easeOut',
    });

    this.renderCurrentLine();
  }

  /**
   * Visar nuvarande replik i dialogen.
   */
  renderCurrentLine() {
    if (!this.dialogueText) return;
    const line = this.dialogueLines[this.currentDialogueIndex] || '...';
    this.dialogueText.setText(`"${line}"`);
  }

  /**
   * Stegar fram till nästa replik, eller stänger dialogen om sista repliken nåtts.
   */
  advanceDialogue() {
    this.currentDialogueIndex++;
    if (this.currentDialogueIndex >= this.dialogueLines.length) {
      this.closeDialogue();
    } else {
      this.renderCurrentLine();
    }
  }

  /**
   * Stänger dialogrutan.
   */
  closeDialogue() {
    if (!this.isTalking) return;
    this.isTalking = false;

    if (this.dialogueKeyHandler && this.scene && this.scene.input && this.scene.input.keyboard) {
      this.scene.input.keyboard.off('keydown', this.dialogueKeyHandler);
      this.dialogueKeyHandler = null;
    }

    if (this.dialogueContainer) {
      const containerToDestroy = this.dialogueContainer;
      this.dialogueContainer = null;

      this.scene.tweens.add({
        targets: containerToDestroy,
        alpha: 0,
        y: containerToDestroy.y + 10,
        duration: 140,
        ease: 'Quad.easeOut',
        onComplete: () => {
          containerToDestroy.destroy();
        },
      });
    }
  }

  destroy(fromScene) {
    this.closeDialogue();
    if (this.shadow) this.shadow.destroy();
    if (this.backingGlow) this.backingGlow.destroy();
    if (this.lanternGlow) this.lanternGlow.destroy();
    if (this.nameTag) this.nameTag.destroy();
    if (this.promptText) this.promptText.destroy();
    super.destroy(fromScene);
  }
}
