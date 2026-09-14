import assert from 'node:assert/strict';
import { recipeServings, scaleIngredientAmount } from '../src/lib/servingScale.ts';

assert.equal(scaleIngredientAmount('200g', 2, 4), '400g');
assert.equal(scaleIngredientAmount('1/2個', 2, 1), '1/4個');
assert.equal(scaleIngredientAmount('大さじ1と1/2', 2, 4), '大さじ3');
assert.equal(scaleIngredientAmount('1 1/2 cups', 2, 1), '3/4 cups');
assert.equal(scaleIngredientAmount('少々', 2, 8), '少々');
assert.equal(scaleIngredientAmount('to taste', 2, 8), 'to taste');
assert.equal(recipeServings(99), 15);
assert.equal(recipeServings(undefined), 2);

console.log('serving scale tests passed');
