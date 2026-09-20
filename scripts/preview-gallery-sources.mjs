import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const dir = process.argv[2];
const files = (await fs.readdir(dir)).filter(f => /\.(png|jpe?g)$/i.test(f)).sort();
await fs.mkdir('.tmp/gallery', { recursive: true });
for (let start = 0; start < files.length; start += 20) {
  const batch = files.slice(start, start + 20);
  const layers = [];
  let labels = '';
  for (let i = 0; i < batch.length; i++) {
    const x = (i % 5) * 240, y = Math.floor(i / 5) * 385;
    const input = await sharp(path.join(dir, batch[i])).rotate().resize(220, 345, { fit: 'contain', background: '#f0ece7' }).png().toBuffer();
    layers.push({ input, left: x + 10, top: y + 30 });
    labels += `<text x="${x + 12}" y="${y + 23}" font-family="Arial" font-size="19" fill="#222">${batch[i]}</text>`;
  }
  layers.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1540">${labels}</svg>`), left: 0, top: 0 });
  await sharp({ create: { width: 1200, height: 1540, channels: 3, background: '#f0ece7' } }).composite(layers).png().toFile(`.tmp/gallery/sources-${start / 20 + 1}.png`);
}
console.log(`${files.length} images inspected in .tmp/gallery/sources-*.png`);
