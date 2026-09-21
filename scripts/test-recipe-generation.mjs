import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import { ingredientNamesMatch } from '../src/lib/ingredientMatching.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const nativeRequire = createRequire(import.meta.url);
function loadSource(entry, overrides = {}) {
  const cache = new Map();
  const load = file => {
    if (cache.has(file)) return cache.get(file).exports;
    const sourceModule = { exports: {} };
    cache.set(file, sourceModule);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(code, {
      module: sourceModule, exports: sourceModule.exports, Request, Response, Headers, URL,
      AbortController, setTimeout, clearTimeout,
      console: { info() {}, warn() {}, error() {} },
      require: id => {
        if (id in overrides) return overrides[id];
        if (!id.startsWith('.') && !id.startsWith('@/')) return nativeRequire(id);
        const target = id.startsWith('@/')
          ? path.join(root, 'src', id.slice(2))
          : path.resolve(path.dirname(file), id);
        return load(path.extname(target) ? target : `${target}.ts`);
      },
    }, { filename: file });
    return sourceModule.exports;
  };
  return load(path.join(root, entry));
}

for (const [japanese, english] of [
  ['鶏むね肉', 'Chicken breast'], ['鶏胸肉（皮なし）', 'Boneless skinless chicken breasts'],
  ['キャベツ', 'Shredded cabbage'], ['玉ねぎ', 'Onions'], ['卵', 'Eggs'],
  ['鮭', 'Salmon fillet'], ['木綿豆腐', 'Firm tofu'], ['米', 'Rice'],
  ['豆腐', 'Firm tofu'], ['豆腐', '木綿豆腐'], ['鶏もも肉', 'Chicken'],
  ['ご飯', 'Steamed white rice'],
]) {
  assert.equal(ingredientNamesMatch(japanese, english), true, `${japanese} / ${english}`);
  assert.equal(ingredientNamesMatch(english, japanese), true);
}
for (const [first, second] of [
  ['鶏むね肉', 'Chicken thigh'], ['鶏むね肉', 'Ground chicken'],
  ['米', 'Rice vinegar'], ['米', 'Cooked rice'], ['牛乳', 'Soy milk'],
  ['キャベツ', 'Napa cabbage'], ['鮭', 'Cod'], ['生クリーム', 'cheese'],
  ['木綿豆腐', 'Silken tofu'],
  ['carrot', 'unlisted alien ingredient'], ['', 'Egg'],
]) assert.equal(ingredientNamesMatch(first, second), false, `${first} is not ${second}`);

const soup = {
  title: 'Creamy Potato and Onion Soup', time: '25 minutes', genre: '洋食',
  ingredients: [
    { name: 'Potato', amount: '300g' }, { name: 'Onion', amount: '1 medium' },
    { name: 'Garlic, minced', amount: '1 tsp' }, { name: 'Black pepper', amount: '1/4 tsp' },
    { name: 'Butter', amount: '10g' }, { name: 'Water', amount: '400ml' },
    { name: 'Salt', amount: '1/4 tsp' },
  ],
  steps: [
    'Chop the potato and onion. Melt the butter and cook the onion and garlic over medium heat for 3 minutes until fragrant.',
    'Add the potato and water. Simmer for 15 minutes until tender, then mash some potato for a creamy texture.',
    'Season with salt and black pepper, taste and serve hot.',
  ],
  tips: 'The onion brings sweetness and the garlic adds aroma. Mash potatoes for a creamy texture.',
  nutrition: { calories: 220, protein_g: 4, fat_g: 8, carbs_g: 33 },
};
const dessert = {
  title: 'Banana Pancakes', time: '15 minutes', genre: '洋食',
  ingredients: [
    { name: 'Banana', amount: '1 whole' }, { name: 'Egg', amount: '1 whole' },
    { name: 'Flour', amount: '50g' }, { name: 'Milk', amount: '50ml' },
    { name: 'Butter', amount: '5g' },
  ],
  steps: [
    'Mash the banana and whisk with the egg, flour and milk for 1 minute until smooth.',
    'Melt the butter over medium heat, then cook small pancakes for 3 minutes on each side until golden and cooked through.',
  ],
  tips: 'Ripe banana adds sweetness; brown butter brings aroma and golden edges give texture.',
  nutrition: { calories: 225, protein_g: 7, fat_g: 7, carbs_g: 33 },
};
const validators = loadSource('src/lib/recipeValidation.ts');
const quality = loadSource('src/lib/recipeQuality.ts');
const context = {
  mode: 'inventory', inventoryNames: ['じゃがいも', '玉ねぎ'],
  assumeSeasoningsAvailable: true, dietaryRestrictions: [], excludedIngredients: [], templateKey: 'soup',
};
assert.equal(validators.validateRecipeLogic(soup, context).length, 0);
assert.equal(quality.qualityGateErrors(soup).length, 0);
assert.equal(quality.qualityGateErrors(dessert).length, 0);
assert.equal(validators.validateRecipeLogic(dessert, { ...context, mode: 'free', templateKey: 'sweets' }).length, 0);
assert.ok(validators.validateRecipeLogic(dessert, { ...context, mode: 'free', templateKey: 'soup' }).length);
assert.ok(validators.validateRecipeLogic(soup, { ...context, mode: 'free', templateKey: 'sweets' }).length);
assert.equal(quality.validateRequiredIngredients([soup], ['玉ねぎ']).length, 0);
assert.ok(quality.validateRequiredIngredients([soup], ['鶏肉']).length);
assert.equal(quality.validateWeeklyPlan(
  [{ ...soup, date: '2026-09-21', meal_slot: 'lunch' }],
  [{ date: '2026-09-21', mealSlot: 'lunch' }],
  ['玉ねぎ'], { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 },
).length, 0, 'weekly-plan pins also match across languages');
assert.equal(validators.validateRecipeLogic({
  ...soup, ingredients: [{ name: 'Potato', amount: '300g' }, { name: 'Salt', amount: '1g' }, { name: 'Black pepper', amount: 'a dash' }],
}, { ...context, inventoryNames: ['じゃがいも'], assumeSeasoningsAvailable: false }).length, 0,
'the limited salt/pepper exception applies equally in English');
assert.ok(validators.validateRecipeLogic(soup, { ...context, inventoryNames: ['玉ねぎ'] })
  .some(error => error.includes('non-inventory')));
