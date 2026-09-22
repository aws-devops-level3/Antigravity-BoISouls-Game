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
  - **Autentisk Pixel Art-modell**: Spelaren styrs nu som en detaljerad pixel art-riddare med mörk rustning, hjälm med glödande visir, mantel/koger på ryggen och inbyggd markskugga.
  - **Gång- och vilocykel (Walk & Idle)**: Full animerad gångcykel (`player_walk`, 6 bildrutor) med naturlig steg-bobbing och dynamisk hastighet (ökar vid sprint med <kbd>SKIFT</kbd>) samt ett stilla viloläge (`player_idle`).
  - **Crisp Pixel Art Scaling**: Skalad till $2.2\times$ med `NEAREST`-filtrering för knivskarpa pixlar som smälter in i dungeon-miljön.
  - 8-vägs rörelse med WASD och piltangenter med normaliserad hastighet.
  - Fysisk tyngd i stegen (acceleration/retardation) och anpassad 2.5D-kollisionskropp ($14 \times 12$ px vid fötterna).
  - Vändning mot rörelseriktning samt fotstegsdamm.
  - **Kolossal Krigshammare i Höger Hand (Colossal Warhammer)**:
    - Spelaren är nu beväpnad med en kolossal krigshammare i höger hand, skalad till $2.8\times$ så att den är **något större än karaktären själv**.
    - **Stridsredo hållning & Gånggungning**: Hammaren vilar lutad snett uppåt/framåt i höger hand vid vila och gungar subtilt i takt med stegen vid gång och sprint.
    - **Tung Överhandskross (<kbd>Vänsterklick</kbd>)**:
      1. **Upplyft & Räckviddsindikator**: Hammaren lyfts högt över huvudet samtidigt som en lysande vit pixel art-skärelefant (`reach_arc`, inspirerad av referensbilden) sveper fram och visar slagets exakta maximala räckviddsradie (ca 78-80 px).
      2. **Krossving**: Accelererar nedåt i en våldsam båge mot muspekaren.
      3. **Markkross & Chockvåg**: Slår ned i stengolvet med full kraft och utlöser en cirkulär stensprick-chockvåg (`hammer_shockwave`), flygande stenrester och cinders (utan skärmskakning för stabil sikt).
      4. **Ökad Krosskada**: Delar ut 45 krosskada (stagger) mot Hollow Knights och Cursed Wraiths.
  - **Dodge Roll med <kbd>SPACE</kbd>**: Rullningsanimation (360° somersault), 15% staminakostnad, i-frames (odödlighetsfönster), eteriska efterbilder (*ghost trail*) av både riddaren och hammaren samt dammpuff.
- **Fiender & AI (Hollow Knights & Cursed Wraiths i Pixel Art)**:
  - **Cursed Wraith (Spöke med glödande röda ögon)**: Äkta, dedikerad pixel-art vålnad (`ghost_spritesheet.png`, 32x32) med mörk sliten kåpa, fladdrande ektoplasma-slöjor i 4-bildrutors svävanimation (`ghost_float`), framsträckta spektrala klor och genomträngande lysande röda pixelögon (`#ff1122`) med rött punktljus. Svävar ljudlöst med mjuk sinusrörelse, fasar rakt genom murar och utför snabba blodröda kloattacker (`ghost_claw`). Belönar +180 Souls vid förintelse.
  - **Hollow Knight (Riddare enligt referensbild med upprätt blodigt svärd)**: Dedikerad pixel-art riddare (`knight_enemy_sheet.png`, 32x32) baserad på referensbilden med mörkare grå stålrustning, hjälm med horisontell visirspringa och kryss-specular, livfull röd halsduk/krage, bälte med spänne och uppvikta pauldrons. Håller det blodiga svärdet med orange parerskydd (`greatsword_bloody.png`) **rakt vertikalt uppåt i höger hand** precis som på bilden. Vid attack höjs svärdet i en tvåhands-windup innan det klyver nedåt i ett tungt nedsving med blodröda sveparbågar. Belönar +250 Souls vid fall.
  - **Dodge Roll-koppling**: Om spelaren rullar (<kbd>SPACE</kbd>) precis när en fiende eller spöke slår till skyddar i-frames spelaren så att den tar 0 skada.
  - **Dark Souls HP-mätare**: Alla fiender visar en svävande hälsomätare ovanför huvudet när de tar skada från spelarens storsvärd.
- **Rumsrensning, Lucköppning & Nytt Rum (Dungeon Progression)**:
  - **Rum 1 (Förbannade Salen)**: När samtliga fiender är besegrade visas Dark Souls-banderollen **"HELGEDOMEN RENAD"**.
  - Den slutna träluckan i västra väggen ($X \approx 75, Y \approx 715$) låses upp och öppnas, varpå en stentrappa ned i djupet uppenbaras med gyllene själsstrålar och cinders.
  - **Rum 2 (Tortyrkammaren / Våning 2)**: Genom att kliva på luckan tonar skärmen ned och tar Ashen One till nästa rum med en helt ny detaljerad dungeonkarta (`dungeon_room2.jpg`, 2048x1536).
  - **Bevarade Stats**: Samlade Souls och hälsa följer sömlöst med mellan rummen.
  - **Rum 2 Miljö & Fysiska Hinder**: Spelaren kliver in via den norra järndörren ($X \approx 988, Y \approx 200$) till en kuslig tortyrkammare med exakta kollisionsbarriärer för tortyrsäng med lik, alkemihyllor, ett massivt matsalsbord med stolar, krossade tunnor med skelett och en raserad stenmur.
  - **Dynamiskt ljus i Rum 2**: Väggfackla med gnistpartiklar vid tortyrsängen och levande fladdrande ljus på matsalsbordet.
  - **Segerbanderoll**: När alla fiender i tortyrkammaren fördrivits visas den gyllene triumfbanderollen **"KRYPTAN RENAD — SEGER"**.
- **Gotisk spelmiljö ("Eldens Helgedom")**:
  - Handritade högupplösta Dark Souls-dungeonkartor (2048 x 1536).
  - Exakta fysiska kollisionslådor anpassade för varje rums unika arkitektur och rekvisita.
  - Dynamiskt fladdrande eldstad, väggfacklor och levande ljus.
  - Svävande aska och glöd (**Embers**) i luften.
  - Mjuk kameraföljning (Souls-lerp) med 1.35x zoom.
- **Dark Souls 3 HUD**:
  - Djupröd livmätare (HP).
  - Koboltblå fokusmätare (FP).
  - Viridiangrön uthållighetsmätare (Stamina).
  - Dynamisk Souls-räknare som ökar när fiender besegras, och Estus Flask-indikator.

---

## 🗺️ Nästa steg / Färdplan

1. ✅ **Dodge Roll (Rullning med Space)**: Rullningsanimation med i-frames, 15% staminakostnad och efterbilder (*klart!*).
2. ✅ **Svärdsattack**: Vänsterklick för primärt svärdshugg mot muspekare i en kon, träffområdesgeometri och ljusglöd (*klart!*).
3. ✅ **Fiender & AI**: Riddare och svävande spöken med patrullering, jakt, telegraferad attack, stagger och själar (*klart!*).
4. ✅ **Rumsrensning & Lucköppning**: Alla fiender döda öppnar västra luckan med trappa nedåt (*klart!*).
5. ✅ **Rum 2 (Tortyrkammaren)**: Ny bakgrundsbild, nya rumsunika hinder, norr-entré, fackelljus och segerbanderoll (*klart!*).
6. **Ljud & Musik**: Atmosfäriskt mörkt ambientljud och svärdskling.

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
