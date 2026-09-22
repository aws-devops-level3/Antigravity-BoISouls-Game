# Ashen One - Dark Souls 3 Inspirerat 2D-spel (Phaser 3)

Ett stämningsfullt mörkt 2D-actionrollspel i HTML5 och Phaser 3 med estetik, rörelsemekanik och känsla inspirerad av Dark Souls 3.

---

## 🚀 Snabbstart (Hur du startar spelet imorgon)

1. Öppna terminalen i projektmappen (`Antigravity BoISouls Game`).
2. Kör följande kommando:
   ```bash
   npm run dev
   ```
3. Öppna webbläsaren på: **[http://localhost:5173/](http://localhost:5173/)**

---

## 🎮 Nuvarande kontroller

| Tangent | Funktion |
| :--- | :--- |
| <kbd>W</kbd> | Gå uppåt |
| <kbd>S</kbd> | Gå nedåt |
| <kbd>A</kbd> | Gå åt vänster |
| <kbd>D</kbd> | Gå åt höger |
| <kbd>W</kbd>+<kbd>D</kbd>, <kbd>W</kbd>+<kbd>A</kbd>, <kbd>S</kbd>+<kbd>D</kbd>, <kbd>S</kbd>+<kbd>A</kbd> | Diagonala riktningar (8-vägs förflyttning) |
| <kbd>SKIFT</kbd> | Sprint / Snabbrörelse (förbrukar Stamina) |
| <kbd>MELLANSLAG / SPACE</kbd> | **Dodge Roll** (15% staminakostnad, i-frames, efterbilder) |
| <kbd>VÄNSTERKLICK</kbd> | **Svärdsattack** (mot muspekare i 100° kon, lunge, 20% stamina) |

---

## ⚔️ Vad som är implementerat hittills

- **Spelarkaraktär (Ashen One)**:
  - 8-vägs rörelse med WASD och piltangenter.
  - Normaliserad rörelsevektor för jämn hastighet i alla riktningar.
  - Fysisk tyngd i stegen (acceleration/retardation).
  - Vändning mot rörelseriktning samt fotstegsdamm och svajig gångcykel.
  - Sprint med <kbd>SKIFT</kbd> som förbrukar uthållighet (Stamina) och regenereras automatiskt.
  - **Dodge Roll med <kbd>SPACE</kbd>**: Rullningsanimation (360° somersault), 15% staminakostnad (15 av 100), i-frames (odödlighetsfönster), eteriska efterbilder (*ghost trail*) och dammpuff.
  - **Svärdsattack med Vänsterklick**: Riktat storsvärdshugg mot muspekarens position i en 100-graders kon, svepande glödande svärdsbåge, flygande cinders/gnistor, kraftfullt framåtkliv (*lunge*), subtilt skärmskak och 20% staminakostnad.
- **Fiender & AI (Hollow Knights & Cursed Wraiths)**:
  - **Hollow Knight**: Tungt bepansrad odöd riddare som patrullerar helgedomens pelargångar med telegraferat svärdshugg, stagger-reaktion och +250 Souls vid fall.
  - **Cursed Wraith (Spöke med glödande röda ögon)**: Eteriskt, halvgenomskinligt spöke med fladdrande slöjor och två genomträngande lysande röda ögon. Svävar ljudlöst med en mjuk sinusrörelse, fasar rakt igenom helgedomens pelare (*phasing*), och utför en snabb spektral kloattack med röda rivsår. Belönar +180 Souls vid förintelse.
  - **Dodge Roll-koppling**: Om spelaren rullar (<kbd>SPACE</kbd>) precis när en fiende eller spöke slår till skyddar i-frames spelaren så att den tar 0 skada.
  - **Dark Souls HP-mätare**: Alla fiender visar en svävande hälsomätare ovanför huvudet när de tar skada från spelarens storsvärd.
- **Gotisk spelmiljö ("Eldens Helgedom")**:
  - Detaljerat stengolv och arkitektoniska pelare med kollisionshantering.
  - Central **Bonfire** med det tvinnade svärdet och pulserande sken.
  - Svävande aska och glöd (**Embers**) i luften.
  - Mjuk kameraföljning (Souls-lerp) med 1.4x zoom.
- **Dark Souls 3 HUD**:
  - Djupröd livmätare (HP).
  - Koboltblå fokusmätare (FP).
  - Viridiangrön uthållighetsmätare (Stamina).
  - Dynamisk Souls-räknare som ökar när fiender besegras, och Estus Flask-indikator.

---

## 🗺️ Nästa steg / Färdplan

1. ✅ **Dodge Roll (Rullning med Space)**: Rullningsanimation med i-frames, 15% staminakostnad och efterbilder (*klart!*).
2. ✅ **Svärdsattack**: Vänsterklick för primärt svärdshugg mot muspekare i en kon, träffområdesgeometri och ljusglöd (*klart!*).
3. ✅ **Fiender & AI**: Första fientliga riddaren/vandraren med patrullering, jakt, telegraferad attack, stagger och själar (*klart!*).
4. **Ljud & Musik**: Atmosfäriskt mörkt ambientljud och svärdskling.

---

## 📁 Projektstruktur

```
├── public/
│   └── favicon.svg           # Bonfire / Dark Sign ikon
├── src/
│   ├── entities/
│   │   └── Player.js         # Spelarkaraktär & 8-vägs rörelselogik
│   ├── scenes/
│   │   ├── BootScene.js      # Texturgenerering för Dark Souls-grafik
│   │   └── GameScene.js      # Spelvärld, lägereld, pelare & kamera
│   ├── ui/
│   │   └── SoulsHUD.js       # HP, FP, Stamina och Souls-gränssnitt
│   ├── main.js               # Phaser 3 initialisering
│   └── style.css             # Mörk Souls-styling & knappar
├── index.html                # Huvudfil med Google Fonts (Cinzel)
└── package.json              # Phaser 3 & Vite beroenden
```
