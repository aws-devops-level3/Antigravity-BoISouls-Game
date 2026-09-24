import sharp from 'sharp';

async function check() {
  const sheet = sharp('public/assets/player_spritesheet.png');
  const meta = await sheet.metadata();
  console.log('player_spritesheet meta:', meta.width, meta.height);

  // Extract frame 0 (x: 0..112, y: 0..120)
  const { data, info } = await sharp('public/assets/player_spritesheet.png')
    .extract({ left: 0, top: 0, width: 112, height: 120 })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let minX = 112, maxX = 0, minY = 120, maxY = 0;
  for (let y = 0; y < 120; y++) {
    for (let x = 0; x < 112; x++) {
      const idx = (y * 112 + x) * 4;
      if (data[idx + 3] > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  console.log(`Frame 0 bounds: X=[${minX}..${maxX}] (w=${maxX - minX + 1}), Y=[${minY}..${maxY}] (h=${maxY - minY + 1})`);
  console.log(`Ground Y baseline: ${maxY}, Center X: ${(minX + maxX) / 2}`);
}

check().catch(console.error);
