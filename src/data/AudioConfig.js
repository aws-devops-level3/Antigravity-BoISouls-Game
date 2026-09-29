/**
 * AudioConfig.js - Inställningar för bakgrundsmusik och ljud i spelet.
 * 
 * ============================================================================
 * SÅ HÄR BYTER DU BAKGRUNDSMUSIK & BOSS-MUSIK:
 * ============================================================================
 * Alla ljudfiler ska ligga i mappen: `public/assets/sounds/`
 * 
 * 1. VANLIG BAKGRUNDSMUSIK (Helgedomen & Kyrkogården):
 *    - Döp din MP3 till: `soundtrack.mp3`
 *    - ELLER ändra `path` under `bgm` nedan till ditt filnamn.
 * 
 * 2. EGEN BOSS-MUSIK FÖR SOULSBOSSROOM (Förfädrens Tronsal):
 *    - Döp din MP3 till: `boss_soundtrack.mp3`
 *    - ELLER ändra `path` under `bossBgm` nedan till ditt filnamn.
 * 
 * 3. Justera volym för respektive låt med `volume` (0.0 till 1.0).
 * ============================================================================
 */

export const AUDIO_CONFIG = {
  // Standard bakgrundsmusik (SoulsChapel, CemeterySouls etc.)
  bgm: {
    key: 'background_music',
    path: '/assets/sounds/soundtrack.mp3',
    volume: 0.35,
    loop: true,
    fadeInDuration: 1200,
  },

  // Eget soundtrack för SoulsBossRoom (Boss-arenan)
  bossBgm: {
    key: 'boss_music',
    path: '/assets/sounds/boss_soundtrack.mp3',
    volume: 0.40,
    loop: true,
    fadeInDuration: 900,
  },

  // Vilken musik som spelas i vilka rum
  mapMusic: {
    SoulsChapel: 'bgm',
    CemeterySouls: 'bgm',
    SoulsBossRoom1: 'bossBgm',
  },
};
