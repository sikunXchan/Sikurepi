import assert from 'node:assert/strict';
import { applyProfileChange, parseExcludedIngredients } from '../src/lib/profileSettings.ts';
import { getDishIconShape, getDishIconSlug } from '../src/lib/dishIcons.ts';

assert.deepEqual(parseExcludedIngredients('  soy sauce、卵,牛乳，卵\npeanut butter  '), ['soy sauce', '卵', '牛乳', 'peanut butter']);
assert.deepEqual(parseExcludedIngredients(' , 、\n '), []);
assert.deepEqual(parseExcludedIngredients('乳'), ['乳']);

const latest = {
  tastePreferences: ['うす味・減塩'], cookingStyles: [], dietaryRestrictions: ['卵不使用'],
  excludedIngredients: ['peanut butter'], preferredGenres: ['和食'],
  trayTheme: 'night', shareGeneratedRecipes: false, ignoredForgottenIngredientIds: [987],
};
const changed = applyProfileChange(latest, { targetCalories: 1900 });
assert.notEqual(changed, latest);
assert.equal(latest.targetCalories, undefined);
assert.equal(changed.targetCalories, 1900);
assert.equal(changed.trayTheme, 'night');
assert.equal(changed.shareGeneratedRecipes, false);
assert.deepEqual(changed.ignoredForgottenIngredientIds, [987]);
assert.deepEqual(changed.dietaryRestrictions, ['卵不使用']);

const toggleStyle = (current) => ({ cookingStyles: current.cookingStyles.includes('時短') ? [] : ['時短'] });
const firstClick = applyProfileChange(changed, toggleStyle);
const secondClick = applyProfileChange(firstClick, toggleStyle);
assert.deepEqual(secondClick.cookingStyles, []);
assert.equal(secondClick.targetCalories, 1900);
assert.deepEqual(applyProfileChange(secondClick, { excludedIngredients: [] }).excludedIngredients, []);

const shellfish = getDishIconSlug('あさりと新じゃがの旨味溢れる生姜バター和風スープ仕立て');
assert.equal(shellfish, 'shellfish');
assert.equal(getDishIconShape(shellfish), 'bowl');
assert.equal(getDishIconShape(shellfish), getDishIconShape(getDishIconSlug('牛丼')));
assert.equal(getDishIconShape(shellfish), getDishIconShape('plain_rice'));
assert.equal(getDishIconShape(getDishIconSlug('ステーキ')), undefined);
assert.equal(getDishIconShape(null), undefined);
console.log('Profile settings merging, exclusions and shellfish tray sizing: passed');
