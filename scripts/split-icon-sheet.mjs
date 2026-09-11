import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [, , sourcePath, outputDir, groupKey, ...remainingArgs] = process.argv;
const option = (name, fallback) => {
  const value = remainingArgs.find((arg) => arg.startsWith(`--${name}=`));
  return value ? Number(value.split("=")[1]) : fallback;
};
const slugs = remainingArgs.filter((arg) => !arg.startsWith("--"));
const skipManifest = remainingArgs.includes("--no-manifest");
const largestOnly = remainingArgs.includes("--largest-only");

if (!sourcePath || !outputDir || !groupKey || slugs.length !== 25) {
  console.error(
    "Usage: node scripts/split-icon-sheet.mjs <sheet.png> <output-dir> <group-key> [--size=N] [--content=N] [--no-manifest] [--largest-only] <25 slugs>"
  );
  process.exit(1);
}

const GRID_SIZE = 5;
const OUTPUT_SIZE = option("size", 512);
const CONTENT_SIZE = option("content", 420);
const ALPHA_THRESHOLD = 8;

function findComponents(data, width, height, channels) {
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  const components = [];

  const isVisible = (index) => data[index * channels + 3] > ALPHA_THRESHOLD;

  for (let start = 0; start < width * height; start += 1) {
    if (visited[start] || !isVisible(start)) continue;

    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    const pixels = [];

    while (head < tail) {
      const current = queue[head++];
      pixels.push(current);
      const x = current % width;
      const y = Math.floor(current / width);

      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nextX = x + dx;
          const nextY = y + dy;
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
          const next = nextY * width + nextX;
          if (visited[next] || !isVisible(next)) continue;
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }

    components.push(pixels);
  }

  return components.sort((a, b) => b.length - a.length);
}

function removeSpeckles(data, width, height, channels, keepLargestOnly) {
  const components = findComponents(data, width, height, channels);
  if (components.length === 0) throw new Error("No visible icon pixels found in a grid cell");

  const minimumSize = Math.max(28, Math.floor(components[0].length * 0.002));
  const keep = new Uint8Array(width * height);
  for (const [componentIndex, component] of components.entries()) {
    if (keepLargestOnly && componentIndex > 0) continue;
    if (component.length < minimumSize) continue;
    for (const index of component) keep[index] = 1;
  }

  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let index = 0; index < width * height; index += 1) {
    if (!keep[index]) {
      data[index * channels + 3] = 0;
      continue;
    }
    const x = index % width;
    const y = Math.floor(index / width);
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  }

  if (right < left || bottom < top) throw new Error("Icon became empty after cleanup");
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function contentBounds(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] <= ALPHA_THRESHOLD) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  return [left, top, right + 1, bottom + 1];
}

await fs.mkdir(outputDir, { recursive: true });
const sheet = sharp(sourcePath).ensureAlpha();
const metadata = await sheet.metadata();
if (!metadata.width || !metadata.height) throw new Error("Could not read sheet dimensions");

const manifestEntries = [];

for (let row = 0; row < GRID_SIZE; row += 1) {
  for (let column = 0; column < GRID_SIZE; column += 1) {
    const index = row * GRID_SIZE + column;
    const slug = slugs[index];
    const left = Math.round((column * metadata.width) / GRID_SIZE);
    const right = Math.round(((column + 1) * metadata.width) / GRID_SIZE);
    const top = Math.round((row * metadata.height) / GRID_SIZE);
    const bottom = Math.round(((row + 1) * metadata.height) / GRID_SIZE);

    const { data, info } = await sharp(sourcePath)
      .extract({ left, top, width: right - left, height: bottom - top })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const bounds = removeSpeckles(data, info.width, info.height, info.channels, largestOnly);
    const normalized = await sharp(data, {
      raw: { width: info.width, height: info.height, channels: info.channels },
    })
      .extract(bounds)
      .resize(CONTENT_SIZE, CONTENT_SIZE, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        kernel: sharp.kernel.lanczos3,
      })
      .extend({
        top: (OUTPUT_SIZE - CONTENT_SIZE) / 2,
        bottom: (OUTPUT_SIZE - CONTENT_SIZE) / 2,
        left: (OUTPUT_SIZE - CONTENT_SIZE) / 2,
        right: (OUTPUT_SIZE - CONTENT_SIZE) / 2,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9, palette: false })
      .toBuffer();

    const destination = path.join(outputDir, `${slug}.png`);
    await fs.writeFile(destination, normalized);
    const bbox = await contentBounds(normalized);
    const minimumMargin = Math.min(
      bbox[0],
      bbox[1],
      OUTPUT_SIZE - bbox[2],
      OUTPUT_SIZE - bbox[3]
    );
    manifestEntries.push({
      key: slug,
      file: `icons/${slug}.png`,
      qa: {
        size: [OUTPUT_SIZE, OUTPUT_SIZE],
        mode: "RGBA",
        alpha_extrema: [0, 255],
        content_bbox: bbox,
        minimum_margin: minimumMargin,
        edge_clear: minimumMargin > 0,
      },
    });
  }
}

console.log(`Wrote ${manifestEntries.length} icons to ${outputDir}`);
if (!skipManifest) {
  const manifestPath = path.join(outputDir, "..", "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  manifest.groups = manifest.groups.filter((group) => group.key !== groupKey);
  manifest.groups.push({ key: groupKey, count: manifestEntries.length, icons: manifestEntries });
  manifest.count = manifest.groups.reduce((total, group) => total + group.count, 0);
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Updated ${manifestPath} (total: ${manifest.count})`);
}
