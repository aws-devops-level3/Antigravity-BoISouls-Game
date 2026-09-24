/**
 * LevelTransitions.js - Unified Level Registry & Transition Configuration
 *
 * Centraliserat system för att enkelt definiera nivåer, dörrövergångar och spawnpositioner.
 * För att lägga till Karta 4, 5 etc. framöver:
 * 1. Lägg till nivån i LEVELS-objektet nedan.
 * 2. Lägg till dörrövergången i LEVEL_TRANSITIONS-listan (eller använd addTwoWayTransition).
 * Klart! BootScene laddar automatiskt in tillgångarna och GameScene sköter väggar, dörrar och fiender.
 */

// ============================================================================
// 1. NIVÅREGISTER (LEVELS)
// ============================================================================
export const LEVELS = {
  SoulsChapel: {
    key: 'SoulsChapel',
    name: 'Helgedomen',
    vttPath: '/assets/SoulsChapel.dd2vtt',
    imagePath: '/assets/SoulsChapel.jpg',
    title: 'FÖRBANNADE SALEN',
    subTitle: 'The Accursed Crypts & Grand Halls',
    // Spelarens startposition när spelet först startar (trärummet i nordost, där spelaren står på bilden)
    defaultSpawn: { x: 2277, y: 513 },
    enemies: [
      { type: 'knight', x: 441, y: 924 },
      { type: 'knight', x: 882, y: 840 },
      { type: 'ghost',  x: 336, y: 1134 },
      { type: 'ghost',  x: 1281, y: 1302 },
      { type: 'ghost',  x: 1344, y: 756 },
      { type: 'knight', x: 1680, y: 1344 },
      { type: 'knight', x: 2226, y: 1344 },
      { type: 'ghost',  x: 1902, y: 1351 },
      // Placerade utanför startrummet i korridoren så att spelaren inte attackeras direkt vid spawn
      { type: 'knight', x: 2310, y: 960 },
      { type: 'ghost',  x: 2457, y: 960 },
    ],
    // Slumpmässiga spawn-punkter för kycklingar (max 3 väljs per karta)
    chickenSpawns: [
      { x: 2180, y: 650 },
      { x: 1850, y: 920 },
      { x: 1520, y: 1100 },
      { x: 2020, y: 1250 },
      { x: 960,  y: 880 },
      { x: 650,  y: 920 },
      { x: 1220, y: 1200 },
    ],
  },

  CemeterySouls: {
    key: 'CemeterySouls',
    name: 'Kyrkogården',
    vttPath: '/assets/CemeterySouls.dd2vtt',
    imagePath: '/assets/CemeterySouls.jpg',
    title: 'KYRKOGÅRDEN',
    subTitle: 'The Desolate Cemetery Grounds',
    // Spawn-punkt (Gul cirkel i skärmdump där spelarkaraktären står): på stigen längst till höger
    defaultSpawn: { x: 1955, y: 788 },
    enemies: [
      { type: 'knight', x: 950, y: 750 },
      { type: 'knight', x: 1420, y: 850 },
      { type: 'knight', x: 1680, y: 1350 },
      { type: 'ghost',  x: 750, y: 550 },
      { type: 'ghost',  x: 1200, y: 520 },
      { type: 'ghost',  x: 1750, y: 680 },
      { type: 'ghost',  x: 1500, y: 1200 },
      { type: 'ghost',  x: 880, y: 1250 },
      { type: 'skeleton', x: 1350, y: 680 },
      { type: 'skeleton', x: 1050, y: 1100 },
      { type: 'skeleton', x: 1620, y: 1050 },
      { type: 'skeleton', x: 820, y: 920 },
    ],
    chickenSpawns: [
      { x: 1820, y: 820 },
      { x: 1550, y: 780 },
      { x: 1300, y: 950 },
      { x: 1050, y: 800 },
      { x: 1420, y: 1150 },
      { x: 800,  y: 720 },
    ],
  },

  SoulsBossRoom1: {
    key: 'SoulsBossRoom1',
    name: 'Förfädrens Tronsal',
    vttPath: '/assets/SoulsBossRoom1.dd2vtt',
    imagePath: '/assets/SoulsBossRoom1.jpg',
    title: 'FÖRFÄDRENS TRONSAL',
    subTitle: 'The Ancient Throne & Boss Arena',
    // Spelaren anländer vid ingången på bron längst till höger där karaktären står på bilden
    defaultSpawn: { x: 1600, y: 522 },
    enemies: [
      // Vålnadens Drottning - Den enda fienden, står vid kistan i byggnaden
      { type: 'boss', x: 310, y: 515 },
    ],
    chickenSpawns: [
      { x: 1480, y: 520 },
      { x: 1250, y: 520 },
      { x: 1000, y: 520 },
      { x: 780,  y: 470 },
      { x: 780,  y: 570 },
    ],
  },

  /*
  // EXEMPEL: SÅ HÄR LÄGGER DU TILL KARTA 4:
  Karta4: {
    key: 'Karta4',
    name: 'Katakomberna',
    vttPath: '/assets/Karta4.dd2vtt',
    imagePath: '/assets/Karta4.jpg',
    title: 'KATAKOMBERNA',
    subTitle: 'The Forgotten Catacombs',
    defaultSpawn: { x: 300, y: 400 },
    enemies: [
      { type: 'knight', x: 450, y: 400 },
      { type: 'ghost',  x: 600, y: 500 },
    ],
  },
  */
};

