import assert from 'node:assert/strict';
import {
  validateDietaryRestrictions,
  validateExcludedIngredients,
} from '../src/lib/dietaryRules.ts';
import { buildRecipeConsiderations, getConsiderationLabels, sanitizeRecipeConsiderations } from '../src/lib/recipeConsiderations.ts';

const recipe = (ingredients, steps = [], title = 'Test recipe') => ({
  title,
  ingredients: ingredients.map((name) => ({ name, amount: '適量' })),
  steps,
  tips: '',
});

const violates = (content, restriction) =>
  validateDietaryRestrictions(content, [restriction]).length > 0;

assert.equal(violates(recipe(['鶏肉']), 'ヴィーガン'), true);
assert.equal(violates(recipe(['野菜'], ['仕上げにバターを加える']), 'ヴィーガン'), true);
assert.equal(violates(recipe(['はちみつ']), 'ヴィーガン'), true);
assert.equal(violates(recipe(['ナンプラー']), 'ヴィーガン'), true);
assert.equal(violates(recipe(['かつおだし']), 'ベジタリアン'), true);
assert.equal(violates(recipe(['野菜'], ['火が通ったら器に盛る']), 'ベジタリアン'), false);
assert.equal(violates(recipe(['豆腐'], ['湯が沸いたら豆腐を入れる']), 'ヴィーガン'), false);
assert.equal(violates(recipe(['たら']), '魚介類不使用'), true);
assert.equal(violates(recipe(['たらこ']), '魚介類不使用'), true);
assert.equal(violates(recipe(['野菜'], ['久しぶりに作りたい一品です']), '魚介類不使用'), false);

assert.equal(violates(recipe(['豚肉']), 'ハラール（イスラム教）'), true);
assert.equal(violates(recipe(['みりん']), 'ハラール（イスラム教）'), true);
assert.equal(violates(recipe(['鶏肉']), 'ハラール（イスラム教）'), true);
assert.equal(violates(recipe(['ハラール認証鶏肉'], ['鶏肉を焼く']), 'ハラール（イスラム教）'), false);
assert.equal(violates(recipe(['ハラール認証済み鶏むね肉'], ['鶏むね肉を焼く'], 'スパイスチキン'), 'ハラール（イスラム教）'), false);
assert.equal(violates(recipe(['ハラール認証鶏肉', '牛肉']), 'ハラール（イスラム教）'), true);

assert.equal(violates(recipe(['えび']), 'コーシャ（ユダヤ教）'), true);
assert.equal(violates(recipe(['牛肉', 'バター']), 'コーシャ（ユダヤ教）'), true);
assert.equal(violates(recipe(['牛肉']), 'コーシャ（ユダヤ教）'), true);
assert.equal(violates(recipe(['コーシャ認証牛肉'], ['牛肉を焼く']), 'コーシャ（ユダヤ教）'), false);
assert.equal(violates(recipe(['コーシャ認証牛肉', '鶏肉']), 'コーシャ（ユダヤ教）'), true);

assert.equal(violates(recipe(['牛乳']), '牛肉不可'), false);
assert.equal(violates(recipe(['マッシュルーム']), '豚肉不可'), false);

assert.equal(violates(recipe(['小麦粉']), 'グルテンフリー'), true);
assert.equal(violates(recipe(['パン粉']), 'グルテンフリー'), true);
assert.equal(violates(recipe(['醤油']), 'グルテンフリー'), true);
assert.equal(violates(recipe(['グルテンフリー醤油']), 'グルテンフリー'), false);
assert.equal(violates({
  ...recipe(['グルテンフリー醤油'], ['グルテンフリー醤油を加える'], '鶏肉の醤油炒め'),
  tips: '小麦を含まない製品か表示を確認する。',
}, 'グルテンフリー'), false);
assert.equal(violates({
  ...recipe(['グルテンフリー醤油'], ['醤油は必ずグルテンフリーの製品を使う'], '鶏肉の醤油炒め'),
  tips: '醤油は小麦不使用の表示を確認する。',
}, 'グルテンフリー'), false);
assert.equal(violates(recipe(['醤油'], [], '鶏肉の醤油炒め'), 'グルテンフリー'), true);
assert.equal(violates(recipe(['米']), 'グルテンフリー'), false);
assert.equal(violates(recipe(['rice flour']), 'グルテンフリー'), false);
assert.equal(violates(recipe(['野菜'], ['フライパンで炒める']), 'グルテンフリー'), false);

assert.equal(violates(recipe(['豆乳']), '乳製品不使用'), false);
assert.equal(violates(recipe(['oat milk']), '乳製品不使用'), false);
assert.equal(violates(recipe(['coconut milk']), '乳製品不使用'), false);
assert.equal(violates(recipe(['卵不使用マヨネーズ']), '卵不使用'), false);
assert.equal(violates(recipe(['卵不使用ドレッシング']), '卵不使用'), false);
assert.equal(violates(recipe(['卵']), '卵不使用'), true);
assert.equal(violates(recipe(['酒']), 'アルコール不可'), true);

assert.equal(violates(recipe(['ピーナッツ']), 'ナッツ不使用'), true);
assert.equal(violates(recipe(['cashew']), 'ナッツ不使用'), true);
assert.equal(violates(recipe(['ココナッツ']), 'ナッツ不使用'), false);
assert.equal(violates(recipe(['豆腐']), '大豆不使用'), true);

assert.equal(validateExcludedIngredients(recipe(['shrimp']), ['えび']).length > 0, true);
assert.equal(validateExcludedIngredients(recipe(['milk']), ['牛乳']).length > 0, true);
assert.equal(validateExcludedIngredients(recipe(['野菜'], ['仕上げにbutterを加える']), ['乳製品']).length > 0, true);
assert.equal(validateExcludedIngredients(recipe(['mushroom']), ['ham']).length > 0, false);

const considerations = buildRecipeConsiderations({
  dietaryRestrictions: ['ハラール（イスラム教）', 'invalid', 'グルテンフリー'],
  excludedIngredients: ['shrimp'],
});
assert.deepEqual(considerations, {
  dietaryRestrictions: ['ハラール（イスラム教）', 'グルテンフリー'],
  allergyAndExclusionChecked: true,
});
assert.deepEqual(getConsiderationLabels(considerations, 'en'), [
  'Halal considered', 'Gluten-free', 'Allergies & exclusions checked',
]);
assert.deepEqual(sanitizeRecipeConsiderations({ dietaryRestrictions: ['ヴィーガン'], allergyAndExclusionChecked: true }), {
  dietaryRestrictions: ['ヴィーガン'], allergyAndExclusionChecked: true,
});
assert.equal(buildRecipeConsiderations({}), undefined);

console.log('Dietary safety rules: all tests passed.');
