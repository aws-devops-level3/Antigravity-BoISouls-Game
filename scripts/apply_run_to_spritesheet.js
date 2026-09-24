import sharp from 'sharp';
import fs from 'fs';

const CLEANED_STRIP = 'C:/Users/Pontu/.gemini/antigravity-ide/brain/1aafc9e6-1c14-47a7-8669-28d1a0c90179/scratch/frames/cleaned_run_strip_perfect.png';
const TARGET_SHEET_PUBLIC = 'public/assets/player_spritesheet.png';
const TARGET_SHEET_DIST = 'dist/assets/player_spritesheet.png';

async function applyRunFrames() {
  console.log('Loading base spritesheet...');
  const baseSheetBuffer = await sharp(TARGET_SHEET_PUBLIC).raw().toBuffer({ resolveWithObject: true });
  const sheetW = baseSheetBuffer.info.width;  // 1120
  const sheetH = baseSheetBuffer.info.height; // 600
  const sheetData = Buffer.from(baseSheetBuffer.data);

  // Clear Row 1 completely (y: 120..239)
  for (let y = 120; y < 240; y++) {
    for (let x = 0; x < sheetW; x++) {
      const idx = (y * sheetW + x) * 4;
      sheetData[idx] = 0;
      sheetData[idx + 1] = 0;
      sheetData[idx + 2] = 0;
      sheetData[idx + 3] = 0;
    }
  }

  const scale = 100 / 174;
  const scaledW = Math.round(128 * scale); // 74
  const scaledH = Math.round(179 * scale); // 103
  const cellLeftOffset = Math.round((112 - scaledW) / 2); // 19
  const cellTopOffset = 112 - Math.round(178 * scale); // 10

  console.log(`Scaled frame: ${scaledW}x${scaledH}, offset in cell: (${cellLeftOffset}, ${cellTopOffset})`);

  for (let f = 0; f < 8; f++) {
    // Extract frame f from cleaned strip
    const frameBuffer = await sharp(CLEANED_STRIP)
      .extract({ left: f * 128, top: 0, width: 128, height: 179 })
      .resize(scaledW, scaledH, { kernel: 'lanczos3' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const fData = frameBuffer.data;
    const fW = frameBuffer.info.width;
    const fH = frameBuffer.info.height;

    // Paste into Row 1, Column f (cell x = f * 112, cell y = 120)
    const destStartX = f * 112 + cellLeftOffset;
    const destStartY = 120 + cellTopOffset;

    for (let py = 0; py < fH; py++) {
      for (let px = 0; px < fW; px++) {
        const srcIdx = (py * fW + px) * 4;
        const targetX = destStartX + px;
        const targetY = destStartY + py;

        if (targetX < sheetW && targetY < sheetH) {
          const destIdx = (targetY * sheetW + targetX) * 4;
          const sa = fData[srcIdx + 3];
          if (sa > 10) {
            sheetData[destIdx] = fData[srcIdx];
            sheetData[destIdx + 1] = fData[srcIdx + 1];
            sheetData[destIdx + 2] = fData[srcIdx + 2];
            sheetData[destIdx + 3] = sa;
          }
        }
      }
    }
  }

  // Save updated sheet to public and dist
  await sharp(sheetData, { raw: { width: sheetW, height: sheetH, channels: 4 } })
    .png()
    .toFile(TARGET_SHEET_PUBLIC);
  console.log('Updated ' + TARGET_SHEET_PUBLIC);

  if (fs.existsSync('dist/assets')) {
    await sharp(sheetData, { raw: { width: sheetW, height: sheetH, channels: 4 } })
      .png()
      .toFile(TARGET_SHEET_DIST);
    console.log('Updated ' + TARGET_SHEET_DIST);
  }

  // Also save a crop of Row 0 (Idle) and Row 1 (Run) stacked together for visual comparison
  const preview = await sharp(sheetData, { raw: { width: sheetW, height: sheetH, channels: 4 } })
    .extract({ left: 0, top: 0, width: 1120, height: 240 })
    .png()
    .toFile('C:/Users/Pontu/.gemini/antigravity-ide/brain/1aafc9e6-1c14-47a7-8669-28d1a0c90179/scratch/frames/idle_and_run_comparison.png');
  console.log('Saved idle_and_run_comparison.png');
}

applyRunFrames().catch(console.error);