// ============================================================================
// 2. DÖRRÖVERGÅNGAR (LEVEL_TRANSITIONS)
// ============================================================================
export const LEVEL_TRANSITIONS = [
  // Övergång 1: Helgedomen (Karta 1) -> Kyrkogården (Karta 2)
  // Spawna in på GULA CIRKELN på stigen till höger (där spelaren står på bilden)
  {
    id: 'chapel_to_cemetery',
    fromMap: 'SoulsChapel',
    door: { match: 'leftmost' }, // Västra porten i kapellet
    toMap: 'CemeterySouls',
    targetSpawn: { x: 1955, y: 788 }, // Gul cirkel i skärmdump där spelarkaraktären står
    prompt: 'Öppna porten till Kyrkogården [E]',
    destinationTitle: 'Kyrkogården',
  },

  // Spawn-portal / Returdörr på GULA CIRKELN (Karta 2) -> Helgedomen (Karta 1)
  {
    id: 'cemetery_to_chapel',
    fromMap: 'CemeterySouls',
    door: { position: { x: 1955, y: 788 }, radius: 60 }, // Spawn-portal vid gula cirkeln där spelaren står
    toMap: 'SoulsChapel',
    targetSpawn: { x: 270, y: 945 },
    prompt: 'Återvänd till Helgedomen [E]',
    destinationTitle: 'Helgedomen',
  },

  // Övergång 2: Dörren till nästa rum på RÖDA CIRKELN (Karta 2) -> Bossrummet (Karta 3)
  // RÖD CIRKEL vid porten/graven längst upp vid bron (x: 1103, y: 383)
  {
    id: 'cemetery_to_bossroom',
    fromMap: 'CemeterySouls',
    door: { position: { x: 1103, y: 383 }, radius: 60 }, // Röd cirkel vid porten/graven längst upp vid bron
    toMap: 'SoulsBossRoom1',
    targetSpawn: { x: 1600, y: 522 }, // Bron längst till höger på Karta 3 (där spelaren står på bilden)
    prompt: 'Öppna porten till Förfädrens Tronsal [E]',
    destinationTitle: 'Förfädrens Tronsal',
  },

  // Övergång 3: Returdörr Bossrummet (Karta 3) -> Kyrkogården (Karta 2)
  {
    id: 'bossroom_to_cemetery',
    fromMap: 'SoulsBossRoom1',
    door: { position: { x: 1600, y: 522 }, radius: 60 }, // Vid brons början på Karta 3 (där spelaren står)
    toMap: 'CemeterySouls',
    targetSpawn: { x: 1103, y: 440 }, // Spawnpunkt på bron strax söder om röda cirkeln
    prompt: 'Återvänd till Kyrkogården [E]',
    destinationTitle: 'Kyrkogården',
  },

  /*
  // EXEMPEL: SÅ HÄR KOPPLAR DU KARTA 3 TILL KARTA 4:
  {
    id: 'bossroom_to_karta4',
    fromMap: 'SoulsBossRoom1',
    door: { match: 0 }, // Inre dörren vid x: 1011, y: 525
    toMap: 'Karta4',
    targetSpawn: { x: 300, y: 400 },
    prompt: 'Stig in i Katakomberna [E]',
  },
  {
    id: 'karta4_to_bossroom',
    fromMap: 'Karta4',
    door: { match: 'leftmost' },
    toMap: 'SoulsBossRoom1',
    targetSpawn: { x: 1060, y: 525 },
    prompt: 'Återvänd till Tronsalen [E]',
  },
  */
];

