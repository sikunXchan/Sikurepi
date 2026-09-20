import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const WIDTH = 1920;
const HEIGHT = 1080;
const ingredientDirectory = path.join(ROOT, 'public', 'ingredients', 'thumbs');
const dishDirectory = path.join(ROOT, 'public', 'dishes', 'icons');
const mascotPath = path.join(ROOT, 'public', 'mascot', 'bear_excited.png');
const outputDirectory = path.join(ROOT, 'public', 'devpost', 'gallery');
const outputPath = path.join(outputDirectory, '01-food-illustrations.png');

const imageExtensions = /\.(png|webp|jpe?g)$/i;
const ingredientFiles = (await fs.readdir(ingredientDirectory))
  .filter((name) => imageExtensions.test(name))
  .sort((a, b) => a.localeCompare(b));
const dishFiles = (await fs.readdir(dishDirectory))
  .filter((name) => imageExtensions.test(name))
  .sort((a, b) => a.localeCompare(b));

if (ingredientFiles.length !== 385) {
  throw new Error(`Expected 385 ingredient icons, found ${ingredientFiles.length}`);
}
if (dishFiles.length !== 150) {
  throw new Error(`Expected 150 dish icons, found ${dishFiles.length}`);
}

await fs.mkdir(outputDirectory, { recursive: true });

const background = Buffer.from(`
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff9f2"/>
      <stop offset="0.56" stop-color="#fffdf9"/>
      <stop offset="1" stop-color="#eefaf6"/>
    </linearGradient>
    <radialGradient id="rose" cx="0" cy="0" r="1" gradientTransform="translate(90 990) rotate(-20) scale(740 500)">
      <stop stop-color="#ffdfe8" stop-opacity="0.72"/>
      <stop offset="1" stop-color="#ffdfe8" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="mint" cx="0" cy="0" r="1" gradientTransform="translate(1770 120) rotate(145) scale(720 520)">
      <stop stop-color="#dff6ef" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#dff6ef" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="22" stdDeviation="28" flood-color="#6a4535" flood-opacity="0.13"/>
    </filter>
    <linearGradient id="number" x1="0" y1="0" x2="1" y2="0">
      <stop stop-color="#15978f"/>
      <stop offset="1" stop-color="#57c9c0"/>
    </linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#bg)"/>
  <rect width="1920" height="1080" fill="url(#rose)"/>
  <rect width="1920" height="1080" fill="url(#mint)"/>
  <g opacity="0.18" fill="#d9b891">
    <circle cx="55" cy="58" r="5"/><circle cx="96" cy="58" r="5"/><circle cx="137" cy="58" r="5"/>
    <circle cx="1783" cy="1012" r="5"/><circle cx="1824" cy="1012" r="5"/><circle cx="1865" cy="1012" r="5"/>
  </g>

  <rect x="58" y="116" width="930" height="906" rx="54" fill="#fffefb" stroke="#f3ded5" stroke-width="3" filter="url(#shadow)"/>
  <rect x="88" y="147" width="870" height="844" rx="38" fill="#fffaf5" stroke="#eedfd8" stroke-width="2"/>

  <text x="1060" y="126" fill="#17948d" font-family="Arial, sans-serif" font-size="28" font-weight="800" letter-spacing="8">SIKUREPI VISUAL LIBRARY</text>
  <text x="1052" y="372" fill="url(#number)" font-family="Arial Rounded MT Bold, Arial, sans-serif" font-size="226" font-weight="900" letter-spacing="-12">535+</text>
  <text x="1062" y="478" fill="#40302c" font-family="Arial Rounded MT Bold, Arial, sans-serif" font-size="83" font-weight="900" letter-spacing="1">FOOD</text>
  <text x="1062" y="566" fill="#40302c" font-family="Arial Rounded MT Bold, Arial, sans-serif" font-size="83" font-weight="900" letter-spacing="1">ILLUSTRATIONS</text>

  <rect x="1060" y="622" width="337" height="92" rx="28" fill="#fff0f4" stroke="#f7c9d6" stroke-width="2"/>
  <text x="1095" y="680" fill="#dd466c" font-family="Arial, sans-serif" font-size="33" font-weight="800">385 INGREDIENTS</text>
  <rect x="1420" y="622" width="300" height="92" rx="28" fill="#fff5de" stroke="#f4d89d" stroke-width="2"/>
  <text x="1456" y="680" fill="#b6761c" font-family="Arial, sans-serif" font-size="33" font-weight="800">150 DISHES</text>

  <text x="1064" y="784" fill="#6f5852" font-family="Arial, sans-serif" font-size="34" font-weight="600">
    <tspan x="1064" dy="0">A visual cooking language for</tspan>
    <tspan x="1064" dy="51">every pantry, recipe, and collection.</tspan>
  </text>

  <rect x="1060" y="894" width="570" height="68" rx="34" fill="#e8f7f3"/>
  <text x="1100" y="939" fill="#197f79" font-family="Arial, sans-serif" font-size="27" font-weight="800" letter-spacing="2">PANTRY  ·  RECIPE  ·  COLLECTION</text>

  <rect x="111" y="168" width="248" height="52" rx="26" fill="#17948d"/>
  <text x="145" y="203" fill="#ffffff" font-family="Arial, sans-serif" font-size="22" font-weight="800" letter-spacing="2">ALL 385 SHOWN</text>
</svg>`);

const composites = [{ input: background, left: 0, top: 0 }];

const columns = 22;
const cellWidth = 38;
const cellHeight = 40;
const iconSize = 34;
const gridLeft = 104;
const gridTop = 228;

for (let index = 0; index < ingredientFiles.length; index += 1) {
  const column = index % columns;
  const row = Math.floor(index / columns);
  const icon = await sharp(path.join(ingredientDirectory, ingredientFiles[index]))
    .resize(iconSize, iconSize, { fit: 'contain' })
    .png()
    .toBuffer();
  composites.push({
    input: icon,
    left: gridLeft + column * cellWidth + Math.floor((cellWidth - iconSize) / 2),
    top: gridTop + row * cellHeight + Math.floor((cellHeight - iconSize) / 2),
  });
}

const mascot = await sharp(mascotPath)
  .resize(170, 170, { fit: 'contain' })
  .png()
  .toBuffer();
composites.push({ input: mascot, left: 1720, top: 820 });

await sharp({
  create: {
    width: WIDTH,
    height: HEIGHT,
    channels: 4,
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  },
})
  .composite(composites)
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(outputPath);

const metadata = await sharp(outputPath).metadata();
const stat = await fs.stat(outputPath);
console.log(JSON.stringify({
  output: path.relative(ROOT, outputPath),
  width: metadata.width,
  height: metadata.height,
  ingredients: ingredientFiles.length,
  dishes: dishFiles.length,
  bytes: stat.size,
}, null, 2));
