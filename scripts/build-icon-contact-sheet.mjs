import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [, , inputDir, outputPath, ...remainingArgs] = process.argv;
const groupOption = remainingArgs.find((arg) => arg.startsWith("--manifest-group="));
let slugs = remainingArgs.filter((arg) => !arg.startsWith("--"));

if (groupOption) {
  const groupKey = groupOption.slice("--manifest-group=".length);
  const manifest = JSON.parse(
    await fs.readFile(path.join(inputDir, "..", "manifest.json"), "utf8")
  );
  const group = manifest.groups.find((entry) => entry.key === groupKey);
  if (!group) throw new Error(`Manifest group not found: ${groupKey}`);
  slugs = group.icons.map((icon) => icon.key);
}

if (!inputDir || !outputPath || slugs.length === 0) {
  console.error(
    "Usage: node scripts/build-icon-contact-sheet.mjs <input-dir> <output.png> [--manifest-group=key] <slugs...>"
  );
  process.exit(1);
}

const COLUMNS = 5;
const TILE_WIDTH = 280;
const TILE_HEIGHT = 310;
const ICON_SIZE = 244;
const rows = Math.ceil(slugs.length / COLUMNS);

function escapeXml(value) {
  return value.replace(/[<>&'\"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
  })[character]);
}

const checker = `
  <svg width="${COLUMNS * TILE_WIDTH}" height="${rows * TILE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="checker" width="24" height="24" patternUnits="userSpaceOnUse">
        <rect width="24" height="24" fill="#ffffff"/>
        <rect width="12" height="12" fill="#edf0f3"/>
        <rect x="12" y="12" width="12" height="12" fill="#edf0f3"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#checker)"/>
    ${slugs.map((slug, index) => {
      const column = index % COLUMNS;
      const row = Math.floor(index / COLUMNS);
      return `
        <rect x="${column * TILE_WIDTH}" y="${row * TILE_HEIGHT}" width="${TILE_WIDTH}" height="${TILE_HEIGHT}" fill="none" stroke="#bcc3ca" stroke-width="2"/>
        <rect x="${column * TILE_WIDTH}" y="${row * TILE_HEIGHT + ICON_SIZE + 12}" width="${TILE_WIDTH}" height="54" fill="#ffffff" fill-opacity="0.9"/>
        <text x="${column * TILE_WIDTH + TILE_WIDTH / 2}" y="${row * TILE_HEIGHT + ICON_SIZE + 46}" text-anchor="middle" font-family="Arial, sans-serif" font-size="19" fill="#3a3330">${escapeXml(slug)}</text>`;
    }).join("")}
  </svg>`;

const composites = [];
for (const [index, slug] of slugs.entries()) {
  const icon = await sharp(path.join(inputDir, `${slug}.png`))
    .resize(ICON_SIZE, ICON_SIZE, { fit: "contain" })
    .png()
    .toBuffer();
  composites.push({
    input: icon,
    left: (index % COLUMNS) * TILE_WIDTH + (TILE_WIDTH - ICON_SIZE) / 2,
    top: Math.floor(index / COLUMNS) * TILE_HEIGHT,
  });
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await sharp(Buffer.from(checker))
  .composite(composites)
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

console.log(`Wrote contact sheet to ${outputPath}`);
