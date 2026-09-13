import assert from 'node:assert/strict';
import {
  isCommunityRecipe,
  sanitizeCommunityRecipe,
  serializeCommunityRecipeIdentity,
} from '../src/lib/communityRecipeSchema.ts';

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

console.log('Recipe feedback identity tests passed.');
