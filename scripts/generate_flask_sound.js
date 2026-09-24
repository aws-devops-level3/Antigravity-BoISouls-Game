import fs from 'fs';

function generateFlaskSound() {
  const sampleRate = 44100;
  const duration = 0.85; // seconds
  const totalSamples = Math.floor(sampleRate * duration);
  const buffer = Buffer.alloc(44 + totalSamples * 2);

  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + totalSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(1, 22); // NumChannels (1 = Mono)
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate
  buffer.writeUInt16LE(2, 32); // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample
  buffer.write('data', 36);
  buffer.writeUInt32LE(totalSamples * 2, 40);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    // Phase 1: Liquid gulp / chug (0.0 to 0.35s)
    if (t < 0.35) {
      const gulpEnv = Math.sin((t / 0.35) * Math.PI);
      // Gulp frequency dip
      const gulpFreq = 180 + Math.sin(t * 45) * 50;
      const gulp = Math.sin(2 * Math.PI * gulpFreq * t);
      // Liquid bubble noise
      const bubble = (Math.sin(2 * Math.PI * 440 * t) * Math.sin(2 * Math.PI * 120 * t)) * 0.3;
      sample += (gulp * 0.6 + bubble * 0.4) * gulpEnv * 0.7;
    }

    // Phase 2: Restorative magic chime / shimmering aura (0.2s to 0.85s)
    if (t > 0.18) {
      const chimeT = t - 0.18;
      const chimeEnv = Math.exp(-chimeT * 4.2) * Math.min(1, chimeT / 0.05);

      // C-major chord harmonics: C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50)
      const h1 = Math.sin(2 * Math.PI * 523.25 * t);
      const h2 = Math.sin(2 * Math.PI * 659.25 * t + 0.5);
      const h3 = Math.sin(2 * Math.PI * 783.99 * t + 1.0);
      const h4 = Math.sin(2 * Math.PI * 1046.50 * t + 1.5);

      // Gentle tremolo shimmer
      const shimmer = 1 + 0.18 * Math.sin(2 * Math.PI * 14 * chimeT);

      const chime = (h1 * 0.35 + h2 * 0.3 + h3 * 0.25 + h4 * 0.2) * chimeEnv * shimmer;
      sample += chime * 0.85;
    }

    // Clamp
    sample = Math.max(-1, Math.min(1, sample));
    const intSample = Math.floor(sample * 32767);
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  fs.writeFileSync('public/assets/sounds/flask_drink.wav', buffer);
  if (fs.existsSync('dist/assets/sounds')) {
    fs.writeFileSync('dist/assets/sounds/flask_drink.wav', buffer);
  }
  console.log('Saved flask_drink.wav successfully!');
}

generateFlaskSound();
