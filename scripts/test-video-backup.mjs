import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const backup = JSON.parse(fs.readFileSync(new URL('../public/demo/sikurepi-video-account.en.json', import.meta.url), 'utf8'));
const source = fs.readFileSync(new URL('../src/lib/ingredientIcons.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const ingredientIcons = {};
vm.runInNewContext(compiled, {
  exports: ingredientIcons,
  require: (id) => {
    if (id === './kana') return { toHiragana: (value) => String(value).toLocaleLowerCase() };
    throw new Error(`Unexpected module: ${id}`);
  },
});

assert.equal(backup.stats.total_cooked, 72);
assert.equal(backup.stats.cooked_records.length, 72);
assert.equal(backup.stats.streak_days, 12);
assert.ok(backup.inventory.length >= 20);
assert.ok(backup.savedRecipes.length >= 8);
assert.equal(backup.recentRecipes.length, 3);
assert.equal(backup.weekPlan.length, 7);

const recipeTitles = new Set(backup.stats.cooked_records.map((record) => record.recipeTitle));
assert.equal(recipeTitles.size, 12, 'all twelve Sikurepi AI recipes should appear in cooking history');
const ingredientNames = backup.stats.cooked_records.flatMap((record) => record.ingredientNames || []);
assert.ok(ingredientNames.length > 0 && backup.stats.cooked_records.every((record) => record.ingredientNames?.length > 0));
const mappedSlugs = new Set(ingredientNames.map(ingredientIcons.getIngredientIconSlug).filter(Boolean));
assert.ok(mappedSlugs.size >= 25, `expected at least 25 collection icons, got ${mappedSlugs.size}`);
assert.ok(backup.inventory.every((item) => item.category !== 'その他'), 'English pantry data must be categorized');

console.log(`Video backup: ${recipeTitles.size} AI recipes, ${mappedSlugs.size} collection icons, ${backup.inventory.length} pantry items, 72 cooking records.`);