// ============================================================================
// 3. HJÄLPFUNKTIONER FÖR ENKEL OCH DYNAMISK HANTERING
// ============================================================================

/**
 * Hämta komplett nivåkonfiguration med automatiskt länkade dörrar
 * @param {string} mapKey ID för kartan (t.ex. 'SoulsChapel')
 * @returns {object} Nivåkonfiguration
 */
export function getLevelConfig(mapKey) {
  const base = LEVELS[mapKey] || LEVELS.SoulsChapel;
  const doors = getTransitionsForMap(mapKey);

  return {
    ...base,
    vttKey: `${base.key}_vtt`,
    bgKey: `${base.key}_bg`,
    areaTitle: base.title,
    areaSubtitle: base.subTitle,
    doors,
  };
}

/**
 * Hämta alla aktiva övergångar/dörrar från en specifik karta
 * @param {string} mapKey
 * @returns {Array<object>}
 */
export function getTransitionsForMap(mapKey) {
  return LEVEL_TRANSITIONS
    .filter(t => t.fromMap === mapKey)
    .map(t => ({
      id: t.id,
      match: t.door ? t.door.match : null,
      position: t.door ? t.door.position : null,
      radius: t.door ? t.door.radius : undefined,
      targetMap: t.toMap,
      targetSpawn: t.targetSpawn,
      prompt: t.prompt,
      destinationTitle: t.destinationTitle || t.toMap,
    }));
}

/**
 * Registrera en ny karta dynamiskt under körning eller i konfiguration
 */
export function registerLevel(levelConfig) {
  if (!levelConfig || !levelConfig.key) {
    throw new Error('registerLevel: levelConfig must have a unique key');
  }
  LEVELS[levelConfig.key] = levelConfig;
  return levelConfig;
}

/**
 * Registrera en enkelriktad dörrövergång
 */
export function registerTransition(transition) {
  LEVEL_TRANSITIONS.push(transition);
  return transition;
}

/**
 * Registrera en dubbelriktad dörrövergång mellan två kartor i ett enda anrop
 *
 * @param {object} opts
 * @param {string} opts.mapA Första kartan
 * @param {object} opts.doorA Dörr på första kartan ({ match: 'leftmost' } eller { position: { x, y } })
 * @param {object} opts.spawnA Spawnposition på första kartan när man återvänder
 * @param {string} opts.promptA Interaktionsprompt på första kartan
 * @param {string} opts.mapB Andra kartan
 * @param {object} opts.doorB Dörr på andra kartan
 * @param {object} opts.spawnB Spawnposition på andra kartan när man anländer
 * @param {string} opts.promptB Interaktionsprompt på andra kartan
 */
export function registerTwoWayTransition(opts) {
  const forward = {
    id: `${opts.mapA}_to_${opts.mapB}`,
    fromMap: opts.mapA,
    door: opts.doorA,
    toMap: opts.mapB,
    targetSpawn: opts.spawnB,
    prompt: opts.promptA,
  };

  const backward = {
    id: `${opts.mapB}_to_${opts.mapA}`,
    fromMap: opts.mapB,
    door: opts.doorB,
    toMap: opts.mapA,
    targetSpawn: opts.spawnA,
    prompt: opts.promptB,
  };

  LEVEL_TRANSITIONS.push(forward, backward);
  return { forward, backward };
}

// Bakåtkompatibilitet med MapConfig
export const MAP_CONFIGS = new Proxy({}, {
  get(target, prop) {
    if (typeof prop === 'string' && LEVELS[prop]) {
      return getLevelConfig(prop);
    }
    return undefined;
  },
});

export const getMapConfig = getLevelConfig;
