import fs from 'fs';
import sharp from 'sharp';

const srcPath = 'C:\\Users\\Pontu\\.gemini\\antigravity-ide\\brain\\369567c8-5b06-4a3c-ae0b-f05bfb3dbb88\\.user_uploaded\\media_1790089625134.jpg';

// Load raw RGB
const { data, info } = await sharp(srcPath).raw().toBuffer({ resolveWithObject: true });
const w = info.width;
const h = info.height;
const ch = info.channels;

console.log('Image dimensions:', w, h, 'channels:', ch);

// Clone buffer for de-gridding
const cleanData = Buffer.from(data);

function getPixel(buf, x, y) {
  if (x < 0) x = 0; if (x >= w) x = w - 1;
  if (y < 0) y = 0; if (y >= h) y = h - 1;
  const idx = (y * w + x) * ch;
  return [buf[idx], buf[idx+1], buf[idx+2]];
}

function setPixel(buf, x, y, rgb) {
  if (x < 0 || x >= w || y < 0 || y >= h) return;
  const idx = (y * w + x) * ch;
  buf[idx] = rgb[0];
  buf[idx+1] = rgb[1];
  buf[idx+2] = rgb[2];
}

// Map scale: 6750 x 4800, grid: 150
const origW = 6750;
const origH = 4800;
const gridSize = 150;

let removedV = 0, removedH = 0;

// Pass 1: Vertical grid lines
for (let y = 0; y < h; y++) {
  const origY = y * (origH / h);
  for (let x = 1; x < w - 1; x++) {
    const origX = x * (origW / w);
    const modX = origX % gridSize;
    const distToGridX = Math.min(modX, gridSize - modX);
    const pxDistX = distToGridX * (w / origW);

    if (pxDistX < 1.2) {
      const left2 = getPixel(data, x - 2, y);
      const left1 = getPixel(data, x - 1, y);
      const curr = getPixel(data, x, y);
      const right1 = getPixel(data, x + 1, y);
      const right2 = getPixel(data, x + 2, y);

      const currLum = 0.299 * curr[0] + 0.587 * curr[1] + 0.114 * curr[2];
      const neighborLum = 0.5 * (
        (0.299 * left1[0] + 0.587 * left1[1] + 0.114 * left1[2]) +
        (0.299 * right1[0] + 0.587 * right1[1] + 0.114 * right1[2])
      );

      if (currLum > neighborLum + 2.0) {
        const newR = Math.round(left1[0] * 0.5 + right1[0] * 0.5);
        const newG = Math.round(left1[1] * 0.5 + right1[1] * 0.5);
        const newB = Math.round(left1[2] * 0.5 + right1[2] * 0.5);
        setPixel(cleanData, x, y, [newR, newG, newB]);
        removedV++;
      }
    }
  }
}

// Pass 2: Horizontal grid lines
for (let y = 1; y < h - 1; y++) {
  const origY = y * (origH / h);
  const modY = origY % gridSize;
  const distToGridY = Math.min(modY, gridSize - modY);
  const pxDistY = distToGridY * (h / origH);

  if (pxDistY < 1.2) {
    for (let x = 0; x < w; x++) {
      const top1 = getPixel(cleanData, x, y - 1);
      const curr = getPixel(cleanData, x, y);
      const btm1 = getPixel(cleanData, x, y + 1);

      const currLum = 0.299 * curr[0] + 0.587 * curr[1] + 0.114 * curr[2];
      const neighborLum = 0.5 * (
        (0.299 * top1[0] + 0.587 * top1[1] + 0.114 * top1[2]) +
        (0.299 * btm1[0] + 0.587 * btm1[1] + 0.114 * btm1[2])
      );

      if (currLum > neighborLum + 2.0) {
        const newR = Math.round(top1[0] * 0.5 + btm1[0] * 0.5);
        const newG = Math.round(top1[1] * 0.5 + btm1[1] * 0.5);
        const newB = Math.round(top1[2] * 0.5 + btm1[2] * 0.5);
        setPixel(cleanData, x, y, [newR, newG, newB]);
        removedH++;
      }
    }
  }
}

console.log('Removed grid artifacts: V =', removedV, 'H =', removedH);

// Upscale to 2835 x 2016 with Lanczos3 and apply high-definition sharpening
const targetW = 2835;
const targetH = 2016;

const cleanedImg = await sharp(cleanData, { raw: { width: w, height: h, channels: ch } })
  .resize(targetW, targetH, {
    kernel: sharp.kernel.lanczos3,
    fastShrinkOnLoad: false
  })
  // High-definition sharpening to reveal rich stone cracks, wood grain, foliage & light highlights
  .sharpen({
    sigma: 1.4,
    m1: 1.8,
    m2: 3.2,
    x1: 2.0,
    y2: 15.0
  })
  // Enhance contrast slightly so dark dungeon stone is deep and torchlight pops
  .linear(1.08, -6)
  .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
  .toBuffer();

const outPublic = 'c:\\Users\\Pontu\\OneDrive\\Skrivbord\\Antigravity BoISouls Game\\public\\assets\\dungeon_level1.jpg';
const outArtifact = 'C:\\Users\\Pontu\\.gemini\\antigravity-ide\\brain\\369567c8-5b06-4a3c-ae0b-f05bfb3dbb88\\scratch\\dungeon_level1_enhanced.jpg';

fs.writeFileSync(outPublic, cleanedImg);
fs.writeFileSync(outArtifact, cleanedImg);

console.log('Successfully saved enhanced 2835x2016 battlemap to:', outPublic, `(${cleanedImg.length} bytes)`);
