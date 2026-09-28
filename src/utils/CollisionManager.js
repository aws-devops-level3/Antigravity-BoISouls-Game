import Phaser from 'phaser';

/**
 * CollisionManager.js
 * Modulärt system för AABB-kollisioner (Axis-Aligned Bounding Box) och visuell editor.
 *
 * Hanterar:
 * 1. Datalista med rektangulära hinder: obstacles = [{ x, y, width, height }, ...]
 * 2. Axelseparerad kollisionskoll för mjuk väggglidning (Sliding movement)
 * 3. Visuell rendering av aktiva kollisioner med halvgenomskinliga röda rektanglar (debugColliders = true)
 * 4. Interaktiv musritare (Klicka & dra för att skapa nya hinder och logga dem till konsolen)
 */
export default class CollisionManager {
  /**
   * @param {Phaser.Scene} scene
   * @param {Array<{ x: number, y: number, width: number, height: number, name?: string }>} initialObstacles
   * @param {{ x: number, y: number, width: number, height: number }} [worldBounds]
   */
  constructor(scene, initialObstacles = [], worldBounds = null) {
    this.scene = scene;

    // 1. Datalista för hinder: Varje hinder är ett rektangulärt område { x, y, width, height }
    this.obstacles = Array.isArray(initialObstacles) ? initialObstacles.flat(Infinity) : [];

    // Valfria världsbegränsningar
    this.worldBounds = worldBounds;

    // 2. Debug-flaggor
    this.debugColliders = true; // Sätts som true som standard enligt instruktion
    this.editorMode = true;     // Tillåter klicka-och-dra för att rita nya hinder

    // Historik för att enkelt kunna ångra (Ctrl+Z / Z)
    this.history = [];

    // 3. Grafikobjekt för visuell rendering av kollisionsrutor
    this.debugGraphics = scene.add.graphics();
    this.debugGraphics.setDepth(9999);

    // 4. Musinteraktion för drag-editor
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.dragCurrent = { x: 0, y: 0 };

    this.setupInputs();
    this.createDebugUI();

    // Exponera för smidig konsolåtkomst
    window.collisionManager = this;
    window.obstacles = this.obstacles;
    window.copyObstacles = () => this.exportObstacles();
    window.toggleDebug = () => this.toggleDebugMode();
  }

  // ==========================================================================
  // KOLLISIONSLOGIK (AABB)
  // ==========================================================================

  /**
   * Kontrollerar om två AABB-rektanglar överlappar varandra.
   * @param {{ x: number, y: number, width: number, height: number }} a
   * @param {{ x: number, y: number, width: number, height: number }} b
   * @returns {boolean}
   */
  static checkAABB(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  /**
   * Kontrollerar om en specifik bounding box kolliderar med något hinder i obstacles-listan.
   * @param {{ x: number, y: number, width: number, height: number }} box
   * @returns {object|null} Det kolliderande hindret eller null
   */
  checkCollision(box) {
    for (let i = 0; i < this.obstacles.length; i++) {
      const obstacle = this.obstacles[i];
      if (CollisionManager.checkAABB(box, obstacle)) {
        return obstacle;
      }
    }
    return null;
  }

  /**
   * Uppdaterar rörelsen så att innan spelarens position ändras med dx/dy,
   * kontrolleras om spelarens bounding box kolliderar med något hinder.
   * Om det blir kollision stoppas rörelsen i den specifika axeln (tillåter wall sliding).
   *
   * @param {{ x: number, y: number, width: number, height: number }} currentBox Spelarens aktuella bounding box
   * @param {number} dx Önskad förflyttning i X-led
   * @param {number} dy Önskad förflyttning i Y-led
   * @returns {{ dx: number, dy: number, collidedX: boolean, collidedY: boolean }}
   */
  resolveMovement(currentBox, dx, dy) {
    let allowedDx = dx;
    let allowedDy = dy;
    let collidedX = false;
    let collidedY = false;

    // 1. Testa förflyttning längs X-axeln
    if (dx !== 0) {
      const testBoxX = {
        x: currentBox.x + dx,
        y: currentBox.y,
        width: currentBox.width,
        height: currentBox.height,
      };

      // Världsgränskontroll (om specificerad)
      if (this.worldBounds) {
        if (testBoxX.x < this.worldBounds.x || testBoxX.x + testBoxX.width > this.worldBounds.width) {
          allowedDx = 0;
          collidedX = true;
        }
      }

      // Hinderkollision på X
      if (!collidedX && this.checkCollision(testBoxX)) {
        allowedDx = 0;
        collidedX = true;
      }
    }

    // 2. Testa förflyttning längs Y-axeln (med den tillåtna X-rörelsen inkluderad)
    if (dy !== 0) {
      const testBoxY = {
        x: currentBox.x + allowedDx,
        y: currentBox.y + dy,
        width: currentBox.width,
        height: currentBox.height,
      };

      // Världsgränskontroll (om specificerad)
      if (this.worldBounds) {
        if (testBoxY.y < this.worldBounds.y || testBoxY.y + testBoxY.height > this.worldBounds.height) {
          allowedDy = 0;
          collidedY = true;
        }
      }

      // Hinderkollision på Y
      if (!collidedY && this.checkCollision(testBoxY)) {
        allowedDy = 0;
        collidedY = true;
      }
    }

    return {
      dx: allowedDx,
      dy: allowedDy,
      collidedX,
      collidedY,
    };
  }

  // ==========================================================================
  // HINDERHANTERING
  // ==========================================================================

  /**
   * Lägger till ett nytt hinder i listan.
   * @param {{ x: number, y: number, width: number, height: number, name?: string }} rect
   */
  addObstacle(rect) {
    const formatted = {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      ...(rect.name ? { name: rect.name } : {}),
    };

    this.obstacles.push(formatted);
    this.history.push(formatted);

    // Skriv ut i konsolen i ett format som kan kopieras direkt in i obstacles.js
    console.log(
      `%c[AABB Hinder skapat]`,
      'color: #ff4757; font-weight: bold;',
      `{ x: ${formatted.x}, y: ${formatted.y}, width: ${formatted.width}, height: ${formatted.height} },`
    );

    // Kopiera till urklipp om tillgängligt
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(
        `{ x: ${formatted.x}, y: ${formatted.y}, width: ${formatted.width}, height: ${formatted.height} },`
      ).catch(() => {});
    }

    // Visa toast i spelet
    this.showEditorToast(`Nytt hinder: { x: ${formatted.x}, y: ${formatted.y}, width: ${formatted.width}, height: ${formatted.height} }`);

    return formatted;
  }

