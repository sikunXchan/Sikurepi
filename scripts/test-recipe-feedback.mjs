import assert from 'node:assert/strict';
import {
  isCommunityRecipe,
  localizeCommunityRecipe,
  sanitizeCommunityRecipe,
  serializeCommunityRecipeIdentity,
} from '../src/lib/communityRecipeSchema.ts';
import { COMMUNITY_RECIPE_SEEDS } from '../src/lib/communityRecipeSeeds.ts';
import { qualityGateErrors } from '../src/lib/recipeQuality.ts';

const recipe = {
  title: '  彩り野菜と鮭の香味焼き  ',
  time: ' 20分 ',
  ingredients: [
    { name: ' 鮭 ', amount: ' 2切れ ' },
    { name: ' トマト ', amount: ' 1個 ' },
  ],
  steps: [' 鮭と野菜を焼く。 '],
  tips: ' 火を止めてから香味だれを加える。 ',
};

assert.equal(isCommunityRecipe(recipe), true);
assert.equal(isCommunityRecipe({ title: '材料のない料理' }), false);

const sanitized = sanitizeCommunityRecipe(recipe);
assert.equal(sanitized.title, '彩り野菜と鮭の香味焼き');
assert.equal(sanitized.ingredients[0].name, '鮭');
assert.equal(sanitized.steps[0], '鮭と野菜を焼く。');
assert.doesNotThrow(() => sanitizeCommunityRecipe({ ...recipe, translations: { en: 42 } }));

const setMeal = sanitizeCommunityRecipe({
  ...recipe,
  meal_format: 'set',
  components: [
    { course: '主菜', title: '鮭の香味焼き' },
    { course: '副菜', title: '彩り野菜の和え物' },
    { course: '', title: '不正な構成' },
  ],
});
assert.equal(setMeal.meal_format, 'set');
assert.deepEqual(setMeal.components?.map((component) => component.course), ['主菜', '副菜']);

const sameRecipe = {
  ...sanitized,
  title: '彩り野菜と鮭の香味焼き',
};
assert.equal(
  serializeCommunityRecipeIdentity(recipe),
  serializeCommunityRecipeIdentity(sameRecipe),
);
assert.notEqual(
  serializeCommunityRecipeIdentity(recipe),
  serializeCommunityRecipeIdentity({ ...sanitized, steps: ['鮭を煮る。'] }),
);
assert.notEqual(serializeCommunityRecipeIdentity(recipe), serializeCommunityRecipeIdentity(setMeal));

assert.equal(COMMUNITY_RECIPE_SEEDS.length, 8);
assert.equal(new Set(COMMUNITY_RECIPE_SEEDS.map((seed) => seed.id)).size, COMMUNITY_RECIPE_SEEDS.length);
for (const seed of COMMUNITY_RECIPE_SEEDS) {
  assert.deepEqual(qualityGateErrors(seed.recipe, { servings: 2 }), [], `${seed.recipe.title} failed quality checks`);
  const english = localizeCommunityRecipe(seed.recipe, 'en');
  assert.notEqual(english.title, seed.recipe.title, `${seed.recipe.title} is missing its English version`);
  assert.deepEqual(qualityGateErrors(english, { servings: 2 }), [], `${english.title} failed quality checks`);
}

console.log('Recipe feedback identity tests passed.');
