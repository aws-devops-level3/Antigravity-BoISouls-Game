import sharp from 'sharp';

const UPLOADED_PATH = 'C:/Users/Pontu/.gemini/antigravity-ide/brain/1aafc9e6-1c14-47a7-8669-28d1a0c90179/.user_uploaded/media_1790268712142.png';

async function inspectUploaded() {
  const img = sharp(UPLOADED_PATH);
  const meta = await img.metadata();
  console.log('Uploaded image dimensions:', meta.width, meta.height, meta.channels);

  // Check top-left corner color (background color)
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  console.log('Top-left pixel RGB:', data[0], data[1], data[2]);
  console.log('Top-right pixel RGB:', data[(w - 1) * 4], data[(w - 1) * 4 + 1], data[(w - 1) * 4 + 2]);
}

inspectUploaded().catch(console.error);
