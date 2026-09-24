import sharp from 'sharp';

const SOURCE_PATH = 'C:/Users/Pontu/.gemini/antigravity-ide/brain/1aafc9e6-1c14-47a7-8669-28d1a0c90179/.user_uploaded/media_1790263452356.png';

async function processAndTest() {
  const { data, info } = await sharp(SOURCE_PATH).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const frameW = 128;
  const frameH = height; // 179

  // Clean green and artifacts in raw buffer
  const cleanedBuffer = Buffer.alloc(width * height * 4);

  for (let f = 0; f < 8; f++) {
    for (let y = 0; y < frameH; y++) {
      for (let x = 0; x < frameW; x++) {
        const srcX = f * frameW + x;
        const srcIdx = (y * width + srcX) * channels;
        const destIdx = (y * width + srcX) * 4;

        let r = data[srcIdx];
        let g = data[srcIdx + 1];
        let b = data[srcIdx + 2];
        let a = channels === 4 ? data[srcIdx + 3] : 255;

        // Clean green background & halo
        const isGreen = g > 40 && g > r * 1.15 && g > b * 1.15;
        // Stray crop artifact on frame 2 left border
        const isFrame2Artifact = f === 2 && x < 9 && y > 120;
        // Edge border specks
        const isBorderSpeck = (x <= 1 || x >= 126) && y < 165;

        if (isGreen || isFrame2Artifact || isBorderSpeck) {
          cleanedBuffer[destIdx] = 0;
          cleanedBuffer[destIdx + 1] = 0;
          cleanedBuffer[destIdx + 2] = 0;
          cleanedBuffer[destIdx + 3] = 0;
        } else {
          // Desaturate any slight green edge fringe
          if (g > r && g > b) {
            g = Math.round((r + b) / 2);
          }
          cleanedBuffer[destIdx] = r;
          cleanedBuffer[destIdx + 1] = g;
          cleanedBuffer[destIdx + 2] = b;
          cleanedBuffer[destIdx + 3] = a;
        }
      }
    }
  }

  // Save full cleaned strip for verification
  await sharp(cleanedBuffer, { raw: { width, height, channels: 4 } })
    .png()
    .toFile('C:/Users/Pontu/.gemini/antigravity-ide/brain/1aafc9e6-1c14-47a7-8669-28d1a0c90179/scratch/frames/cleaned_run_strip_perfect.png');

  console.log('Saved cleaned_run_strip_perfect.png');
}

processAndTest().catch(console.error);