  /**
   * Ångra det senaste skapade hindret.
   */
  undoLastObstacle() {
    if (this.obstacles.length === 0) return null;
    const removed = this.obstacles.pop();
    console.log(`%c[AABB Hinder borttaget (Z)]`, 'color: #ffa502; font-weight: bold;', removed);
    this.showEditorToast(`Tog bort hinder (${this.obstacles.length} kvar)`);
    return removed;
  }

  /**
   * Letar upp och tar bort hindret som finns direkt under muspekaren.
   * Aktiveras när användaren trycker 'R'.
   */
  removeObstacleUnderMouse() {
    const pointer = this.scene.input.activePointer;
    if (!pointer) return null;

    const mx = pointer.worldX;
    const my = pointer.worldY;

    // Sök bakifrån så att senast tillagda/översta hindret väljs om flera överlappar
    let targetIndex = -1;
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      if (mx >= obs.x && mx <= obs.x + obs.width && my >= obs.y && my <= obs.y + obs.height) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex !== -1) {
      const removed = this.obstacles.splice(targetIndex, 1)[0];
      console.log(
        `%c[AABB Hinder borttaget med 'R']`,
        'color: #ff4757; font-weight: bold;',
        removed,
        `(${this.obstacles.length} hinder kvar)`
      );
      this.showEditorToast(
        `🗑️ Tog bort hinder: ${removed.width}x${removed.height} (${this.obstacles.length} kvar)`,
        '#ff4757'
      );
      return removed;
    } else {
      this.showEditorToast('Inget hinder under muspekaren att ta bort', '#ffa502');
      return null;
    }
  }

  /**
   * Skriver ut hela den aktuella obstacles-listan i webbläsarkonsolen.
   */
  exportObstacles() {
    const json = JSON.stringify(this.obstacles, null, 2);
    console.log(`%c=== AKTUELL OBSTACLES-LISTA (${this.obstacles.length} st) ===`, 'color: #2ed573; font-weight: bold;');
    console.log(json);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json).catch(() => {});
      this.showEditorToast('Hela hinderlistan kopierad till urklipp!');
    }
    return json;
  }

  // ==========================================================================
  // DEBUG-RENDERING & VISUELL EDITOR
  // ==========================================================================

  /**
   * Ritar ut alla aktiva hinder och debug-information varje bildruta.
   * @param {Phaser.Physics.Arcade.Sprite} [player]
   */
  renderDebug(player) {
    this.debugGraphics.clear();

    if (!this.debugColliders) {
      return;
    }

    // Identifiera om muspekaren svävar över något hinder för visuell hover-effekt
    const pointer = this.scene.input.activePointer;
    const mx = pointer ? pointer.worldX : -9999;
    const my = pointer ? pointer.worldY : -9999;

    let hoveredIndex = -1;
    if (this.debugColliders && pointer) {
      for (let i = this.obstacles.length - 1; i >= 0; i--) {
        const obs = this.obstacles[i];
        if (mx >= obs.x && mx <= obs.x + obs.width && my >= obs.y && my <= obs.y + obs.height) {
          hoveredIndex = i;
          break;
        }
      }
    }

    // 1. Rendera alla aktiva hinder som halvgenomskinliga röda rektanglar
    this.obstacles.forEach((obs, index) => {
      const isHovered = index === hoveredIndex;

      if (isHovered) {
        // Starkare röd/orange fyllning och lysande gul markör för hindret som kan tas bort med 'R'
        this.debugGraphics.fillStyle(0xff3838, 0.58);
        this.debugGraphics.fillRect(obs.x, obs.y, obs.width, obs.height);

        this.debugGraphics.lineStyle(2.5, 0xffd700, 1.0);
        this.debugGraphics.strokeRect(obs.x, obs.y, obs.width, obs.height);

        // Markerade hörn i gult
        this.debugGraphics.fillStyle(0xffd700, 1.0);
        this.debugGraphics.fillCircle(obs.x, obs.y, 4);
        this.debugGraphics.fillCircle(obs.x + obs.width, obs.y, 4);
        this.debugGraphics.fillCircle(obs.x, obs.y + obs.height, 4);
        this.debugGraphics.fillCircle(obs.x + obs.width, obs.y + obs.height, 4);
      } else {
        // Halvgenomskinlig röd fyllning (alpha: 0.35)
        this.debugGraphics.fillStyle(0xff0000, 0.35);
        this.debugGraphics.fillRect(obs.x, obs.y, obs.width, obs.height);

        // Skarpare röd kantlinje (alpha: 0.85)
        this.debugGraphics.lineStyle(2, 0xff3333, 0.85);
        this.debugGraphics.strokeRect(obs.x, obs.y, obs.width, obs.height);

        // Hörnpunkter för tydlighet
        this.debugGraphics.fillStyle(0xffffff, 0.7);
        this.debugGraphics.fillCircle(obs.x, obs.y, 2.5);
        this.debugGraphics.fillCircle(obs.x + obs.width, obs.y + obs.height, 2.5);
      }
    });

    // 2. Rendera spelarens kollisionsruta (AABB) vid fötterna i cyan/grönt
    if (player && typeof player.getPlayerBounds === 'function') {
      const pBounds = player.getPlayerBounds();

      // Grön/cyan halvgenomskinlig fyllning
      this.debugGraphics.fillStyle(0x00ff88, 0.35);
      this.debugGraphics.fillRect(pBounds.x, pBounds.y, pBounds.width, pBounds.height);

      // Grön/cyan kantlinje
      this.debugGraphics.lineStyle(2, 0x00ffaa, 1.0);
      this.debugGraphics.strokeRect(pBounds.x, pBounds.y, pBounds.width, pBounds.height);

      // Mittpunkt vid spelarens fötter
      this.debugGraphics.fillStyle(0xffffff, 0.9);
      this.debugGraphics.fillCircle(pBounds.x + pBounds.width / 2, pBounds.y + pBounds.height / 2, 3);
    }

    // 3. Rendera aktiv drag-rektangel i gult under musritning
    if (this.isDragging) {
      const rx = Math.min(this.dragStart.x, this.dragCurrent.x);
      const ry = Math.min(this.dragStart.y, this.dragCurrent.y);
      const rw = Math.abs(this.dragCurrent.x - this.dragStart.x);
      const rh = Math.abs(this.dragCurrent.y - this.dragStart.y);

      // Halvgenomskinlig gul fyllning
      this.debugGraphics.fillStyle(0xffd700, 0.30);
      this.debugGraphics.fillRect(rx, ry, rw, rh);

      // Skarp gul linje
      this.debugGraphics.lineStyle(2, 0xffd700, 1.0);
      this.debugGraphics.strokeRect(rx, ry, rw, rh);
    }
  }

  // ==========================================================================
  // INPUT & MUSINTERAKTION (KLICKA & DRA EDITOR)
  // ==========================================================================

  setupInputs() {
    const scene = this.scene;

    // Mus-klick och drag för att skapa hinder (endast när debug-läget är aktivt)
    scene.input.on('pointerdown', (pointer) => {
      if (!this.debugColliders) return;
      // Rita hinder om Shift hålls ned eller om editorMode är aktivt
      const isShiftHeld = pointer.event && pointer.event.shiftKey;
      if (this.editorMode || isShiftHeld) {
        if (pointer.leftButtonDown() || pointer.button === 0) {
          this.isDragging = true;
          this.dragStart.x = pointer.worldX;
          this.dragStart.y = pointer.worldY;
          this.dragCurrent.x = pointer.worldX;
          this.dragCurrent.y = pointer.worldY;
        }
      }
    });

    scene.input.on('pointermove', (pointer) => {
      if (this.isDragging) {
        this.dragCurrent.x = pointer.worldX;
        this.dragCurrent.y = pointer.worldY;
      }
    });

    scene.input.on('pointerup', (pointer) => {
      if (this.isDragging) {
        this.isDragging = false;
        const x = Math.min(this.dragStart.x, pointer.worldX);
        const y = Math.min(this.dragStart.y, pointer.worldY);
        const width = Math.abs(pointer.worldX - this.dragStart.x);
        const height = Math.abs(pointer.worldY - this.dragStart.y);

        // Minsta storlek för att undvika oavsiktliga klick
        if (width >= 8 && height >= 8) {
          this.addObstacle({ x, y, width, height });
        }
      }
    });

    // Tangentbordsstyrning
    // [L]: Slå av / sätta på hela debug-läget
    scene.input.keyboard.on('keydown-L', () => {
      this.toggleDebugMode();
    });

    // [B]: Alternativ tangent för att växla debugColliders
    scene.input.keyboard.on('keydown-B', () => {
      this.toggleDebugMode();
    });

    // [R]: Ta bort hindret som finns direkt under muspekaren
    scene.input.keyboard.on('keydown-R', () => {
      this.removeObstacleUnderMouse();
    });

    // [Z]: Ångra senaste hinder
    scene.input.keyboard.on('keydown-Z', () => {
      this.undoLastObstacle();
    });

    // [P]: Skriv ut hela listan i konsolen
    scene.input.keyboard.on('keydown-P', () => {
      this.exportObstacles();
    });
  }

  // ==========================================================================
  // ON-SCREEN DEBUG UI & TOASTS
  // ==========================================================================

  createDebugUI() {
    const cam = this.scene.cameras.main;

    this.uiContainer = this.scene.add.container(cam.width - 16, 16);
    this.uiContainer.setScrollFactor(0);
    this.uiContainer.setDepth(10000);

    // Bakgrundsplatta
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0a0f, 0.85);
    bg.fillRoundedRect(-330, 0, 330, 108, 6);
    bg.lineStyle(1.5, 0xff4757, 0.8);
    bg.strokeRoundedRect(-330, 0, 330, 108, 6);

    this.uiText = this.scene.add.text(-320, 8, '', {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '11px',
      color: '#f1f2f6',
      lineSpacing: 3,
    });

    this.uiContainer.add([bg, this.uiText]);
    this.updateUILabel();

    // Responsiv placering vid fönsterändring
    this.scene.scale.on('resize', (gameSize) => {
      if (this.uiContainer) {
        this.uiContainer.setPosition(gameSize.width - 16, 16);
      }
    });
  }

  updateUILabel() {
    if (!this.uiText) return;
    const status = this.debugColliders ? 'PÅ' : 'AV';
    const monsterStatus = (this.scene && this.scene.monstersActive !== false) ? 'PÅ' : 'AV';
    const mapKey = (this.scene && this.scene.currentMapKey) ? this.scene.currentMapKey : 'SoulsChapel';
    this.uiText.setText(
      `🗺️ Aktiv Karta: [${mapKey}] (Byt: 1, 2, 3)\n` +
      `🛠️ Debug-läge: [${status}] (Tryck L för att slå av/på)\n` +
      `👾 Monster: [${monsterStatus}] (Tryck M) | 🗑️ Ta bort: Peka + R\n` +
      `✏️ Rita: Dra m musen | ↩️ Ångra: Z | 📋 Exportera: P`
    );
  }

  /**
   * Slår av eller på hela debug-läget (tangent L).
   * Döljer/visar kollisionsrutor, editor och HUD-overlay.
   */
  toggleDebugMode() {
    this.debugColliders = !this.debugColliders;
    this.editorMode = this.debugColliders;

    if (!this.debugColliders) {
      this.debugGraphics.clear();
      if (this.uiContainer) this.uiContainer.setVisible(false);
      this.showEditorToast('🛠️ Debug-läge: AV (Tryck L för att aktivera)', '#aaaaaa');
    } else {
      if (this.uiContainer) this.uiContainer.setVisible(true);
      this.updateUILabel();
      this.showEditorToast('🛠️ Debug-läge: PÅ (Tryck L för att stänga av)', '#4ade80');
    }
  }

  showEditorToast(msg, color = '#ffffff') {
    this.updateUILabel();
    const cam = this.scene.cameras.main;
    const toast = this.scene.add.text(
      cam.width / 2,
      95,
      msg,
      {
        fontFamily: 'Cinzel, serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: color,
        stroke: '#000000',
        strokeThickness: 3,
        backgroundColor: '#120d1add',
        padding: { x: 12, y: 6 },
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(10001);

    this.scene.tweens.add({
      targets: toast,
      y: toast.y - 18,
      alpha: { from: 1, to: 0 },
      delay: 1400,
      duration: 500,
      onComplete: () => toast.destroy(),
    });
  }
}
