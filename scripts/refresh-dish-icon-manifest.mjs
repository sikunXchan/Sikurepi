import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const manifestPath = path.join(root, "public", "dishes", "manifest.json");
const alphaThreshold = 8;

async function inspectIcon(filePath) {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  let minimumAlpha = 255;
  let maximumAlpha = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + 3];
      minimumAlpha = Math.min(minimumAlpha, alpha);
      maximumAlpha = Math.max(maximumAlpha, alpha);
      if (alpha <= alphaThreshold) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) {
    throw new Error(`No visible icon pixels found in ${filePath}`);
  }

  const contentBbox = [left, top, right + 1, bottom + 1];
  const minimumMargin = Math.min(
    left,
    top,
    info.width - (right + 1),
    info.height - (bottom + 1),
  );

  return {
    size: [info.width, info.height],
    mode: "RGBA",
    alpha_extrema: [minimumAlpha, maximumAlpha],
    content_bbox: contentBbox,
    minimum_margin: minimumMargin,
    edge_clear: minimumMargin > 0,
  };
}

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

for (const group of manifest.groups) {
  group.count = group.icons.length;
  for (const icon of group.icons) {
    const filePath = path.join(root, "public", "dishes", icon.file);
    icon.qa = await inspectIcon(filePath);
  }
}

manifest.count = manifest.groups.reduce((total, group) => total + group.icons.length, 0);
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Refreshed QA metadata for ${manifest.count} dish icons.`);
