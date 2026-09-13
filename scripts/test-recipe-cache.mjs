import assert from 'node:assert/strict';

const {
  createRecipeGenerationRequestKey,
} = await import('../src/lib/recipeCache.ts');

const left = createRecipeGenerationRequestKey({
  language: 'ja',
  profile: { dietaryRestrictions: ['ヴィーガン'], servings: 2 },
  ingredients: ['豆腐', 'トマト'],
});
const sameWithDifferentObjectKeyOrder = createRecipeGenerationRequestKey({
  ingredients: ['豆腐', 'トマト'],
  profile: { servings: 2, dietaryRestrictions: ['ヴィーガン'] },
  language: 'ja',
});
const differentRestriction = createRecipeGenerationRequestKey({
  ingredients: ['豆腐', 'トマト'],
  profile: { servings: 2, dietaryRestrictions: [] },
  language: 'ja',
});

assert.equal(left, sameWithDifferentObjectKeyOrder);
assert.notEqual(left, differentRestriction);

console.log('Recipe generation cache key: all tests passed.');
