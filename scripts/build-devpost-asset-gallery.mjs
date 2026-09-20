import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// Compose the shipped artwork without generating or repainting assets.
// Usage: node scripts/build-devpost-asset-gallery.mjs [optional export directory]
const root = process.cwd();
const out = path.join(root, 'public/devpost/gallery');
const W = 1920, H = 1080;
const ink = '#40302c', teal = '#17948d', pink = '#de5075', muted = '#806b62';
const escape = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const txt = (x, y, content, size = 32, color = ink, anchor = 'start', family = 'Arial Rounded MT Bold', spacing = 0) =>
  `<text x="${x}" y="${y}" fill="${color}" font-family="${family}, Arial, sans-serif" font-size="${size}" text-anchor="${anchor}" letter-spacing="${spacing}">${escape(content)}</text>`;
const svg = body => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`);
const base = (section, tone = 'mint') => `
  <defs>
    <linearGradient id="wash" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fffaf3"/><stop offset=".55" stop-color="#fffcf8"/><stop offset="1" stop-color="${tone === 'pink' ? '#ffe9ee' : tone === 'gold' ? '#fff0cf' : '#e5f5ed'}"/></linearGradient>
    <radialGradient id="glow"><stop stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#wash)"/>
  <ellipse cx="1510" cy="600" rx="650" ry="570" fill="url(#glow)"/>
  ${txt(80, 78, 'SIKUREPI', 26, teal, 'start', 'Arial', 7)}
  ${txt(1840, 78, section, 19, muted, 'end', 'Arial', 4)}
  <path d="M80 1012 H1840" stroke="#a48a73" stroke-opacity=".2"/>
  ${txt(80, 1044, 'A little joy in every meal.', 20, muted)}
  ${txt(1840, 1044, 'SIKUREPI', 16, teal, 'end', 'Arial', 5)}
