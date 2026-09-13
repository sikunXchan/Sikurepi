import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const [, , outputPath, ...inputPaths] = process.argv;
if (!outputPath || inputPaths.length !== 25) {
  console.error('Usage: node scripts/build-icon-edit-sheet.mjs <output.png> <25 icon paths>');
  process.exit(1);
}

const gridSize = 5;
const cellSize = 512;
const contentSize = 450;
const sheetSize = gridSize * cellSize;
const composites = [];

for (const [index, inputPath] of inputPaths.entries()) {
  const input = await sharp(inputPath)
    .ensureAlpha()
    .resize(contentSize, contentSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  composites.push({
    input,
    left: (index % gridSize) * cellSize + (cellSize - contentSize) / 2,
    top: Math.floor(index / gridSize) * cellSize + (cellSize - contentSize) / 2,
  });
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await sharp({
  create: {
    width: sheetSize,
    height: sheetSize,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(composites)
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

console.log(`Wrote 5x5 edit sheet to ${outputPath}`);
