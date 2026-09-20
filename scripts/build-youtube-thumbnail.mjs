import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// Composite shipped branding and the supplied real screenshot. No generated UI.
// node scripts/build-youtube-thumbnail.mjs <screenshot directory> [export directory]
const source = process.argv[2];
if (!source) throw new Error('Provide the directory containing IMG_4545.JPEG.');
const out = path.resolve('public/devpost/youtube');
await fs.mkdir(out, { recursive: true });
const W = 1920, H = 1080;
const svg = body => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${body}</svg>`);
const text = (x, y, content, size, color) => `<text x="${x}" y="${y}" font-family="Arial Rounded MT Bold, Arial, sans-serif" font-size="${size}" fill="${color}">${content}</text>`;
const background = svg(`
  <rect width="1920" height="1080" fill="#fff"/>
  <path d="M1370 0H1920V1080H1210C1110 860 1135 650 1180 445C1220 260 1320 140 1370 0Z" fill="#e5f4ed"/>
  <rect x="90" y="230" width="580" height="65" rx="32" fill="#e5f4ed"/>
  ${text(121, 274, 'YOUR AI COOKING COMPANION', 31, '#147e77')}
  ${text(80, 495, 'COOK MORE.', 140, '#3f302b')}
  ${text(80, 662, 'WASTE LESS.', 140, '#168d84')}
  ${text(91, 827, 'Your pantry. Your next meal.', 47, '#75645d')}
  <rect x="1262" y="54" width="542" height="972" rx="62" fill="#40342e"/>
`);
const layers = [];
// Keep the exact Sikurepi wordmark, omitting the full logo's tiny tagline.
const wordmarkCrop = await sharp('public/icon.png').extract({ left: 160, top: 687, width: 955, height: 229 }).png().toBuffer();
// Remove only fragments of the separate emblem/tagline outside the wordmark.
const cleanWordmark = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="955" height="229"><rect x="260" y="0" width="500" height="31" fill="white"/><rect x="0" y="210" width="760" height="19" fill="white"/><rect x="880" y="210" width="75" height="19" fill="white"/></svg>');
const wordmark = await sharp(wordmarkCrop).composite([{ input: cleanWordmark }]).png().toBuffer();
layers.push({ input: await sharp(wordmark).resize({ width: 478 }).png().toBuffer(), left: 87, top: 68 });

const screenWidth = 514, screenHeight = 944;
const screenMask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${screenWidth}" height="${screenHeight}"><rect width="${screenWidth}" height="${screenHeight}" rx="48" fill="white"/></svg>`);
const screen = await sharp(path.join(source, 'IMG_4545.JPEG')).resize(screenWidth, screenHeight, { fit: 'cover', position: 'north' }).ensureAlpha().composite([{ input: screenMask, blend: 'dest-in' }]).png().toBuffer();
layers.push({ input: screen, left: 1276, top: 68 });
layers.push({ input: await sharp('public/mascot/bear_hero.png').resize(465, 465, { fit: 'contain', background: '#00000000' }).png().toBuffer(), left: 914, top: 594 });

for (const layer of layers) {
  const { width, height } = await sharp(layer.input).metadata();
  if (layer.left < 0 || layer.top < 0 || layer.left + width > W || layer.top + height > H) throw new Error('Layer outside thumbnail canvas.');
}
if (process.argv[3]) {
  await fs.mkdir(process.argv[3], { recursive: true });
  await fs.copyFile(path.join(out, 'upload-copy.md'), path.join(process.argv[3], 'upload-copy.md'));
}
const composed = await sharp(background).composite(layers).flatten({ background: '#fff' }).png().toBuffer();
await sharp(composed).png({ compressionLevel: 9 }).toFile(path.join(out, 'sikurepi-youtube-thumbnail.png'));
await sharp(composed).jpeg({ quality: 94, mozjpeg: true, chromaSubsampling: '4:4:4' }).toFile(path.join(out, 'sikurepi-youtube-thumbnail.jpg'));
await sharp(composed).resize(480, 270).jpeg({ quality: 90 }).toFile(path.join(out, 'sikurepi-youtube-thumbnail-small.jpg'));
for (const name of ['sikurepi-youtube-thumbnail.png', 'sikurepi-youtube-thumbnail.jpg', 'sikurepi-youtube-thumbnail-small.jpg']) {
  const file = path.join(out, name);
  console.log(`${name}: ${((await fs.stat(file)).size / 1e6).toFixed(2)} MB`);
  if (process.argv[3]) {
    await fs.mkdir(process.argv[3], { recursive: true });
    await fs.copyFile(file, path.join(process.argv[3], name));
  }
}
