import assert from 'node:assert/strict';
import { getCookingTipCategory, normalizeCookingTips } from '../src/lib/cookingTips.ts';
import en from '../src/lib/i18n/locales/en.ts';
import ja from '../src/lib/i18n/locales/ja.ts';

const aliases = {
  storage: ['保存方法', '保存のコツ', 'Storage', 'Storage tips', 'Storage advice', 'Food storage', 'Storage method'],
  cooking: ['調理のコツ', '料理のコツ', 'Cooking', 'Cooking tips', 'Cooking tips and tricks', 'Cooking Technique'],
  nutrition: ['栄養豆知識', '栄養の豆知識', 'Nutrition', 'Nutrition trivia', 'Nutrition facts', 'Nutritional facts', 'Nutrition Fact', 'Nutritional trivia'],
};
for (const [key, values] of Object.entries(aliases)) {
  for (const value of [...values, key]) {
    assert.equal(getCookingTipCategory(value), key, value);
    assert.equal(getCookingTipCategory(` 💡 ${value.toUpperCase()}： `), key, value);
    assert.ok(!/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(en.recipe.tipCategories[key]));
    assert.ok(ja.recipe.tipCategories[key]);
  }
}
for (const value of ['', 'New AI category', 'その他', 'constructor', '__proto__']) {
  assert.equal(getCookingTipCategory(value), 'other');
}

// Reproduce cached/backup tips: only the category label follows the current UI
// language. The existing advice and stored categories must remain untouched.
const saved = Object.freeze([
  Object.freeze({ category: '保存方法', tip: 'An existing English storage tip.' }),
  Object.freeze({ category: '調理のコツ', tip: 'An existing English cooking tip.' }),
  Object.freeze({ category: '栄養豆知識', tip: 'An existing English nutrition tip.' }),
]);
const before = JSON.stringify(saved);
const labels = (dictionary) => saved.map((tip) => dictionary.recipe.tipCategories[getCookingTipCategory(tip.category)]);
assert.deepEqual(labels(en), ['Storage tips', 'Cooking tips', 'Nutrition facts']);
assert.deepEqual(labels(ja), ['保存方法', '調理のコツ', '栄養豆知識']);
assert.deepEqual(labels(en), ['Storage tips', 'Cooking tips', 'Nutrition facts']);
assert.equal(JSON.stringify(saved), before);
assert.deepEqual(normalizeCookingTips(saved), saved);
console.log('Cooking tip labels: Japanese/English aliases, saved data, language switching, and fallback passed.');
