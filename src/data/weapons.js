/**
 * weapons.js - Centralt Vapenregister / Vapendatabas för spelarkaraktären
 * 
 * Här kan du enkelt lägga till, modifiera och balansera alla vapen i spelet!
 * Varje vapen styrs av sina attribut:
 * - id: Unikt ID (används i koden och vid byte med t.ex. player.equipWeapon('warhammer'))
 * - name: Visningsnamn i spelet
 * - type: 'melee', 'ranged' eller 'magic'
 * - damage: Grundskada per träff
 * - attackSpeed: Antal attacker per sekund (cooldown = 1 / attackSpeed)
 * - knockback: Hur kraftigt fiender knuffas bakåt vid träff
 * - range: Räckvidd för träffytan / projektilen i pixlar
 * - attackArcWidth: Bredd på träffkonen/bågen i grader
 * - slashSpeed: Projektilens/svepets hastighet framåt
 * - slashLifetime: Hur länge träffbågen lever i sekunder
 * - slashScale: Visuell storlek på attackeffekten
 * - slashColor: Färgton på attackeffekten (hex)
 * - statusEffect: Unik effekt ('stun', 'bleed', 'crit', 'pierce')
 * - sprite: Textur-nyckel för det synliga vapnet som spelaren håller i handen
 * - origin: Vridningspunkt / greppfäste på spriten { x, y }
 * - baseAngleOffset: Vinkelkorrigering i radianer för att rikta spriten mot musen
 * - scale: Storleksskalning på vapnet i handen
 */
export const WEAPONS = {
  warhammer: {
    id: 'warhammer',
    name: 'Colossal Warhammer',
    type: 'melee',
    description: 'Tung kolossal hammare med bred träffbåge, massiv skada och kraftig knockback som bedövar fiender.',
    sprite: 'hammer',
    origin: { x: 0.18, y: 0.82 },
    baseAngleOffset: Math.PI / 4,
    scale: 2.4,
    damage: 48,
    attackSpeed: 1.8,             // ~0.55s cooldown mellan tunga slag
    knockback: 350,
    range: 92,
    attackArcWidth: 125,          // Bred 125-graders krossbåge
    slashSpeed: 400,
    slashLifetime: 0.20,
    slashScale: 1.15,
    slashColor: 0xf59e0b,         // Gyllene bärnstensglöd
    statusEffect: 'stun',         // Bedövar och slår tillbaka fiender
    stunDuration: 400,            // ms bedövning
    attackStaminaCost: 0,
  },

  greatsword: {
    id: 'greatsword',
    name: 'Greatsword',
    type: 'melee',
    description: 'Tungt kolossalt tvåhandssvärd med lång räckvidd och svepande snitt som tillfogar blödning över tid.',
    sprite: 'greatsword_iron',
    origin: { x: 0.14, y: 0.85 },
    baseAngleOffset: Math.PI / 4,
    scale: 0.40,
    damage: 36,
    attackSpeed: 2.6,             // ~0.38s cooldown
    knockback: 240,
    range: 102,
    attackArcWidth: 115,          // 115-graders svep
    slashSpeed: 460,
    slashLifetime: 0.18,
    slashScale: 1.05,
    slashColor: 0xef4444,         // Blodrött svep
    statusEffect: 'bleed',        // Extra blödningsskada (DoT)
    bleedTicks: 3,
    bleedDamage: 6,
    attackStaminaCost: 0,
  },

  scimitar: {
    id: 'scimitar',
    name: 'Burning Scimitar',
    type: 'melee',
    description: 'Böjd flammande sabel som utdelar snabba svep med lägre direkt fysisk skada, men antänder fiender med intensiv eldskada över tid.',
    sprite: 'burning_scimitar',
    origin: { x: 0.24, y: 0.85 },
    baseAngleOffset: Math.PI / 4,
    scale: 0.38,
    damage: 22,                   // Lite lägre fysisk skada (kompletteras med eld DoT)
    attackSpeed: 3.4,             // Snabb och smidig sabel (~0.29s cooldown)
    knockback: 180,
    range: 92,
    attackArcWidth: 105,          // 105-graders snabbt flammande svep
    slashSpeed: 480,
    slashLifetime: 0.16,
    slashScale: 1.0,
    slashColor: 0xf97316,         // Flammande eldorange svep
    statusEffect: 'burn',         // Eldskada över tid (DoT)
    burnTicks: 4,                 // 4 tick
    burnDamage: 4,                // 4 eldskada per tick (totalt 16 eldskada -> 22 + 16 = 38 total skada!)
    burnInterval: 320,            // ms mellan varje eldtick
    attackStaminaCost: 0,
  },

  dagger: {
    id: 'dagger',
    name: 'Shadow Dagger',
    type: 'melee',
    description: 'Blixtsnabb skuggdolk smidd i mörker och omgiven av glödande cyankristaller, med extrem attackhastighet och hög chans för dödliga stötar.',
    sprite: 'shadow_dagger',
    origin: { x: 0.36, y: 0.80 },
    baseAngleOffset: Math.PI / 4,
    scale: 0.28,
    damage: 15,
    attackSpeed: 5.5,             // 5.5 attacker/s (~0.18s cooldown) - blixtrande snabb!
    knockback: 110,
    range: 68,
    attackArcWidth: 65,           // Smalare, fokuserad stötkon
    slashSpeed: 620,
    slashLifetime: 0.12,
    slashScale: 0.75,
    slashColor: 0x38bdf8,         // Eterisk cyan/blixt
    statusEffect: 'crit',
    critChance: 0.35,             // 35% chans till kritisk träff
    critMultiplier: 2.2,          // 2.2x skada vid crit (33 skada!)
    attackStaminaCost: 0,
  },

  staff: {
    id: 'staff',
    name: 'Spectral Bone Staff',
    type: 'magic',
    description: 'Magisk stav som avfyrar genomträngande spektrala projektiler mot muspekaren.',
    sprite: 'bone_staff',
    origin: { x: 0.5, y: 0.85 },
    baseAngleOffset: Math.PI / 2,
    scale: 1.5,
    damage: 26,
    attackSpeed: 3.2,             // 3.2 projektiler/s (~0.31s cooldown)
    knockback: 160,
    range: 360,                   // Lång räckvidd (projektil)
    attackArcWidth: 35,
    slashSpeed: 640,              // Snabb projektilhastighet
    slashLifetime: 0.55,          // Flyger långt
    slashScale: 0.85,
    slashColor: 0xa855f7,         // Spektral lila/violett
    statusEffect: 'pierce',
    pierce: 2,                    // Tränger igenom upp till 2 fiender
    attackStaminaCost: 0,
  },
};

export const DEFAULT_WEAPON_ID = 'warhammer';

export default WEAPONS;
