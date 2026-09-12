import assert from 'node:assert/strict';
import {
  assessRecipeQuality,
  parseRecipeMinutes,
  qualityGateErrors,
  sanitizeServings,
  validateRequiredIngredients,
  validateSetMeal,
  validateWeeklyPlan,
} from '../src/lib/recipeQuality.ts';

const goodChicken = {
  title: '鶏もも肉の香味レモン照り焼き',
  time: '25分',
  genre: '和食',
  dish_badge: '洗い物少なめ（2点）',
  ingredients: [
    { name: '鶏もも肉', amount: '300g' },
    { name: '玉ねぎ', amount: '1/2個' },
    { name: '醤油', amount: '大さじ1と1/2' },
    { name: 'レモン汁', amount: '大さじ1' },
    { name: 'しょうが', amount: '小さじ1' },
    { name: 'サラダ油', amount: '小さじ1' },
  ],
  steps: [
    '鶏もも肉を一口大に切り、玉ねぎを薄切りにする。',
    'フライパンにサラダ油としょうがを入れて中火で1分加熱し、香りを立てる。',
    '鶏もも肉を加えて中火で片面3分ずつ焼き、玉ねぎ、醤油、レモン汁を加えて4分煮詰める。',
    '鶏肉の中心温度が75℃に達した状態で1分以上加熱し、肉汁が透明になったら火を止める。',
  ],
  tips: '最後に味見し、塩味は必要なら少量ずつ調整する。表面はこんがり、中はジューシーに仕上げる。',
  nutrition: { calories: 490, protein_g: 36, fat_g: 18, carbs_g: 46 },
};

assert.equal(parseRecipeMinutes('1時間20分'), 80);
assert.equal(parseRecipeMinutes('about 35 minutes'), 35);
assert.equal(sanitizeServings('3', 2), 3);
assert.equal(sanitizeServings(99, 2), 15);

const goodAssessment = assessRecipeQuality(goodChicken, { servings: 2 });
assert.deepEqual(goodAssessment.errors, []);
assert.equal(qualityGateErrors(goodChicken, { servings: 2 }).length, 0);

const vagueMain = {
  ...goodChicken,
  ingredients: goodChicken.ingredients.map((item, index) => index === 0 ? { ...item, amount: '適量' } : item),
};
assert.equal(assessRecipeQuality(vagueMain).errors.some((error) => error.includes('concrete amount')), true);

const unsafeChicken = {
  ...goodChicken,
  steps: goodChicken.steps.slice(0, 3),
};
assert.equal(assessRecipeQuality(unsafeChicken).errors.some((error) => error.includes('safe-doneness')), true);

const brokenNutrition = {
  ...goodChicken,
  nutrition: { calories: 1200, protein_g: 10, fat_g: 5, carbs_g: 20 },
};
assert.equal(assessRecipeQuality(brokenNutrition).errors.some((error) => error.includes('conflict')), true);

const overSalted = {
  ...goodChicken,
  ingredients: [
    ...goodChicken.ingredients,
    { name: '塩', amount: '大さじ2' },
  ],
};
assert.equal(assessRecipeQuality(overSalted, { servings: 2 }).errors.some((error) => error.includes('salt amount')), true);
assert.equal(assessRecipeQuality({ ...goodChicken, title: 'おすすめ料理🍳' }).errors.some((error) => error.includes('emoji')), true);

const flatFlavor = {
  title: '豆腐の塩焼き',
  time: '10分',
  genre: '和食',
  ingredients: [
    { name: '豆腐', amount: '300g' },
    { name: '塩', amount: '小さじ1/4' },
  ],
  steps: [
    '豆腐を2cm幅に切る。',
    '塩を振り、中火で片面3分ずつ焼く。',
  ],
  tips: '焼けたら皿に盛る。',
  nutrition: { calories: 180, protein_g: 16, fat_g: 10, carbs_g: 7 },
};
assert.equal(assessRecipeQuality(flatFlavor).errors.length, 0);
assert.equal(qualityGateErrors(flatFlavor).some((error) => error.includes('overall reproducibility/flavor score')), true);

