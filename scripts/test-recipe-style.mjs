import assert from 'node:assert/strict';
import {
  allowedGenresForStyle,
  buildGenreChoiceInstruction,
  buildRecentHistorySection,
  buildRecipeStyleSection,
  filterGenresForStyle,
  normalizeRecipeStyle,
  preferredGenreOptionsForStyle,
} from '../src/lib/recipeStyle.ts';
import { RECIPE_GENRES } from '../src/lib/recipeQuality.ts';

// 旧データ(未設定)や不正値は「ちょいアレンジ」に寄せる
assert.equal(normalizeRecipeStyle(undefined), 'balanced');
assert.equal(normalizeRecipeStyle('weird'), 'balanced');
assert.equal(normalizeRecipeStyle('classic'), 'classic');

// 定番・ちょいアレンジでは世界の料理をジャンル候補から外す
for (const style of ['classic', 'balanced']) {
  const genres = allowedGenresForStyle(style);
  assert.ok(genres.includes('和食') && genres.includes('洋食') && genres.includes('中華'));
  assert.ok(!genres.includes('エチオピア料理'));
  assert.ok(!buildGenreChoiceInstruction(style).includes('ペルー料理'));
  assert.ok(genres.every((genre) => RECIPE_GENRES.includes(genre)), 'must stay within the validated genre list');
}
assert.ok(!allowedGenresForStyle('classic').includes('タイ料理'));
assert.ok(allowedGenresForStyle('balanced').includes('タイ料理'));
assert.deepEqual(allowedGenresForStyle('adventurous'), [...RECIPE_GENRES]);
assert.ok(!preferredGenreOptionsForStyle('adventurous').includes('その他'));

// 範囲外の優先ジャンルはAIに渡さないが、冒険では残る
assert.deepEqual(filterGenresForStyle(['和食', 'エチオピア料理'], 'classic'), ['和食']);
assert.deepEqual(filterGenresForStyle(['和食', 'エチオピア料理'], 'adventurous'), ['和食', 'エチオピア料理']);
assert.deepEqual(filterGenresForStyle(undefined, 'classic'), []);

// 方向性ごとに指示が変わり、どれも基本比率を含む
assert.ok(buildRecipeStyleSection('classic').includes('定番'));
assert.ok(buildRecipeStyleSection('balanced').includes('最大1つ'));
assert.ok(buildRecipeStyleSection('adventurous').includes('日本のスーパー'));
for (const style of ['classic', 'balanced', 'adventurous']) {
  assert.ok(buildRecipeStyleSection(style).includes('醤油・みりん・酒'));
}

// 定番では直近3件の完全一致だけ避け、他は従来どおり履歴全体と違う料理にする
const history = ['生姜焼き', '肉じゃが', '親子丼', 'ハンバーグ', '麻婆豆腐'];
const classicHistory = buildRecentHistorySection(history, 'classic');
assert.ok(classicHistory.includes('親子丼') && !classicHistory.includes('ハンバーグ'));
assert.ok(classicHistory.includes('まったく同じ料理は避け'));
assert.ok(buildRecentHistorySection(history, 'balanced').includes('麻婆豆腐'));
assert.ok(buildRecentHistorySection(history, 'balanced').includes('異なる料理'));
assert.equal(buildRecentHistorySection([], 'classic'), '');
assert.equal(buildRecentHistorySection('not-an-array', 'balanced'), '');

console.log('Recipe style settings and prompt sections: passed.');
