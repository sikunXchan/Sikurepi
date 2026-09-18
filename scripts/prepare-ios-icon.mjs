import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Package the existing approved logo; no generated or redesigned mascot.
const source = new URL('../public/icon.png', import.meta.url);
const catalog = new URL('../ios/App/App/Assets.xcassets/AppIcon.appiconset/', import.meta.url);
const contents = JSON.parse(await readFile(new URL('Contents.json', catalog), 'utf8'));
const entry = contents.images.find(image => image.size === '1024x1024' && image.platform === 'ios');
assert.ok(entry?.filename && !/[\\/]/.test(entry.filename), 'Missing iOS 1024px icon entry');
const output = fileURLToPath(new URL(entry.filename, catalog));
await sharp(fileURLToPath(source))
  .resize(1024, 1024, { fit: 'contain', background: '#ffffff' })
  .flatten({ background: '#ffffff' })
  .toColourspace('srgb')
  .png()
  .toFile(output);
const metadata = await sharp(output).metadata();
assert.equal(metadata.width, 1024);
assert.equal(metadata.height, 1024);
assert.equal(metadata.hasAlpha, false, 'iOS app icons must be opaque');
console.log('Sikurepi iOS icon prepared: 1024x1024, opaque PNG.');