const dessert = {
  title: 'はちみつヨーグルトプリン',
  time: '10分',
  genre: 'その他',
  ingredients: [
    { name: 'ヨーグルト', amount: '200g' },
    { name: 'はちみつ', amount: '大さじ1' },
    { name: 'ゼラチン', amount: '5g' },
    { name: '水', amount: '大さじ2' },
  ],
  steps: [
    '水にゼラチンを入れ、電子レンジで20秒加熱して溶かす。',
    'ヨーグルトとはちみつを混ぜ、ゼラチンを加えて1分よく混ぜる。',
    '器に流し、冷蔵庫で固まるまで冷やす。',
  ],
  tips: 'なめらかな食感になるよう泡立てずに混ぜる。',
  nutrition: { calories: 140, protein_g: 7, fat_g: 4, carbs_g: 19 },
};
assert.equal(qualityGateErrors(dessert).length, 0);

const milkSmoothie = {
  title: 'バナナミルクスムージー',
  time: '5分',
  genre: 'その他',
  ingredients: [
    { name: '牛乳', amount: '200ml' },
    { name: 'バナナ', amount: '1本' },
    { name: 'はちみつ', amount: '小さじ1' },
  ],
  steps: [
    'バナナを2cm幅に切る。',
    '牛乳、バナナ、はちみつをミキサーで1分かくはんし、なめらかになったら注ぐ。',
  ],
  tips: '冷えた牛乳を使うと、甘い香りととろりとした食感が引き立つ。',
  nutrition: { calories: 220, protein_g: 8, fat_g: 7, carbs_g: 32 },
};
assert.equal(assessRecipeQuality(milkSmoothie).errors.some((error) => error.includes('raw animal')), false);
assert.deepEqual(validateRequiredIngredients([goodChicken], ['鶏もも肉']), []);
assert.equal(validateRequiredIngredients([goodChicken], ['じゃがいも']).length, 1);

const side = {
  ...dessert,
  title: 'きゅうりのレモン酢あえ',
  genre: '和食',
  course: '副菜',
  ingredients: [
    { name: 'きゅうり', amount: '2本' },
    { name: 'レモン汁', amount: '大さじ1' },
    { name: '砂糖', amount: '小さじ1' },
  ],
};
const soup = {
  ...dessert,
  title: '豆腐とわかめの味噌汁',
  genre: '和食',
  course: '汁物',
  ingredients: [
    { name: '豆腐', amount: '150g' },
    { name: 'わかめ', amount: '3g' },
    { name: '味噌', amount: '大さじ1' },
  ],
};
const main = { ...goodChicken, course: '主菜' };
assert.deepEqual(validateSetMeal([main, side, soup]), []);
assert.equal(validateSetMeal([main, { ...main }, soup]).length > 0, true);

const weeklyPlan = [
  { ...goodChicken, date: '2026-09-12', meal_slot: 'lunch' },
  {
    ...dessert,
    title: '鮭と野菜のレモン蒸し',
    genre: '洋食',
    ingredients: [
      { name: '鮭', amount: '2切れ' },
      { name: 'キャベツ', amount: '200g' },
      { name: 'レモン汁', amount: '大さじ1' },
    ],
    nutrition: { calories: 310, protein_g: 28, fat_g: 10, carbs_g: 27 },
    date: '2026-09-12',
    meal_slot: 'dinner',
  },
];
const weeklyTargets = { calories: 800, protein_g: 64, fat_g: 28, carbs_g: 73 };
assert.deepEqual(validateWeeklyPlan(
  weeklyPlan,
  [
    { date: '2026-09-12', mealSlot: 'lunch' },
    { date: '2026-09-12', mealSlot: 'dinner' },
  ],
  ['鮭'],
  weeklyTargets,
), []);
assert.equal(validateWeeklyPlan(
  weeklyPlan,
  [{ date: '2026-09-13', mealSlot: 'dinner' }],
  ['じゃがいも'],
  weeklyTargets,
).length > 0, true);

console.log('Recipe quality gate: all tests passed.');
