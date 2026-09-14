import assert from 'node:assert/strict';
import { validateIngredientUnit, validateIngredientUnits } from '../src/lib/ingredientUnits.ts';

const valid = [
  ['鶏むね肉（皮なし）', '200g'], ['鮭', '2切れ（約180g）'], ['卵', '2個'],
  ['牛乳', '200ml'], ['木綿豆腐', '1丁'], ['米', '1合'], ['温かいご飯', '400g'],
  ['玉ねぎ', '1/2個（約100g）'], ['にんじん', '1本'], ['ほうれん草', '1束'],
  ['しめじ', '1パック'], ['醤油', '大さじ1.5'], ['食パン', '2枚'],
  ['トマト缶', '1缶'], ['固形コンソメ', '1個'],
];
for (const [name, amount] of valid) {
  assert.equal(validateIngredientUnit(name, amount), null, `${name} ${amount} should be valid`);
}

const invalid = [
  ['鶏むね肉', '200ml'], ['卵', '100ml'], ['牛乳', '2個'], ['玉ねぎ', '1カップ'],
  ['にんじん', '100ml'], ['米', '2本'], ['木綿豆腐', '200ml'],
];
for (const [name, amount] of invalid) {
  assert.ok(validateIngredientUnit(name, amount), `${name} ${amount} should be rejected`);
}

assert.equal(validateIngredientUnit('謎の新食材', '2個'), null, 'unknown ingredients stay forward-compatible');
assert.equal(validateIngredientUnit('塩', '少々'), null, 'vague seasoning quantity is allowed');
assert.equal(validateIngredientUnits(valid.map(([name, amount]) => ({ name, amount }))).length, 0);

console.log('ingredient unit rules: ok');