`;

// Alpha-aware cropping removes only transparent padding, not the painted shape.
const cache = new Map();
async function artwork(relative) {
  if (cache.has(relative)) return cache.get(relative);
  const image = sharp(path.join(root, 'public', relative));
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 8) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  if (x1 < x0) throw new Error(`Empty artwork: ${relative}`);
  const buffer = await sharp(path.join(root, 'public', relative)).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }).png().toBuffer();
  cache.set(relative, buffer);
  return buffer;
}
async function place(layers, file, x, y, width, height) {
  const input = await sharp(await artwork(file)).resize(width, height, { fit: 'contain', background: '#00000000' }).png().toBuffer();
  if (x < 0 || y < 0 || x + width > W || y + height > H) throw new Error(`Out-of-bounds placement: ${file}`);
  layers.push({ input, left: x, top: y });
}
async function save(name, body, layers, foreground = '') {
  const target = path.join(out, name);
  await sharp(svg(body)).composite([...layers, { input: svg(foreground), left: 0, top: 0 }]).removeAlpha().png({ compressionLevel: 9 }).toFile(target);
  const stat = await fs.stat(target);
  console.log(`${name}: ${W} x ${H}, ${(stat.size / 1e6).toFixed(2)} MB`);
  if (process.argv[2]) {
    await fs.mkdir(process.argv[2], { recursive: true });
    await fs.copyFile(target, path.join(process.argv[2], name));
  }
}
await fs.mkdir(out, { recursive: true });

// Tray collection: a large bear tray balances four classic colorways.
{
  let body = base('THE TRAY COLLECTION', 'pink');
  body += txt(80, 190, 'SET THE TABLE.', 94);
  body += txt(80, 292, 'MAKE IT YOURS.', 94);
  body += txt(1280, 185, 'Five tray themes.', 37, teal);
  body += txt(1280, 239, 'A little more you.', 37, muted);
  body += '<ellipse cx="440" cy="823" rx="320" ry="80" fill="#ead6ba" opacity=".25"/>';
  const layers = [];
  await place(layers, 'serving/recipe-tray-bear-v1.png', 65, 382, 750, 508);
  await place(layers, 'dishes/icons/roast_chicken.png', 225, 512, 229, 222);
  await place(layers, 'dishes/icons/salad.png', 487, 519, 155, 161);
  await place(layers, 'dishes/icons/bread_loaf.png', 488, 688, 130, 99);
  let foreground = txt(442, 944, 'BEAR', 27, muted, 'middle', 'Arial', 5);
  const themes = [
    ['wood', 'NATURAL', 'grilled_fish', 'plain_rice'],
    ['mint', 'MINT', 'pasta', 'salad'],
    ['sakura', 'SAKURA', 'strawberry_cake', 'hot_drink'],
    ['midnight', 'MIDNIGHT', 'steak', 'roasted_vegetables'],
  ];
  for (let i = 0; i < themes.length; i++) {
    const [id, label, dish1, dish2] = themes[i];
    const x = 855 + (i % 2) * 500, y = 357 + Math.floor(i / 2) * 352;
    await place(layers, `serving/recipe-tray-${id}-3q.png`, x, y, 475, 216);
    await place(layers, `dishes/icons/${dish1}.png`, x + 82, y + 31, 158, 137);
    await place(layers, `dishes/icons/${dish2}.png`, x + 258, y + 45, 116, 116);
    foreground += txt(x + 237, y + 255, label, 26, muted, 'middle', 'Arial', 5);
  }
  await save('02-tray-collection.png', body, layers, foreground);
}

// Mascot character sheet: one hero plus every other shipped mascot pose.
{
  let body = base('MEET THE MASCOT', 'mint');
  body += txt(80, 231, 'YOUR LITTLE', 77);
  body += txt(80, 324, 'CHEF.', 115, teal);
  body += txt(83, 395, 'A whole lot of heart.', 35, muted);
  body += '<ellipse cx="353" cy="873" rx="225" ry="38" fill="#d9e8dc" opacity=".65"/>';
  body += txt(352, 950, 'HERE FOR EVERY STEP.', 22, teal, 'middle', 'Arial', 3);
  const layers = [];
  await place(layers, 'mascot/bear_hero.png', 138, 459, 430, 430);
  const poses = [
    ['wave', 'HELLO'], ['basket', 'GATHER'], ['running', 'LET’S GO'], ['reading', 'DISCOVER'], ['serving', 'SERVE'],
    ['delivering', 'ON MY WAY'], ['itadakimasu', 'ENJOY'], ['excited', 'CELEBRATE'], ['love', 'WITH LOVE'], ['sleeping', 'RECHARGE'],
  ];
  let foreground = '';
  for (let i = 0; i < poses.length; i++) {
    const [pose, label] = poses[i];
    const x = 699 + (i % 5) * 232, y = 236 + Math.floor(i / 5) * 369;
    body += `<rect x="${x}" y="${y}" width="207" height="244" rx="56" fill="${i % 3 === 0 ? '#fceef0' : i % 3 === 1 ? '#faf0dd' : '#eaf4ee'}" opacity=".7"/>`;
    await place(layers, `mascot/bear_${pose}.png`, x + 16, y + 28, 175, 184);
    foreground += txt(x + 103, y + 290, label, 19, muted, 'middle', 'Arial', 2);
  }
  await save('03-meet-your-chef.png', body, layers, foreground);
}

// Badges use the exact order and English rank names from the application.
{
  let body = base('THE CHEF RANKS', 'gold');
  body += txt(80, 188, '10 RANKS.', 108, teal);
  body += txt(703, 178, 'ONE COOKING JOURNEY.', 66);
  body += txt(707, 235, 'A new badge. Another reason to cook.', 31, muted);
  const ranks = [
    ['commis', 'Commis'], ['premier_commis', 'Premier Commis'], ['garde_manger', 'Garde-Manger'],
    ['poissonnier', 'Poissonnier'], ['rotisseur', 'Rôtisseur'], ['saucier', 'Saucier'], ['aboyer', 'Aboyer'],
    ['sous_chef', 'Sous-Chef'], ['chef_de_cuisine', 'Chef de Cuisine'], ['chef_executif', 'Chef Exécutif'],
  ];
  const layers = [];
  let foreground = '';
  for (let i = 0; i < ranks.length; i++) {
    const [asset, name] = ranks[i];
    const cx = 238 + (i % 5) * 361, y = 326 + Math.floor(i / 5) * 363;
    if (i === 9) body += `<rect x="${cx - 156}" y="${y - 47}" width="312" height="346" rx="46" fill="#fff3cf" stroke="#dfb44f" stroke-width="2"/>`;
    body += `<ellipse cx="${cx}" cy="${y + 217}" rx="107" ry="20" fill="#ccbca7" opacity=".22"/>`;
    body += txt(cx, y - 12, `LEVEL ${String(i + 1).padStart(2, '0')}`, 19, i === 9 ? '#ad781c' : teal, 'middle', 'Arial', 3);
    await place(layers, `ranks/${asset}.png`, cx - 103, y + 5, 206, 233);
    foreground += txt(cx, y + 275, name, 28, ink, 'middle');
  }
  await save('04-chef-ranks.png', body, layers, foreground);
}