assert.ok(validators.validateRecipeLogic(soup, { ...context, dietaryRestrictions: ['ヴィーガン'] })
  .some(error => error.includes('dietary restriction')));
assert.ok(validators.validateRecipeLogic(dessert, { ...context, mode: 'free', excludedIngredients: ['卵'] })
  .some(error => error.includes('excluded ingredient')));

// Exercise the actual HTTP handler with actual validators; only provider I/O
// and framework response construction are replaced. No API key or spend needed.
async function request(payload, outputs) {
  let calls = 0;
  const route = loadSource('src/app/api/recipes/route.ts', {
    'next/server': { NextResponse: { json: (value, options) => Response.json(value, options) } },
    '@/lib/ai': {
      ai: {}, FAST_AI_MODEL: 'fast', QUALITY_AI_MODEL: 'quality',
      generateWithRetry: async () => ({ text: outputs[Math.min(calls++, outputs.length - 1)] }),
      getAiCallTelemetry: () => null,
      buildProfileSection: () => '', buildClimateSection: () => '', buildSeasoningSection: () => '',
      buildLanguageSection: () => '', buildTemplateConstraintSection: () => '',
      DISH_LOAD_INSTRUCTION: '', FLAVOR_INTENSITY_INSTRUCTION: '',
      AiTimeoutError: class extends Error {}, AiUsageLimitError: class extends Error {},
    },
  });
  const response = await route.POST(new Request('http://localhost/api/recipes', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: 'en', servings: 2, mealStyle: 'single', ...payload }),
  }));
  return { status: response.status, body: await response.json(), calls };
}
const soupOutput = JSON.stringify({ recipes: [soup], cooking_tips: [], feasibility: { feasible: true } });
const dessertOutput = JSON.stringify({ recipes: [dessert], cooking_tips: [], feasibility: { feasible: true } });
const soupPayload = { ingredients: ['じゃがいも', '玉ねぎ'], pinnedIngredients: ['玉ねぎ'], templateKey: 'soup' };
for (const [payload, output] of [[soupPayload, soupOutput], [{ mode: 'free', templateKey: 'sweets' }, dessertOutput]]) {
  const result = await request(payload, [output]);
  assert.equal(result.status, 200, JSON.stringify(result));
  assert.equal(result.calls, 1, 'valid localized output must not spend another model call');
}
const repairedJson = await request(soupPayload, ['{"recipes":', soupOutput]);
assert.equal(repairedJson.status, 200);
assert.equal(repairedJson.calls, 2);
for (const payload of [
  { ...soupPayload, ingredients: ['玉ねぎ'] },
  { ...soupPayload, userProfile: { dietaryRestrictions: ['ヴィーガン'] } },
  { ...soupPayload, userProfile: { allergies: ['牛乳'] } },
]) {
  const result = await request(payload, [soupOutput]);
  assert.equal(result.status, 422, JSON.stringify(result));
  assert.equal(result.calls, 2, 'invalid content remains blocked after bounded retries');
}
console.log('Recipe generation language, measurement, pantry and safety regressions: passed.');
