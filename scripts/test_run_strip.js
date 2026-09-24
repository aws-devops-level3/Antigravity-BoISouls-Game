import sharp from 'sharp';

const SOURCE_PATH = 'C:/Users/Pontu/.gemini/antigravity-ide/brain/1aafc9e6-1c14-47a7-8669-28d1a0c90179/.user_uploaded/media_1790263452356.png';

async function testStrip() {
  const { data, info } = await sharp(SOURCE_PATH).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  console.log(`Source dimensions: ${width}x${height}, channels=${channels}`);

  // Frame width is width / 8 = 128
  const frameW = 128;
  const frameH = height; // 179

  for (let f = 0; f < 8; f++) {
    let minX = 128, maxX = 0, minY = 179, maxY = 0;
    let visiblePixels = 0;

    for (let y = 0; y < frameH; y++) {
      for (let x = 0; x < frameW; x++) {
        const srcX = f * frameW + x;
        const idx = (y * width + srcX) * channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = channels === 4 ? data[idx + 3] : 255;

        // Is green halo / background?
        const isGreen = g > 40 && g > r * 1.15 && g > b * 1.15;
        // Also edge specks
        const isFrame2Artifact = f === 2 && x < 9 && y > 120;
        const isBorderSpeck = (x <= 1 || x >= 126) && y < 165;

        if (a > 30 && !isGreen && !isFrame2Artifact && !isBorderSpeck) {
          visiblePixels++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    console.log(`Frame ${f}: visiblePixels=${visiblePixels}, X=[${minX}..${maxX}] (w=${maxX - minX + 1}), Y=[${minY}..${maxY}] (h=${maxY - minY + 1}), Ground Y=${maxY}`);
  }
}

testStrip().catch(console.error);
