import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// Use the user's real screenshots as supplied; never reconstruct app data.
// node scripts/build-devpost-screen-gallery.mjs <source directory> [export directory]
const source = process.argv[2];
if (!source) throw new Error('Provide the directory containing IMG_4541.JPEG through IMG_4546.JPEG.');
const output = path.resolve('public/devpost/gallery');
await fs.mkdir(output, { recursive: true });
const W = 1920, H = 1280;
const text = (x, y, s, size, color = '#40302c', anchor = 'start') => `<text x="${x}" y="${y}" font-family="Arial Rounded MT Bold, Arial, sans-serif" font-size="${size}" fill="${color}" text-anchor="${anchor}">${s.replaceAll('&', '&amp;')}</text>`;
const svg = s => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${s}</svg>`);
const background = `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff9ee"/><stop offset=".55" stop-color="#fffcf8"/><stop offset="1" stop-color="#eaf6ef"/></linearGradient></defs><rect width="1920" height="1280" fill="url(#bg)"/>`;

async function cropScreen(name, rect, width, radius = 0) {
  const file = path.join(source, name);
  const metadata = await sharp(file).metadata();
  const [x, y, w, h] = rect;
  const cropped = await sharp(file).extract({ left: Math.round(x * metadata.width), top: Math.round(y * metadata.height), width: Math.round(w * metadata.width), height: Math.round(h * metadata.height) }).resize({ width }).png().toBuffer();
  if (!radius) return cropped;
  const { height } = await sharp(cropped).metadata();
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" fill="white"/></svg>`);
  return sharp(cropped).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}
async function icon(relative, size) {
  return sharp(path.join('public', relative)).resize(size, size, { fit: 'contain', background: '#00000000' }).png().toBuffer();
}
async function save(name, body, layers) {
  for (const layer of layers) {
    const { width, height } = await sharp(layer.input).metadata();
    if (layer.left < 0 || layer.top < 0 || layer.left + width > W || layer.top + height > H) throw new Error(`Out of bounds: ${name}`);
  }
  const target = path.join(output, name);
  await sharp(svg(background + body)).composite(layers).flatten({ background: '#fffaf4' }).png({ compressionLevel: 9 }).toFile(target);
  if (process.argv[3]) {
    await fs.mkdir(process.argv[3], { recursive: true });
    await fs.copyFile(target, path.join(process.argv[3], name));
  }
  console.log(`${name}: 1920 x 1280, ${((await fs.stat(target)).size / 1e6).toFixed(2)} MB`);
}

{
  let body = text(80, 178, 'YOUR PANTRY.', 98, '#17948d');
  body += text(80, 284, 'TONIGHT’S DINNER.', 89);
  body += text(85, 365, 'Start with what you have.', 36, '#806b62');
  // Thin neutral device surround, with no added shadow or ornamental outline.
  body += '<rect x="1248" y="70" width="585" height="1150" rx="48" fill="#e2dad0"/>';
  const layers = [
    { input: await cropScreen('IMG_4544.JPEG', [.034, .445, .921, .443], 820, 38), left: 80, top: 475 },
    { input: await cropScreen('IMG_4545.JPEG', [0, 0, 1, 1], 555, 34), left: 1263, top: 85 },
  ];
  for (const [i, name] of ['broccoli', 'carrot', 'garlic'].entries()) {
    layers.push({ input: await icon(`ingredients/thumbs/${name}.webp`, 115), left: 1010, top: 549 + i * 201 });
  }
  await save('05-pantry-to-dinner.png', body, layers);
}

{
  let body = text(80, 160, 'PLAN AHEAD.', 92, '#17948d');
  body += text(80, 266, 'COOK WHAT YOU FEEL LIKE.', 86);
  body += text(86, 340, 'A weekly plan you can change, one meal at a time.', 34, '#806b62');
  body += text(501, 673, 'SUNDAY', 29, '#17948d', 'middle');
  body += text(1419, 673, 'MONDAY', 29, '#17948d', 'middle');
  const layers = [
    { input: await icon('dishes/icons/fried_rice.png', 236), left: 383, top: 402 },
    { input: await icon('dishes/icons/sweet_sour_pork.png', 236), left: 1301, top: 402 },
    { input: await cropScreen('IMG_4546.JPEG', [.034, .073, .925, .264], 802, 39), left: 100, top: 707 },
    { input: await cropScreen('IMG_4546.JPEG', [.034, .400, .925, .223], 802, 39), left: 1018, top: 707 },
  ];
  await save('06-weekly-possibilities.png', body, layers);
}
