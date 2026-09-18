import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bodyWithinLimit, consumeRequestBudget, isAiApi, isAllowedOrigin, isRetiredApi } from '../src/lib/apiRequestPolicy.ts';
import { localizeCommunityRecipe, serializeCommunityRecipeIdentity } from '../src/lib/communityRecipeSchema.ts';
import { needsCommunityTranslation, validateCommunityTranslation, translationSourceKey } from '../src/lib/communityTranslation.ts';
import { COMMUNITY_RECIPE_SEEDS } from '../src/lib/communityRecipeSeeds.ts';

for (const path of ['/api/debug/migrate', '/api/inventory', '/api/inventory/123', '/api/shopping/transfer', '/api/saved-recipes', '/api/stats', '/api/recipes/consume']) {
  assert.equal(isRetiredApi(path), true, path);
}
assert.equal(isRetiredApi('/api/recipes'), false);
assert.equal(isAiApi('/api/daily-pick'), true, 'GET fallback also spends money');
assert.equal(isAiApi('/api/community-recipes/123/translate'), true);
assert.equal(isAllowedOrigin('https://evil.example', 'https://app.example'), false);
assert.equal(isAllowedOrigin('https://app.example', 'https://app.example'), true);
assert.equal(isAllowedOrigin('capacitor://localhost', 'https://app.example'), true);
for (let i = 0; i < 30; i++) assert.equal(consumeRequestBudget('/api/recipes', 'test-ip', 1), true);
assert.equal(consumeRequestBudget('/api/ocr', 'test-ip', 1), false, 'all AI routes share the budget');
assert.equal(consumeRequestBudget('/api/recipes', 'test-ip', 600002), true);
assert.equal(await bodyWithinLimit(new Response('12345').body, 4), false);
assert.equal(await bodyWithinLimit(new Response('1234').body, 4), true);

for (const { id, recipe } of COMMUNITY_RECIPE_SEEDS) {
  assert.equal(needsCommunityTranslation(recipe, 'en'), false, id);
  assert.equal(needsCommunityTranslation(recipe, 'ja'), false, id);
  const en = localizeCommunityRecipe(recipe, 'en');
  assert.notEqual(en.title, recipe.title, id);
  assert.equal(en.ingredients.length, recipe.ingredients.length, id);
  assert.equal(en.steps.length, recipe.steps.length, id);
  assert.equal(recipe.creator_comment, null, 'samples must not impersonate user reviews');
  assert.equal(en.creator_comment, null);
  assert.equal(serializeCommunityRecipeIdentity({ ...recipe, communityRecipeId: id }),
    serializeCommunityRecipeIdentity({ ...en, communityRecipeId: id, servings: 5 }), 'same ranking across languages and serving sizes');
}
const source = { title: 'にんじんスープ', time: '10分', ingredients: [{ name: 'にんじん', amount: '100g' }], steps: ['100mlの水で5分煮る。'], tips: '塩1gで調整。' };
const en = { title: 'Carrot Soup', time: '10 min', ingredients: [{ name: 'carrot', amount: '100 g' }], steps: ['Simmer in 100 ml water for 5 minutes.'], tips: 'Season with 1 g salt.' };
assert.ok(validateCommunityTranslation(source, en, 'en'));
assert.equal(validateCommunityTranslation(source, { ...en, ingredients: [{ name: 'carrot', amount: '1000 g' }] }, 'en'), null);
assert.equal(validateCommunityTranslation(source, { ...en, steps: ['Simmer for 2 minutes.'] }, 'en'), null);
assert.equal(validateCommunityTranslation(source, { ...en, steps: [] }, 'en'), null);
assert.equal(validateCommunityTranslation(source, source, 'en'), null);
assert.notEqual(translationSourceKey(source), translationSourceKey({ ...source, tips: '水で調整。' }));
assert.equal(validateCommunityTranslation({ ...source, creator_comment: 'おいしい' }, en, 'en'), null);
assert.ok(!readFileSync(new URL('../src/components/KitchenLoader.tsx', import.meta.url), 'utf8').includes('styles.steam'));
assert.ok(!readFileSync(new URL('../src/components/KitchenLoader.module.css', import.meta.url), 'utf8').includes('steamRise'));
const capacitorConfig = readFileSync(new URL('../capacitor.config.ts', import.meta.url), 'utf8');
assert.ok(capacitorConfig.includes("https://sikurepi.vercel.app"), 'native shell must use the stable production alias');
assert.ok(!capacitorConfig.includes("https://lily-cooking.vercel.app"), 'removed deployment must never be embedded');
const xcode = await import('xcode');
const project = xcode.default.project(new URL('../ios/App/App.xcodeproj/project.pbxproj', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
project.parseSync();
assert.match(project.generateUuid(), /^[A-F0-9]{24}$/);
console.log('Release safety, bilingual seeds, numeric translation checks and Xcode UUID compatibility passed.');
