import sharp from 'sharp';
import fs from 'fs';

const UPLOADED_PATH = 'C:/Users/Pontu/.gemini/antigravity-ide/brain/1aafc9e6-1c14-47a7-8669-28d1a0c90179/.user_uploaded/media_1790268712142.png';

async function processFlask() {
  const { data, info } = await sharp(UPLOADED_PATH).raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;

  // We will do a BFS flood fill from all border pixels
  const isBg = new Uint8Array(w * h);
  const queue = [];

  function isBgPixel(r, g, b) {
    // Background is near 238, 233, 227
    return r > 210 && g > 205 && b > 195 && Math.abs(r - g) < 20 && Math.abs(r - b) < 30;
  }

  // Push border pixels
  for (let x = 0; x < w; x++) {
    queue.push(x, 0);
    queue.push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    queue.push(0, y);
    queue.push(w - 1, y);
  }

  let head = 0;
  while (head < queue.length) {
    const x = queue[head++];
    const y = queue[head++];
    const idx = y * w + x;
    if (isBg[idx]) continue;

    const pIdx = idx * 4;
    const r = data[pIdx];
    const g = data[pIdx + 1];
    const b = data[pIdx + 2];

    if (isBgPixel(r, g, b)) {
      isBg[idx] = 1;
      // Neighbors
      if (x > 0 && !isBg[idx - 1]) queue.push(x - 1, y);
      if (x < w - 1 && !isBg[idx + 1]) queue.push(x + 1, y);
      if (y > 0 && !isBg[idx - w]) queue.push(x, y - 1);
      if (y < h - 1 && !isBg[idx + w]) queue.push(x, y + 1);
    }
  }

  console.log(`Flood fill identified ${queue.length / 2} visited pixels.`);

  // Create transparent buffer and find bounding box of the flask
  let minX = w, maxX = 0, minY = h, maxY = 0;
  const outBuf = Buffer.alloc(w * h * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const pIdx = idx * 4;
      const r = data[pIdx];
      const g = data[pIdx + 1];
      const b = data[pIdx + 2];

      if (isBg[idx]) {
        outBuf[pIdx] = 0;
        outBuf[pIdx + 1] = 0;
        outBuf[pIdx + 2] = 0;
        outBuf[pIdx + 3] = 0;
      } else {
        outBuf[pIdx] = r;
        outBuf[pIdx + 1] = g;
        outBuf[pIdx + 2] = b;
        outBuf[pIdx + 3] = 255;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  console.log(`Flask bounds: [${minX}..${maxX}], [${minY}..${maxY}], width=${maxX - minX + 1}, height=${maxY - minY + 1}`);

  // Crop tightly with 8px margin
  const cropLeft = Math.max(0, minX - 8);
  const cropTop = Math.max(0, minY - 8);
  const cropW = Math.min(w - cropLeft, (maxX - minX + 1) + 16);
  const cropH = Math.min(h - cropTop, (maxY - minY + 1) + 16);

  const cropped = await sharp(outBuf, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: cropLeft, top: cropTop, width: cropW, height: cropH })
    .png()
    .toBuffer();

  // Save full resolution transparent version
  await sharp(cropped).toFile('C:/Users/Pontu/.gemini/antigravity-ide/brain/1aafc9e6-1c14-47a7-8669-28d1a0c90179/scratch/flask_transparent_full.png');
  console.log('Saved scratch/flask_transparent_full.png');

  // Let's create high quality square sprite for game assets
  // e.g. 128x128 or 96x96 for crisp detailed display
  const targetSize = 128;
  const resized = await sharp(cropped)
    .resize(targetSize, targetSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' })
    .png()
    .toBuffer();

  await sharp(resized).toFile('public/assets/flask_red.png');
  if (fs.existsSync('dist/assets')) {
    await sharp(resized).toFile('dist/assets/flask_red.png');
  }
  console.log('Saved public/assets/flask_red.png (128x128)');

  // Now create the empty version (flask_red_empty.png):
  // Desaturate, dim, and empty out the vibrant liquid core so it looks like an empty dark glass vial
  const { data: resData, info: resInfo } = await sharp(resized).raw().toBuffer({ resolveWithObject: true });
  const emptyBuf = Buffer.from(resData);

  for (let i = 0; i < emptyBuf.length; i += 4) {
    const a = emptyBuf[i + 3];
    if (a > 10) {
      const r = emptyBuf[i];
      const g = emptyBuf[i + 1];
      const b = emptyBuf[i + 2];

      // If it's the red/orange blood liquid (r > 100 && r > g * 1.2), turn it into dark translucent residue
      if (r > 100 && r > g * 1.2) {
        // Dark dried blood/glass residue
        emptyBuf[i] = Math.round(r * 0.25);
        emptyBuf[i + 1] = Math.round(g * 0.15);
        emptyBuf[i + 2] = Math.round(b * 0.15);
        emptyBuf[i + 3] = Math.round(a * 0.45);
      } else {
        // Outline & glass reflections: keep but slightly dimmed
        emptyBuf[i] = Math.round(r * 0.7);
        emptyBuf[i + 1] = Math.round(g * 0.7);
        emptyBuf[i + 2] = Math.round(b * 0.7);
        emptyBuf[i + 3] = Math.round(a * 0.6);
      }
    }
  }

  await sharp(emptyBuf, { raw: { width: targetSize, height: targetSize, channels: 4 } })
    .png()
    .toFile('public/assets/flask_red_empty.png');

  if (fs.existsSync('dist/assets')) {
    await sharp(emptyBuf, { raw: { width: targetSize, height: targetSize, channels: 4 } })
      .png()
      .toFile('dist/assets/flask_red_empty.png');
  }
  console.log('Saved public/assets/flask_red_empty.png (128x128)');
}

processFlask().catch(console.error);
