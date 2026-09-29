/**
 * CombatConfig.js - Central konfiguration för spelets combat-system (Tiny Rogues style)
 * 
 * Alla värden här kan enkelt justeras för att tweaka stridskänslan och balansen!
 */
export const COMBAT_CONFIG = {
  // ==========================================
  // 1. ATTACK-INSTÄLLNINGAR (Melee & Svep)
  // ==========================================
  damage: 25,                   // Skada per träff
  attackSpeed: 3.5,             // Antal attacker per sekund vid intryckt musknapp
  attackCooldown: 0.28,         // Cooldown mellan attacker i sekunder (1 / attackSpeed = ~0.28s)
  attackRange: 85,              // Räckvidd på svepet i pixlar
  attackArcWidth: 105,          // Vinkel / bredd på svepet (grader)
  slashSpeed: 420,              // Projektilens/svepets hastighet framåt
  slashLifetime: 0.18,          // Livslängd för svepet i sekunder (0.18s = snabbt & snärtigt)
  slashScale: 0.95,             // Storleksskala på den visuella svepbågen
  knockbackForce: 260,          // Hur kraftigt fiender knuffas bakåt vid träff
  attackStaminaCost: 0,         // Uthållighetskostnad för vanliga attacker (0 = obegränsat som i Tiny Rogues)

  // ==========================================
  // 2. DASH-MEKANIK (Mellanslag / Space)
  // ==========================================
  dashSpeed: 640,               // Hastighet under dashen i px/s
  dashDuration: 0.20,           // Hur länge rusningen pågår (exakt 0.2 sekunder)
  dashCooldown: 0.95,           // Återhämtningstid innan nästa dash (0.8 - 1.2 sekunder)
  dashStaminaCost: 15,          // Uthållighetskostnad (stamina)
  dashInvulnerability: true,    // Ger i-frames (osårbarhet mot alla skador och projektiler)

  // ==========================================
  // 3. TRÄFFRESPONS & "JUICE" (Game Feel)
  // ==========================================
  hitstopDuration: 40,          // Freeze-frame mikropaus vid träff i millisekunder (30-50ms)
  screenshakeIntensity: 0,      // Skärmskakning inaktiverad (borttagen)
  screenshakeDuration: 0,       // Skärmskakningens längd i ms
  enemyFlashDuration: 90,       // Vitt blink i ms vid skada
};

export default COMBAT_CONFIG;
