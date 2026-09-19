import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const sourceDirectory = path.resolve('public/ingredients');
const outputDirectory = path.join(sourceDirectory, 'thumbs');
const files = (await fs.readdir(sourceDirectory)).filter((file) => file.toLowerCase().endsWith('.png'));

await fs.mkdir(outputDirectory, { recursive: true });
await Promise.all(files.map(async (file) => {
  const output = path.join(outputDirectory, `${path.basename(file, '.png')}.webp`);
  await sharp(path.join(sourceDirectory, file))
    .resize(128, 128, { fit: 'contain', withoutEnlargement: true })
    .webp({ quality: 86, alphaQuality: 90, effort: 4 })
    .toFile(output);
}));

const originalBytes = (await Promise.all(files.map(async (file) => (await fs.stat(path.join(sourceDirectory, file))).size)))
  .reduce((sum, size) => sum + size, 0);
const thumbnailFiles = await fs.readdir(outputDirectory);
const thumbnailBytes = (await Promise.all(thumbnailFiles.map(async (file) => (await fs.stat(path.join(outputDirectory, file))).size)))
  .reduce((sum, size) => sum + size, 0);
console.log(`Ingredient thumbnails: ${files.length} files, ${(originalBytes / 1_048_576).toFixed(1)}MB -> ${(thumbnailBytes / 1_048_576).toFixed(1)}MB`);
