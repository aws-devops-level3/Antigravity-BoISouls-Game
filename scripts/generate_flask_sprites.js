import sharp from 'sharp';
import fs from 'fs';

async function generateFlaskSprites() {
  const size = 32;

  function createFlaskBuffer(full) {
    const buf = Buffer.alloc(size * size * 4); // RGBA

    function setPixel(x, y, r, g, b, a = 255) {
      if (x < 0 || x >= size || y < 0 || y >= size) return;
      const idx = (y * size + x) * 4;
      // Alpha composite over existing
      const curA = buf[idx + 3] / 255;
      const newA = a / 255;
      const outA = newA + curA * (1 - newA);
      if (outA > 0) {
        buf[idx] = Math.round((r * newA + buf[idx] * curA * (1 - newA)) / outA);
        buf[idx + 1] = Math.round((g * newA + buf[idx + 1] * curA * (1 - newA)) / outA);
        buf[idx + 2] = Math.round((b * newA + buf[idx + 2] * curA * (1 - newA)) / outA);
        buf[idx + 3] = Math.round(outA * 255);
      }
    }

    // 1. Cork stopper (y: 2..5, x: 13..18)
    for (let y = 2; y <= 5; y++) {
      for (let x = 13; x <= 18; x++) {
        if (x === 13 || x === 18 || y === 2) {
          setPixel(x, y, 70, 42, 20, 240); // outline
        } else {
          const highlight = (x === 14 && y === 3);
          setPixel(x, y, highlight ? 180 : 130, highlight ? 115 : 75, highlight ? 65 : 40, 255);
        }
      }
    }

    // 2. Neck (y: 6..10, x: 13..18)
    for (let y = 6; y <= 10; y++) {
      for (let x = 13; x <= 18; x++) {
        if (x === 13 || x === 18) {
          setPixel(x, y, 40, 30, 45, 230); // dark glass rim
        } else {
          if (full && y >= 8) {
            setPixel(x, y, 190, 25, 40, 240); // neck liquid
          } else {
            setPixel(x, y, 90, 110, 130, 120); // empty glass
          }
        }
      }
    }

    // 3. Rounded Bottle Body (y: 11..27, center x: 15.5, center y: 19)
    const centerX = 15.5;
    const centerY = 19.0;
    const radiusX = 8.5;
    const radiusY = 8.0;

    for (let y = 10; y <= 28; y++) {
      for (let x = 6; x <= 25; x++) {
        const dx = (x - centerX) / radiusX;
        const dy = (y - centerY) / radiusY;
        const dist = dx * dx + dy * dy;

        if (dist <= 1.08) {
          if (dist > 0.82) {
            // Glass bottle outline
            setPixel(x, y, 45, 30, 50, 240);
          } else {
            // Inside bottle
            if (full) {
              // Rich Crimson liquid gradient
              const liquidRatio = (y - 10) / 18; // 0 at top, 1 at bottom
              let r = Math.round(230 - liquidRatio * 50);
              let g = Math.round(25 - liquidRatio * 15);
              let b = Math.round(45 - liquidRatio * 20);

              // Liquid glowing center
              const innerDist = Math.sqrt((x - 14) ** 2 + (y - 18) ** 2);
              if (innerDist < 4) {
                r = Math.min(255, r + 35);
                g = Math.min(255, g + 25);
                b = Math.min(255, b + 20);
              }

              // Meniscus line at y=11
              if (y === 11) {
                r = 255; g = 80; b = 100;
              }

              setPixel(x, y, r, g, b, 245);
            } else {
              // Empty glass bottle: translucent tinted glass
              const shadow = (y >= 24) ? 50 : 25;
              setPixel(x, y, 80, 95, 110, shadow);
            }
          }
        }
      }
    }

    // Glass specular reflection highlight (arc on left shoulder and body)
    setPixel(10, 14, 255, 255, 255, 220);
    setPixel(10, 15, 255, 255, 255, 240);
    setPixel(11, 16, 255, 255, 255, 200);
    setPixel(10, 18, 255, 255, 255, 180);
    setPixel(10, 19, 255, 255, 255, 190);
    setPixel(10, 20, 255, 255, 255, 150);

    // Subtle right edge secondary rim light
    setPixel(21, 16, 255, 200, 210, 120);
    setPixel(21, 17, 255, 200, 210, 130);
    setPixel(21, 18, 255, 200, 210, 110);

    return buf;
  }

  const fullBuf = createFlaskBuffer(true);
  const emptyBuf = createFlaskBuffer(false);

  await sharp(fullBuf, { raw: { width: size, height: size, channels: 4 } })
    .png()
    .toFile('public/assets/flask_red.png');

  await sharp(emptyBuf, { raw: { width: size, height: size, channels: 4 } })
    .png()
    .toFile('public/assets/flask_red_empty.png');

  if (fs.existsSync('dist/assets')) {
    await sharp(fullBuf, { raw: { width: size, height: size, channels: 4 } })
      .png()
      .toFile('dist/assets/flask_red.png');
    await sharp(emptyBuf, { raw: { width: size, height: size, channels: 4 } })
      .png()
      .toFile('dist/assets/flask_red_empty.png');
  }

  console.log('Saved flask_red.png and flask_red_empty.png successfully!');
}

generateFlaskSprites().catch(console.error);
