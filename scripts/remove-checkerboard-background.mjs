import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [, , inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  console.error("Usage: node scripts/remove-checkerboard-background.mjs <input.png> <output.png>");
  process.exit(1);
}

const { data, info } = await sharp(inputPath)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const pixels = info.width * info.height;
const background = new Uint8Array(pixels);
const queue = new Int32Array(pixels);
let head = 0;
let tail = 0;

function isCheckerPixel(index) {
  const offset = index * info.channels;
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const lightness = (maximum + minimum) / 2;
  return maximum - minimum <= 18 && lightness >= 92 && lightness <= 225;
}

function enqueue(index) {
  if (background[index] || !isCheckerPixel(index)) return;
  background[index] = 1;
  queue[tail++] = index;
}

for (let x = 0; x < info.width; x += 1) {
  enqueue(x);
  enqueue((info.height - 1) * info.width + x);
}
for (let y = 0; y < info.height; y += 1) {
  enqueue(y * info.width);
  enqueue(y * info.width + info.width - 1);
}

while (head < tail) {
  const index = queue[head++];
  const x = index % info.width;
  const y = Math.floor(index / info.width);
  if (x > 0) enqueue(index - 1);
  if (x + 1 < info.width) enqueue(index + 1);
  if (y > 0) enqueue(index - info.width);
  if (y + 1 < info.height) enqueue(index + info.width);
}

const rgba = Buffer.alloc(pixels * 4);
for (let index = 0; index < pixels; index += 1) {
  const source = index * info.channels;
  const target = index * 4;
  rgba[target] = data[source];
  rgba[target + 1] = data[source + 1];
  rgba[target + 2] = data[source + 2];
  rgba[target + 3] = background[index] ? 0 : 255;
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
  .png({ compressionLevel: 9, palette: false })
  .toFile(outputPath);

console.log(`Removed ${tail} connected checkerboard pixels and wrote ${outputPath}`);
