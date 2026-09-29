import Phaser from 'phaser';
import { AUDIO_CONFIG } from '../data/AudioConfig.js';

class AudioManager {
  constructor() {
    this.currentTrackKey = null;
    this.currentSoundInstance = null;
    this.isMuted = false;
    this.currentVolume = AUDIO_CONFIG.bgm.volume;
    this.listeners = [];
    this.scene = null;
    this.currentMapKey = null;
    this.isLoadingTrack = false;
  }

  /**
   * Initiera eller uppdatera AudioManager med aktuell scen och karta.
   * Startar automatiskt rätt soundtrack för rummet (t.ex. bossmusik för SoulsBossRoom).
   */
  init(scene, mapKey) {
    this.scene = scene;
    this.currentMapKey = mapKey || scene.currentMapKey || 'SoulsChapel';

    // Registrera globala funktioner för enkel felsökning och styrning
    if (typeof window !== 'undefined') {
      window.audioManager = this;
      window.toggleMusic = () => this.toggleMute();
      window.setMusicVolume = (vol) => this.setVolume(vol);
      window.playBossMusic = () => this.playTrack(scene, AUDIO_CONFIG.bossBgm);
      window.playNormalMusic = () => this.playTrack(scene, AUDIO_CONFIG.bgm);
    }

    const trackConfig = this.getTrackForMap(this.currentMapKey);
    this.playTrack(scene, trackConfig);
  }

  /**
   * Hämta ljudkonfiguration för specifik karta.
   * Känner av alla varianter av bossrummet ('SoulsBossRoom1', 'SoulsBossRoom', etc.)
   */
  getTrackForMap(mapKey) {
    if (!mapKey) return AUDIO_CONFIG.bgm;

    // Om kartnamnet innehåller "boss" (oberoende av stora/små bokstäver eller siffror)
    if (/boss/i.test(mapKey)) {
      return AUDIO_CONFIG.bossBgm;
    }

    const customKey = AUDIO_CONFIG.mapMusic?.[mapKey];
    if (customKey && AUDIO_CONFIG[customKey]) {
      return AUDIO_CONFIG[customKey];
    }

    return AUDIO_CONFIG.bgm;
  }

  /**
   * Spela ett specifikt soundtrack.
   */
  playTrack(scene, trackConfig) {
    if (!scene || !scene.sound) return;
    const soundManager = scene.sound;

    // Om samma låt redan spelas, låt den fortsätta utan avbrott
    if (this.currentTrackKey === trackConfig.key && this.currentSoundInstance && this.currentSoundInstance.isPlaying) {
      return;
    }

    // Om ljudfilen inte finns i cachen ännu (t.ex. vid direkt byte), ladda in den dynamiskt!
    if (!scene.cache.audio.exists(trackConfig.key)) {
      console.log(`[AudioManager] Ljudspår '${trackConfig.key}' finns inte i cache. Laddar direkt från ${trackConfig.path}...`);
      if (this.isLoadingTrack) return;
      this.isLoadingTrack = true;

      scene.load.audio(trackConfig.key, encodeURI(trackConfig.path) + `?t=${Date.now()}`);
      scene.load.once(`filecomplete-audio-${trackConfig.key}`, () => {
        this.isLoadingTrack = false;
        console.log(`[AudioManager] Ljudspår '${trackConfig.key}' laddades framgångsrikt!`);
        this.playTrack(scene, trackConfig);
      });
      scene.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, (file) => {
        this.isLoadingTrack = false;
        console.error(`[AudioManager] Kunde inte läsa in ljudfil: ${file.src}`);
      });
      scene.load.start();
      return;
    }

    const startPlayback = () => {
      // 1. Tona ut och stoppa eventuell föregående låt
      if (this.currentSoundInstance && this.currentSoundInstance.isPlaying) {
        const oldInstance = this.currentSoundInstance;
        if (oldInstance.key !== trackConfig.key) {
          scene.tweens.add({
            targets: oldInstance,
            volume: 0,
            duration: 600,
            ease: 'Linear',
            onComplete: () => {
              oldInstance.stop();
            },
          });
        }
      }

      // 2. Hämta befintlig instans eller skapa en ny
      let newInstance = soundManager.get(trackConfig.key);
      const targetVolume = this.isMuted ? 0 : (trackConfig.volume !== undefined ? trackConfig.volume : 0.35);

      if (!newInstance) {
        newInstance = soundManager.add(trackConfig.key, {
          volume: targetVolume,
          loop: trackConfig.loop !== false,
        });
      }

      this.currentTrackKey = trackConfig.key;
      this.currentSoundInstance = newInstance;
      this.currentVolume = trackConfig.volume;

      // Sätt volym direkt så den aldrig fastnar på tyst eller 0.01
      newInstance.setVolume(targetVolume);

      // Starta uppspelning om den inte redan spelar
      if (!newInstance.isPlaying) {
        newInstance.play({
          volume: targetVolume,
          loop: trackConfig.loop !== false,
        });
      }

      console.log(`[AudioManager] Spelar nu: '${trackConfig.key}' för rum '${this.currentMapKey}' (volym: ${targetVolume})`);
      this.notifyListeners();
    };

    // Hantera webbläsarens autoplay-restriktion vid första interaktion
    if (soundManager.locked) {
      const unlockListener = () => {
        if (soundManager.locked) {
          soundManager.unlock();
        }
        startPlayback();
        scene.input.off('pointerdown', unlockListener);
        if (scene.input.keyboard) {
          scene.input.keyboard.off('keydown', unlockListener);
        }
      };

      soundManager.once(Phaser.Sound.Events.UNLOCKED, () => {
        startPlayback();
      });
      scene.input.once('pointerdown', unlockListener);
      if (scene.input.keyboard) {
        scene.input.keyboard.once('keydown', unlockListener);
      }
    } else {
      startPlayback();
    }
  }

  /**
   * Växla mute på/av för musiken.
   */
  toggleMute() {
    this.isMuted = !this.isMuted;

    if (this.currentSoundInstance) {
      if (this.isMuted) {
        this.currentSoundInstance.setVolume(0);
      } else {
        const vol = this.currentVolume || 0.35;
        this.currentSoundInstance.setVolume(vol);
        if (!this.currentSoundInstance.isPlaying) {
          this.currentSoundInstance.play({
            volume: vol,
            loop: true,
          });
        }
      }
    }

    this.notifyListeners();
    return !this.isMuted;
  }

  /**
   * Sätt volym (mellan 0.0 och 1.0).
   */
  setVolume(vol) {
    this.currentVolume = Phaser.Math.Clamp(vol, 0.0, 1.0);
    if (this.currentSoundInstance && !this.isMuted) {
      this.currentSoundInstance.setVolume(this.currentVolume);
    }
    this.notifyListeners();
  }

  /**
   * Registrera en lyssnare som uppdaterar HUD när ljudstatus ändras.
   */
  onStateChange(fn) {
    this.listeners.push(fn);
  }

  notifyListeners() {
    this.listeners.forEach((fn) => {
      try {
        fn({
          isMuted: this.isMuted,
          volume: this.currentVolume,
          trackKey: this.currentTrackKey,
          isBossMusic: this.currentTrackKey === AUDIO_CONFIG.bossBgm.key,
        });
      } catch (e) {
        // ignorera fel från förstörda HUD-komponenter
      }
    });
  }
}

export const audioManager = new AudioManager();
export default audioManager;
