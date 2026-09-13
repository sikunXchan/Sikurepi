import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const dishDirectory = path.join(root, "public", "dishes", "icons");
const ingredientDirectory = path.join(root, "public", "ingredients");
const dishSourcePath = path.join(root, "src", "lib", "dishIcons.ts");
const ingredientSourcePath = path.join(root, "src", "lib", "ingredientIcons.ts");
const manifestPath = path.join(root, "public", "dishes", "manifest.json");
const errors = [];

const sorted = (values) => [...values].sort((a, b) => a.localeCompare(b));
const listPngSlugs = async (directory) => sorted(
  (await fs.readdir(directory))
    .filter((file) => file.toLowerCase().endsWith(".png"))
    .map((file) => path.basename(file, ".png"))
);
const difference = (left, right) => left.filter((value) => !new Set(right).has(value));

function reportSetMismatch(label, expected, actual) {
  const missing = difference(expected, actual);
  const extra = difference(actual, expected);
  if (missing.length > 0) errors.push(`${label}: missing ${missing.join(", ")}`);
  if (extra.length > 0) errors.push(`${label}: extra ${extra.join(", ")}`);
}

async function alphaBounds(filePath) {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] <= 8) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) return null;
  return [left, top, right + 1, bottom + 1];
}

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const manifestEntries = manifest.groups.flatMap((group) => group.icons);
const manifestSlugs = manifestEntries.map((icon) => icon.key);
const dishFiles = await listPngSlugs(dishDirectory);
const dishSource = await fs.readFile(dishSourcePath, "utf8");
const dishRuleSlugs = sorted([
  ...new Set([...dishSource.matchAll(/slug:\s*"([A-Za-z0-9_]+)"/g)].map((match) => match[1])),
]);

if (manifest.count !== manifestEntries.length) {
  errors.push(`dish manifest count is ${manifest.count}; expected ${manifestEntries.length}`);
}
for (const group of manifest.groups) {
  if (group.count !== group.icons.length) {
    errors.push(`dish manifest group ${group.key} count is ${group.count}; expected ${group.icons.length}`);
  }
}
if (new Set(manifestSlugs).size !== manifestSlugs.length) errors.push("dish manifest has duplicate keys");
reportSetMismatch("dish files vs manifest", sorted(manifestSlugs), dishFiles);
reportSetMismatch("dish mapping vs manifest", sorted(manifestSlugs), dishRuleSlugs);

for (const entry of manifestEntries) {
  const filePath = path.join(root, "public", "dishes", entry.file);
  const metadata = await sharp(filePath).metadata();
  if (metadata.width !== 512 || metadata.height !== 512) {
    errors.push(`${entry.key}: expected 512x512, got ${metadata.width}x${metadata.height}`);
  }
  if (!metadata.hasAlpha || metadata.channels !== 4) {
    errors.push(`${entry.key}: expected RGBA PNG`);
  }
  const bounds = await alphaBounds(filePath);
  if (!bounds) {
    errors.push(`${entry.key}: contains no visible pixels`);
    continue;
  }
  const minimumMargin = Math.min(bounds[0], bounds[1], 512 - bounds[2], 512 - bounds[3]);
  if (minimumMargin <= 0) errors.push(`${entry.key}: visible pixels touch an image edge`);
  if (entry.qa && JSON.stringify(entry.qa.content_bbox) !== JSON.stringify(bounds)) {
    errors.push(`${entry.key}: manifest content_bbox is stale`);
  }
}

const ingredientFiles = await listPngSlugs(ingredientDirectory);
const ingredientSource = await fs.readFile(ingredientSourcePath, "utf8");
const ingredientBlockStart = ingredientSource.indexOf("const ICON_KEYWORDS");
const ingredientBlockEnd = ingredientSource.indexOf("\n};", ingredientBlockStart);
const ingredientBlock = ingredientSource.slice(ingredientBlockStart, ingredientBlockEnd);
const ingredientMappingSlugs = sorted([
  ...ingredientBlock.matchAll(/^\s{2}([A-Za-z0-9_]+):\s*\[/gm),
].map((match) => match[1]));
reportSetMismatch("ingredient mapping vs files", ingredientFiles, ingredientMappingSlugs);

for (const slug of ingredientFiles) {
  const metadata = await sharp(path.join(ingredientDirectory, `${slug}.png`)).metadata();
  if (!metadata.width || !metadata.height) errors.push(`${slug}: unreadable ingredient icon`);
}

const { getDishIconSlug } = await import(pathToFileURL(dishSourcePath));
const mappingCases = [
  ["親子丼", "oyakodon"], ["牛丼", "gyudon"], ["カツ丼", "katsudon"],
  ["天ぷら", "tempura"], ["鮭と野菜の味噌汁", "miso_soup"], ["焼きそば", "yakisoba"],
  ["鶏の照り焼き", "teriyaki_chicken"], ["プルコギ", "bulgogi"], ["トッポギ", "tteokbokki"],
  ["チャプチェ", "japchae"], ["キムチチゲ", "kimchi_jjigae"], ["点心", "dim_sum"],
  ["春巻き", "spring_rolls"], ["酢豚", "sweet_sour_pork"], ["タイグリーンカレー", "thai_green_curry"],
  ["ラクサ", "laksa"], ["ナシゴレン", "nasi_goreng"], ["チキンティッカマサラカレー", "chicken_tikka_masala"],
  ["チャナマサラ", "chana_masala"], ["タジン鍋", "tagine"], ["タブーリ", "tabbouleh"],
  ["エンチラーダ", "enchiladas"], ["タマレス", "tamales"], ["mac and cheese", "mac_and_cheese"],
  ["shepherd’s pie", "shepherds_pie"],
];
for (const [name, expected] of mappingCases) {
  const actual = getDishIconSlug(name);
  if (actual !== expected) errors.push(`mapping ${name}: expected ${expected}, got ${actual}`);
}

console.log(`Dish icons: ${dishFiles.length} files / ${manifest.groups.length} groups / ${dishRuleSlugs.length} mapped`);
console.log(`Ingredient icons: ${ingredientFiles.length} files / ${ingredientMappingSlugs.length} mapped`);
console.log(`New world-dish mapping cases: ${mappingCases.length - errors.filter((error) => error.startsWith("mapping ")).length}/${mappingCases.length}`);

if (errors.length > 0) {
  console.error("\nIcon audit failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Icon audit passed.");
