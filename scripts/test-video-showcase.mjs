import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function compileModule(path, requireModule) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: requireModule, console, Date, JSON, Math, Set, Map });
  return exports;
}

const ingredientIcons = compileModule('../src/lib/ingredientIcons.ts', (id) => {
  if (id === './kana') return { toHiragana: (value) => value.toLocaleLowerCase() };
  throw new Error(`Unexpected ingredient module: ${id}`);
});
const showcase = compileModule('../src/lib/videoShowcaseData.ts', (id) => {
  if (id === './storage') return {
    applyBackupPayload: () => {}, buildBackupPayload: () => ({}),
    computeChefLevel: (total) => total >= 65 ? 5 : total >= 35 ? 4 : total >= 15 ? 3 : total >= 5 ? 2 : 1,
  };
  throw new Error(`Unexpected showcase module: ${id}`);
});
const { getIngredientIconSlug } = ingredientIcons;
const { createVideoShowcasePayload } = showcase;

const now = new Date('2026-09-19T12:00:00+09:00');
const payload = createVideoShowcasePayload(now);

assert.equal(payload.inventory.length, 24);
assert.equal(payload.shopping.length, 8);
assert.equal(payload.savedRecipes.length, 8);
assert.equal(payload.recentRecipes?.length, 3);
assert.equal(payload.weekPlan?.length, 7);
assert.equal(payload.stats.total_cooked, 72);
assert.equal(payload.stats.cooked_records.length, 72);
assert.equal(payload.stats.streak_days, 12);
assert.equal(payload.stats.chef_level, 5);
assert.ok(payload.stats.saved_food_count >= 12);

const visibleEnglish = [
  ...payload.inventory.map((item) => item.name),
  ...payload.shopping.map((item) => item.name),
  ...payload.savedRecipes.flatMap((recipe) => [recipe.title, recipe.tips, ...recipe.ingredients.map((item) => item.name), ...recipe.steps]),
  ...(payload.tips || []).flatMap((tip) => [tip.category, tip.tip]),
];
for (const value of visibleEnglish) {
  assert.doesNotMatch(value, /[\u3040-\u30ff\u3400-\u9fff]/u, value);
}

for (const name of ['Chicken breast', 'Salmon', 'Cabbage', 'Chickpeas', 'Soy milk', 'Black pepper']) {
  assert.ok(getIngredientIconSlug(name), `${name} should resolve without AI/network`);
}

const unlockedIcons = new Set(payload.stats.cooked_records.flatMap((record) => record.ingredientNames || []).map(getIngredientIconSlug).filter(Boolean));
assert.ok(unlockedIcons.size >= 25, `expected a visibly populated collection, got ${unlockedIcons.size}`);

console.log(`Video showcase: ${payload.stats.total_cooked} cooked, ${unlockedIcons.size} collection icons, ${payload.inventory.length} pantry items.`);
