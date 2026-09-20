import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// Composite original cooking photos, without generating or retouching food.
// node scripts/build-devpost-food-gallery.mjs <photo directory> [export directory]
const source = process.argv[2];
if (!source) throw new Error('Provide the original cooking photo directory.');
const output = path.resolve('public/devpost/gallery');
await fs.mkdir(output, { recursive: true });
const W = 1920, H = 1280;
const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="1920" height="1280" fill="#fffaf2"/>
  <g font-family="Arial Rounded MT Bold, Arial, sans-serif">
    <text x="80" y="157" font-size="98" fill="#17948d">FROM SIKUREPI</text>
    <text x="80" y="264" font-size="98" fill="#40302c">TO THE TABLE.</text>
    <text x="1160" y="177" font-size="34" fill="#806b62">Real meals and sweet treats,</text>
    <text x="1160" y="229" font-size="34" fill="#806b62">cooked with Sikurepi.</text>
  </g>
</svg>`);

async function photo(name, width, height, position = 'centre', options = {}) {
  let pipeline = sharp(path.join(source, name)).rotate();
  if (options.rotation || options.crop) {
    let normalized = await pipeline.png().toBuffer();
    if (options.rotation) normalized = await sharp(normalized).rotate(options.rotation).png().toBuffer();
    pipeline = sharp(normalized);
  }
  if (options.crop) {
    const metadata = await pipeline.metadata();
    const [x, y, w, h] = options.crop;
    pipeline = pipeline.extract({ left: Math.round(x * metadata.width), top: Math.round(y * metadata.height), width: Math.round(w * metadata.width), height: Math.round(h * metadata.height) });
  }
  const input = await pipeline.resize(width, height, { fit: 'cover', position }).toBuffer();
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="28" fill="white"/></svg>`);
  return sharp(input).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

const layers = [{ input: await photo('IMG_4554.JPEG', 720, 812), left: 80, top: 388 }];
const selected = [
  ['IMG_4562.JPEG', 'centre'],
  ['IMG_4573.JPEG', 'centre'],
  ['IMG_4566.JPEG', 'centre'],
  ['IMG_4572.JPEG', 'centre'],
  ['IMG_4585.JPEG', 'north'],
  ['IMG_4548.JPEG', 'centre'],
];
for (const [index, [name, position]] of selected.entries()) {
  layers.push({ input: await photo(name, 320, 394, position), left: 832 + (index % 3) * 344, top: 388 + Math.floor(index / 3) * 418 });
}
const name = '07-from-sikurepi-to-the-table.png';
const target = path.join(output, name);
await sharp(background).composite(layers).flatten({ background: '#fffaf2' }).png({ compressionLevel: 9 }).toFile(target);
const size = (await fs.stat(target)).size;
if (size > 5_000_000) throw new Error('Gallery image exceeds the 5 MB upload limit.');
if (process.argv[3]) {
  await fs.mkdir(process.argv[3], { recursive: true });
  await fs.copyFile(target, path.join(process.argv[3], name));
}
console.log(`${name}: ${W} x ${H}, ${(size / 1e6).toFixed(2)} MB`);

function heading(title, subtitle, color = '#17948d') {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="1920" height="1280" fill="#fffaf2"/>
    <g font-family="Arial Rounded MT Bold, Arial, sans-serif">
      <text x="80" y="160" font-size="98" fill="${color}">${title}</text>
      <text x="85" y="244" font-size="36" fill="#806b62">${subtitle}</text>
    </g>
  </svg>`);
}

async function saveGallery(name, base, layers) {
  for (const layer of layers) {
    const { width, height } = await sharp(layer.input).metadata();
    if (layer.left < 0 || layer.top < 0 || layer.left + width > W || layer.top + height > H) throw new Error(`Layer outside canvas: ${name}`);
  }
  const target = path.join(output, name);
  await sharp(base).composite(layers).flatten({ background: '#fffaf2' }).png({ compressionLevel: 9 }).toFile(target);
  const bytes = (await fs.stat(target)).size;
  if (bytes > 5_000_000) throw new Error(`Upload limit exceeded: ${name}`);
  if (process.argv[3]) await fs.copyFile(target, path.join(process.argv[3], name));
  console.log(`${name}: ${W} x ${H}, ${(bytes / 1e6).toFixed(2)} MB`);
}

// The two user-selected photos are the focal points; secondary photos stay small.
await saveGallery('08-homemade-sweet-treats.png', heading('YES, DESSERT TOO.', 'Crêpes, strawberry treats and more. Homemade with Sikurepi.', '#cf5674'), [
  { input: await photo('IMG_4553.JPEG', 920, 594), left: 80, top: 344 },
  { input: await photo('IMG_4584.JPEG', 816, 856, 'centre', { crop: [0, .15, 1, .62] }), left: 1024, top: 344 },
  { input: await photo('IMG_4574.JPEG', 448, 238, 'centre', { crop: [0, .2, 1, .6] }), left: 80, top: 962 },
  { input: await photo('IMG_4586.JPEG', 448, 238, 'centre', { crop: [0, .08, 1, .65] }), left: 552, top: 962 },
]);

await saveGallery('09-everyday-home-cooking.png', heading('EVERYDAY. HOMEMADE.', 'From a single dish to a full set meal. Cooked with Sikurepi.'), [
  { input: await photo('IMG_4551.JPEG', 864, 580, 'centre', { rotation: 270 }), left: 80, top: 330 },
  { input: await photo('IMG_4552.JPEG', 864, 580, 'centre', { rotation: 270 }), left: 976, top: 330 },
  { input: await photo('IMG_4555.JPEG', 568, 264), left: 80, top: 934 },
  { input: await photo('IMG_4550.JPEG', 568, 264), left: 676, top: 934 },
  { input: await photo('IMG_4564.JPEG', 568, 264), left: 1272, top: 934 },
]);
