import type { ValidatedRecipe } from './recipeValidation';

function toHiragana(value: string): string {
  return value.replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

export const RECIPE_GENRES = [
  '和食', '洋食', '中華', 'アジア料理', '韓国料理', 'タイ料理', 'インド料理',
  'メキシコ料理', '中東料理', 'イタリアン', 'フレンチ', 'スペイン料理',
  'ギリシャ料理', 'ドイツ・中欧料理', '北欧料理', 'ロシア・東欧料理',
  'ベトナム料理', '台湾料理', 'インドネシア・マレーシア料理',
  'アメリカ南部料理', 'モロッコ・北アフリカ料理', 'エチオピア料理',
  'ジャマイカ・カリブ料理', 'ペルー料理', 'ブラジル料理', 'シンガポール料理',
  'その他',
] as const;

export type RecipeQualityContext = {
  servings?: number;
  mealStyle?: 'single' | 'set';
  targetCaloriesPerServing?: number | null;
  targetProteinPerServing?: number | null;
};

export type RecipeQualityAssessment = {
  errors: string[];
  warnings: string[];
  score: number;
};

export type WeeklySlot = { date: string; mealSlot: 'lunch' | 'dinner' };
export type WeeklyRecipe = ValidatedRecipe & { date: string; meal_slot: 'lunch' | 'dinner' };
export type NutritionTargets = { calories: number; protein_g: number; fat_g: number; carbs_g: number };

const normalize = (value: string) => toHiragana(value.normalize('NFKC').trim().toLowerCase())
  .replace(/[\s\-‐‑‒–—・、,，.。()（）\[\]【】]/g, '');

const DESSERT = /スイーツ|デザート|菓子|ケーキ|プリン|ゼリー|クッキー|タルト|パイ|アイス|パフェ|団子|だんご|餅|大福|どら焼き|マフィン|ドーナツ|ワッフル|ムース|チョコ|クレープ|パンケーキ|ホットケーキ|dessert|cake|pudding|cookie|tart|pie|ice cream|muffin|donut|waffle|chocolate/i;
const SEASONING = /塩|しお|胡椒|こしょう|醤油|しょうゆ|味噌|みそ|砂糖|糖|酢|油|オイル|だし|出汁|コンソメ|ソース|ケチャップ|マヨ|みりん|酒|ワイン|にんにく|生姜|しょうが|ねぎ|葱|ハーブ|バジル|パセリ|レモン|ライム|酢|スパイス|カレー粉|唐辛子|ごま|胡麻|バター|クリーム|チーズ|はちみつ|蜂蜜|シロップ|salt|pepper|soy|miso|sugar|vinegar|oil|stock|broth|sauce|ketchup|mayonnaise|mirin|sake|wine|garlic|ginger|herb|basil|parsley|lemon|lime|spice|chili|sesame|butter|cream|cheese|honey|syrup/i;
const AUXILIARY = /水|湯|氷|片栗粉|小麦粉|薄力粉|強力粉|パン粉|粉|でんぷん|starch|flour|water|ice/i;
const MEASURABLE = /\d|[０-９]|½|⅓|¼|半(?:分)?|ひとつまみ|一つまみ|少々|適量|お好み|\b(?:one|half|quarter|pinch|handful|to taste|as needed)\b/i;
const VAGUE_ONLY = /^(適量|少々|お好みで?|必要量|ひとつまみ|一つまみ|to taste|as needed|some|a little)$/i;
const HEAT_ACTION = /焼|炒|煮|茹|ゆで|蒸|揚|炊|加熱|火にかけ|電子レンジ|レンジ|オーブン|トースター|沸騰|温め|sear|saute|sauté|fry|boil|simmer|steam|bake|roast|grill|microwave|heat|cook/i;
const TIME_OR_CUE = /\d+\s*(秒|分|時間|sec|second|min|minute|hour)|弱火|中火|強火|予熱|沸騰|きつね色|透明|しんなり|とろみ|香り|焼き色|火が通|中心まで|泡立|固ま|soft|tender|golden|bubbl|fragrant|translucent|cooked through|no longer pink|until set|low heat|medium heat|high heat/i;
const SAFE_DONENESS = /75\s*℃|75\s*度|中心.{0,8}(火|加熱|75)|中まで.{0,8}(火|加熱)|肉汁.{0,8}(透明|澄)|赤み.{0,8}(なく|消)|ピンク色.{0,8}(なく|消)|完全に火|十分に加熱|火が通るまで|火を通す|内部温度|中心温度|cooked through|no longer pink|clear juices|internal temperature|165\s*°?f|74\s*°?c|75\s*°?c/i;
const UNSAFE_MEAT = /半生|生焼け|鶏.{0,8}レア|豚.{0,8}レア|ひき肉.{0,8}レア|挽肉.{0,8}レア|rare\s+(chicken|pork|poultry|ground)|pink\s+(chicken|pork|poultry|ground)/i;
const RAW_MEAT = /鶏(?:肉|もも|むね|胸|ささみ|手羽|ひき|挽)|チキン|豚(?:肉|バラ|ロース|こま|ひき|挽)|ポーク|牛(?:肉|バラ|ロース|ひき|挽)|ビーフ|羊肉|ラム肉|ひき肉|挽肉|ミンチ|レバー|\bchicken\b|\bpoultry\b|\bpork\b|\bbeef\b|\blamb\b|ground meat|mince|liver/i;
const HIGH_RISK_MEAT = /鶏(?:肉|もも|むね|胸|ささみ|手羽|ひき|挽)|チキン|豚(?:肉|バラ|ロース|こま|ひき|挽)|ポーク|ひき肉|挽肉|ミンチ|レバー|\bchicken\b|\bpoultry\b|\bpork\b|ground meat|mince|liver/i;
const RAW_FISH = /魚|鮭|さけ|サーモン|鯖|さば|たら|鯛|まぐろ|ツナ|えび|海老|いか|烏賊|たこ|蛸|貝|fish|salmon|mackerel|cod|tuna|shrimp|prawn|squid|octopus|shellfish/i;
const RAW_EGG = /卵|たまご|玉子|\beggs?\b/i;
const SASHIMI_GRADE = /刺身用|生食用|寿司用|sashimi.grade|sushi.grade/i;
const READY_TO_EAT_ANIMAL = /ハム|生ハム|サラミ|ローストビーフ|缶|かまぼこ|ちくわ|さつま揚げ|魚肉ソーセージ|燻製|スモーク|だし|出汁|ブイヨン|コンソメ|スープ|エキス|ソース|ツナ缶|canned|ham|salami|roast beef|smoked|stock|broth|bouillon|extract|sauce/i;
const FLAVOR_ANCHOR = /塩|醤油|しょうゆ|味噌|みそ|だし|出汁|コンソメ|ソース|ケチャップ|チーズ|カレー|唐辛子|にんにく|生姜|しょうが|酢|レモン|ライム|砂糖|はちみつ|蜂蜜|salt|soy|miso|stock|broth|sauce|cheese|curry|chili|garlic|ginger|vinegar|lemon|lime|sugar|honey/i;
const AROMA = /にんにく|生姜|しょうが|ねぎ|葱|玉ねぎ|ごま油|香味油|ハーブ|バジル|パセリ|スパイス|カレー|胡椒|こしょう|香り|garlic|ginger|onion|sesame oil|herb|basil|parsley|spice|pepper|fragrant|aroma/i;
const BALANCE = /酢|レモン|ライム|柑橘|酸味|砂糖|はちみつ|蜂蜜|みりん|甘味|ヨーグルト|vinegar|lemon|lime|citrus|acid|sugar|honey|sweet|yogurt/i;
const TEXTURE = /カリ|サク|シャキ|とろ|ふわ|もち|パリ|食感|こんがり|crisp|crunch|tender|creamy|fluffy|chewy|golden/i;
const EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F]/u;

function recipeText(recipe: ValidatedRecipe): string {
  return [
    recipe.title,
    recipe.genre || '',
    recipe.climate_badge || '',
    recipe.dish_badge || '',
    recipe.course || '',
    ...recipe.ingredients.flatMap((item) => [item.name, item.amount]),
    ...recipe.steps,
    recipe.tips,
  ].join(' ');
}

export function sanitizeServings(value: unknown, fallback = 2, min = 1, max = 15): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function parseRecipeMinutes(value: string): number | null {
  const normalized = value.normalize('NFKC').toLowerCase();
  let minutes = 0;
  const hourMatches = normalized.matchAll(/(\d+(?:\.\d+)?)\s*(?:時間|hours?|hrs?)/g);
  for (const match of hourMatches) minutes += Number(match[1]) * 60;
  const minuteMatches = normalized.matchAll(/(\d+(?:\.\d+)?)\s*(?:分|minutes?|mins?)/g);
  for (const match of minuteMatches) minutes += Number(match[1]);
  return minutes > 0 ? minutes : null;
}

function stepDurationMinutes(steps: string[]): { sum: number; longest: number } {
  let sum = 0;
  let longest = 0;
  for (const step of steps) {
    let current = 0;
    for (const match of step.normalize('NFKC').toLowerCase().matchAll(/(\d+(?:\.\d+)?)\s*(秒|分|時間|seconds?|secs?|minutes?|mins?|hours?|hrs?)/g)) {
      const value = Number(match[1]);
      const unit = match[2];
      const minutes = /秒|sec/.test(unit) ? value / 60 : /時間|hour|hr/.test(unit) ? value * 60 : value;
      current += minutes;
    }
    sum += current;
    longest = Math.max(longest, current);
  }
  return { sum, longest };
}

function ingredientMentioned(name: string, stepsText: string): boolean {
  const target = normalize(name)
    .replace(/^(生|冷凍|新鮮な|fresh|frozen)/, '')
    .replace(/(薄切り|みじん切り|角切り|一口大|切り身|缶詰|適量|お好み).*$/, '');
  if (target.length < 2) return true;
  return stepsText.includes(target) || target.split(/[・\/]/).some((part) => part.length >= 2 && stepsText.includes(part));
}

function energyDifference(recipe: ValidatedRecipe): number | null {
  if (!recipe.nutrition) return null;
  const calculated = recipe.nutrition.protein_g * 4 + recipe.nutrition.fat_g * 9 + recipe.nutrition.carbs_g * 4;
  return Math.abs(recipe.nutrition.calories - calculated);
}

function parseQuantity(value: string): number | null {
  const text = value.normalize('NFKC').toLowerCase();
  const mixedFraction = text.match(/(\d+(?:\.\d+)?)\s*(?:と|and)\s*(\d+)\s*\/\s*(\d+)/);
  if (mixedFraction) return Number(mixedFraction[1]) + Number(mixedFraction[2]) / Number(mixedFraction[3]);
  const fraction = text.match(/(\d+)\s*\/\s*(\d+)/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const decimal = text.match(/\d+(?:\.\d+)?/);
  if (decimal) return Number(decimal[0]);
  if (/半/.test(text) || /\bhalf\b/.test(text)) return 0.5;
  return null;
}

function seasoningBaseAmount(amount: string): number | null {
  const quantity = parseQuantity(amount);
  if (quantity === null) return null;
  const text = amount.normalize('NFKC').toLowerCase();
  if (/大さじ|tbsp|tablespoon/.test(text)) return quantity * 15;
  if (/小さじ|tsp|teaspoon/.test(text)) return quantity * 5;
  if (/カップ|\bcups?\b/.test(text)) return quantity * 200;
  if (/kg|キロ/.test(text)) return quantity * 1000;
  if (/g\b|グラム|ml|cc|ミリリットル/.test(text)) return quantity;
  return null;
}

export function assessRecipeQuality(
  recipe: ValidatedRecipe,
  context: RecipeQualityContext = {},
): RecipeQualityAssessment {
  const errors: string[] = [];
  const warnings: string[] = [];
  const text = recipeText(recipe);
  const dessert = DESSERT.test(text);
  const minutes = parseRecipeMinutes(recipe.time);
  const servings = sanitizeServings(context.servings, 2);

  if (minutes === null) errors.push('time must contain a numeric cooking-time estimate');
  else if (minutes < 3 || minutes > 360) errors.push(`cooking time is implausible: ${recipe.time}`);

  if (recipe.ingredients.length < 2 || recipe.ingredients.length > 30) {
    errors.push(`ingredient count must be between 2 and 30 (received ${recipe.ingredients.length})`);
  }
  if (recipe.steps.length < 2 || recipe.steps.length > 20) {
    errors.push(`step count must be between 2 and 20 (received ${recipe.steps.length})`);
  }

  for (const ingredient of recipe.ingredients) {
    if (!MEASURABLE.test(ingredient.amount)) {
      errors.push(`ingredient amount is not measurable: ${ingredient.name} (${ingredient.amount})`);
    } else if (VAGUE_ONLY.test(ingredient.amount.trim()) && !SEASONING.test(ingredient.name) && !AUXILIARY.test(ingredient.name)) {
      errors.push(`main ingredient needs a concrete amount for ${servings} serving(s): ${ingredient.name}`);
    }

    const baseAmount = seasoningBaseAmount(ingredient.amount);
    if (baseAmount !== null) {
      const perServing = baseAmount / servings;
      if (/^(塩|しお|食塩|salt)$/i.test(ingredient.name.trim()) && perServing > 3) {
        errors.push(`salt amount is implausibly high per serving: ${ingredient.amount}`);
      }
      if (/醤油|しょうゆ|soy sauce/i.test(ingredient.name) && perServing > 45) {
        errors.push(`soy sauce amount is implausibly high per serving: ${ingredient.amount}`);
      }
      if (/味噌|みそ|miso/i.test(ingredient.name) && perServing > 45) {
        errors.push(`miso amount is implausibly high per serving: ${ingredient.amount}`);
      }
      if (/油|オイル|バター|oil|butter/i.test(ingredient.name) && perServing > (dessert ? 90 : 60)) {
        errors.push(`added fat amount is implausibly high per serving: ${ingredient.amount}`);
      }
      if (/砂糖|グラニュー糖|はちみつ|蜂蜜|sugar|honey/i.test(ingredient.name) && !dessert && perServing > 35) {
        errors.push(`sweetener amount is implausibly high for a savory dish: ${ingredient.amount}`);
      }
    }
  }

  const stepsText = normalize(recipe.steps.join(' '));
  const substantialIngredients = recipe.ingredients.filter((item) => !SEASONING.test(item.name) && !AUXILIARY.test(item.name));
  if (substantialIngredients.length > 0) {
    const covered = substantialIngredients.filter((item) => ingredientMentioned(item.name, stepsText)).length;
    const coverage = covered / substantialIngredients.length;
    if (coverage < 0.5) errors.push('too many listed ingredients are never used in the cooking steps');
    else if (coverage < 0.75) warnings.push('some ingredients are not clearly connected to a cooking step');
  }

  const specificStepCount = recipe.steps.filter((step) => TIME_OR_CUE.test(step)).length;
  if (specificStepCount === 0) errors.push('steps need at least one concrete time, heat level, temperature, or doneness cue');
  else if (specificStepCount / recipe.steps.length < 0.5) warnings.push('more steps should include time, heat, or visual doneness cues');

  const duration = stepDurationMinutes(recipe.steps);
  if (minutes !== null && duration.longest > minutes + 2) {
    errors.push(`a single step (${Math.ceil(duration.longest)} min) exceeds the stated total time (${minutes} min)`);
  } else if (minutes !== null && duration.sum > minutes * 1.65 + 10) {
    errors.push(`step durations (${Math.ceil(duration.sum)} min) conflict with the stated total time (${minutes} min)`);
  }

  const animalIngredients = recipe.ingredients.map((item) => item.name);
  const hasMeat = animalIngredients.some((name) => RAW_MEAT.test(name) && !READY_TO_EAT_ANIMAL.test(name));
  const hasHighRiskMeat = animalIngredients.some((name) => HIGH_RISK_MEAT.test(name) && !READY_TO_EAT_ANIMAL.test(name));
  const hasFishNeedingHeat = animalIngredients.some((name) =>
    RAW_FISH.test(name) && !READY_TO_EAT_ANIMAL.test(name) && !SASHIMI_GRADE.test(name)
  );
  const hasEgg = recipe.ingredients.some((item) =>
    RAW_EGG.test(item.name.trim()) && !/ゆで卵|茹で卵|温泉卵|煮卵|マヨ|boiled egg|cooked egg|mayonnaise/i.test(item.name)
  );
  if ((hasMeat || hasFishNeedingHeat || hasEgg) && !HEAT_ACTION.test(recipe.steps.join(' '))) {
    errors.push('raw animal ingredients are listed without a clear cooking step');
  }
  if (hasHighRiskMeat && !SAFE_DONENESS.test(recipe.steps.join(' '))) {
    errors.push('poultry, pork, offal, or ground meat needs a clear safe-doneness cue (preferably 75°C for 1 minute)');
  }
  if (hasHighRiskMeat && UNSAFE_MEAT.test(recipe.steps.join(' '))) {
    errors.push('unsafe rare or undercooked instruction detected for high-risk meat');
  }

  if (!dessert && substantialIngredients.length >= 1 && !FLAVOR_ANCHOR.test(text)) {
    errors.push('savory recipe has no clear seasoning or flavor anchor');
  }
  if (!AROMA.test(text)) warnings.push('the recipe could explain how aroma is developed or finished');
  if (!BALANCE.test(text) && !dessert) warnings.push('the recipe does not show an intentional salt/acid/sweetness balance');
  if (!TEXTURE.test(text)) warnings.push('the recipe could include a clearer texture contrast or finish cue');

  if (!recipe.nutrition) {
    errors.push('nutrition is required for quality and portion validation');
  } else {
    const { calories, protein_g, fat_g, carbs_g } = recipe.nutrition;
    if (calories < 50 || calories > 2500) errors.push(`calories per serving are implausible: ${calories}`);
    if (protein_g < 0 || protein_g > 200) errors.push(`protein per serving is implausible: ${protein_g}`);
    if (fat_g < 0 || fat_g > 200) errors.push(`fat per serving is implausible: ${fat_g}`);
    if (carbs_g < 0 || carbs_g > 400) errors.push(`carbohydrates per serving are implausible: ${carbs_g}`);
    const difference = energyDifference(recipe);
    if (difference !== null && difference > Math.max(120, calories * 0.35)) {
      errors.push('reported calories conflict with the reported protein, fat, and carbohydrate values');
    }
    if (context.targetCaloriesPerServing && context.targetCaloriesPerServing > 0) {
      const ratio = calories / context.targetCaloriesPerServing;
      if (ratio < 0.55 || ratio > 1.45) {
        errors.push(`calories (${calories}) are too far from the per-meal target (${Math.round(context.targetCaloriesPerServing)})`);
      } else if (ratio < 0.75 || ratio > 1.25) {
        warnings.push('calories are somewhat far from the requested per-meal target');
      }
    }
    if (context.targetProteinPerServing && context.targetProteinPerServing > 0) {
      const ratio = protein_g / context.targetProteinPerServing;
      if (ratio < 0.45 || ratio > 2.25) {
        errors.push(`protein (${protein_g}g) is too far from the per-meal target (${Math.round(context.targetProteinPerServing)}g)`);
      }
    }
  }

  if (recipe.genre && !RECIPE_GENRES.includes(recipe.genre as typeof RECIPE_GENRES[number])) {
    errors.push(`genre is outside the supported list: ${recipe.genre}`);
  }
  if (EMOJI.test(text)) {
    errors.push('recipe text must not contain emoji');
  }

  const score = Math.max(0, 100 - errors.length * 22 - warnings.length * 6);
  return { errors, warnings, score };
}

export function qualityGateErrors(
  recipe: ValidatedRecipe,
  context: RecipeQualityContext = {},
  path = 'recipe',
): string[] {
  const assessment = assessRecipeQuality(recipe, context);
  const errors = assessment.errors.map((error) => `${path}: ${error}`);
  if (assessment.score < 85) {
    errors.push(...assessment.warnings.map((warning) => `${path}: ${warning}`));
    errors.push(`${path}: overall reproducibility/flavor score is too low (${assessment.score}/100)`);
  }
  return errors;
}

function dominantProtein(recipe: ValidatedRecipe): string | null {
  const text = recipe.ingredients.map((item) => normalize(item.name)).join(' ');
  const groups: [string, RegExp][] = [
    ['chicken', /鶏|ちきん/], ['pork', /豚|ぽーく/], ['beef', /牛|びーふ/],
    ['fish', /魚|鮭|さけ|さば|鯖|たら|鯛|まぐろ|つな|えび|いか|たこ/],
    ['egg', /卵|たまご|玉子/], ['soy', /豆腐|大豆|厚揚げ|油揚げ/],
  ];
  return groups.find(([, pattern]) => pattern.test(text))?.[0] || null;
}

function dominantFlavor(recipe: ValidatedRecipe): string | null {
  const text = recipeText(recipe);
  const groups: [string, RegExp][] = [
    ['soy', /醤油|しょうゆ|soy sauce/i], ['miso', /味噌|みそ|miso/i],
    ['tomato', /トマト|ケチャップ|tomato|ketchup/i], ['cream', /クリーム|バター|チーズ|cream|butter|cheese/i],
    ['curry', /カレー|curry/i], ['acid', /酢|レモン|ライム|vinegar|lemon|lime/i],
  ];
  return groups.find(([, pattern]) => pattern.test(text))?.[0] || null;
}

export function validateSetMeal(
  recipes: ValidatedRecipe[],
  targetCaloriesPerMeal?: number | null,
  targetProteinPerMeal?: number | null,
): string[] {
  const errors: string[] = [];
  if (recipes.length < 3 || recipes.length > 4) {
    errors.push(`set meal must contain 3 or 4 dishes (received ${recipes.length})`);
  }
  const allowedCourses = new Set(['主菜', '副菜', '汁物', 'ご飯・主食']);
  recipes.forEach((recipe, index) => {
    if (!recipe.course || !allowedCourses.has(recipe.course)) {
      errors.push(`recipes[${index}].course must be 主菜, 副菜, 汁物, or ご飯・主食`);
    }
  });
  const count = (course: string) => recipes.filter((recipe) => recipe.course === course).length;
  if (count('主菜') !== 1) errors.push('set meal must contain exactly one main dish');
  if (count('副菜') < 1 || count('副菜') > 2) errors.push('set meal must contain one or two side dishes');
  if (count('汁物') !== 1) errors.push('set meal must contain exactly one soup');

  const titles = recipes.map((recipe) => normalize(recipe.title));
  if (new Set(titles).size !== titles.length) errors.push('set meal contains duplicate dish titles');
  const main = recipes.find((recipe) => recipe.course === '主菜');
  if (main) {
    const mainProtein = dominantProtein(main);
    if (mainProtein && recipes.filter((recipe) => dominantProtein(recipe) === mainProtein).length > 1) {
      errors.push('the main protein is repeated as the focus of another set-meal dish');
    }
  }
  const flavors = recipes.map(dominantFlavor).filter(Boolean);
  if (flavors.length >= 3 && new Set(flavors).size === 1) {
    errors.push('all set-meal dishes repeat the same dominant seasoning base');
  }
  if (targetCaloriesPerMeal && recipes.every((recipe) => recipe.nutrition)) {
    const totalCalories = recipes.reduce((sum, recipe) => sum + (recipe.nutrition?.calories || 0), 0);
    const ratio = totalCalories / targetCaloriesPerMeal;
    if (ratio < 0.55 || ratio > 1.45) {
      errors.push(`set-meal calories (${Math.round(totalCalories)}) are too far from the per-meal target (${Math.round(targetCaloriesPerMeal)})`);
    }
  }
  if (targetProteinPerMeal && recipes.every((recipe) => recipe.nutrition)) {
    const totalProtein = recipes.reduce((sum, recipe) => sum + (recipe.nutrition?.protein_g || 0), 0);
    const ratio = totalProtein / targetProteinPerMeal;
    if (ratio < 0.55 || ratio > 1.8) {
      errors.push(`set-meal protein (${Math.round(totalProtein)}g) is too far from the per-meal target (${Math.round(targetProteinPerMeal)}g)`);
    }
  }
  return errors;
}

function fuzzyIngredientIncludes(actual: string, expected: string): boolean {
  const a = normalize(actual);
  const e = normalize(expected);
  return Boolean(a && e && (a.includes(e) || e.includes(a)));
}

export function validateRequiredIngredients(
  recipes: ValidatedRecipe[],
  requiredIngredients: string[],
  requireInEveryRecipe = true,
): string[] {
  const errors: string[] = [];
  for (const required of requiredIngredients) {
    if (requireInEveryRecipe) {
      recipes.forEach((recipe, index) => {
        const used = recipe.ingredients.some((item) => fuzzyIngredientIncludes(item.name, required));
        if (!used) errors.push(`recipes[${index}] does not use required ingredient: ${required}`);
      });
    } else {
      const used = recipes.some((recipe) => recipe.ingredients.some((item) => fuzzyIngredientIncludes(item.name, required)));
      if (!used) errors.push(`required ingredient is never used: ${required}`);
    }
  }
  return errors;
}

export function validateWeeklyPlan(
  plan: WeeklyRecipe[],
  requestedSlots: WeeklySlot[],
  pinnedIngredients: string[],
  targets: NutritionTargets,
): string[] {
  const errors: string[] = [];
  const requested = requestedSlots.map((slot) => `${slot.date}:${slot.mealSlot}`).sort();
  const actual = plan.map((slot) => `${slot.date}:${slot.meal_slot}`).sort();
  if (requested.length !== actual.length || requested.some((key, index) => key !== actual[index])) {
    errors.push('weekly plan must contain each requested date/meal slot exactly once, with no extras');
  }

  const titles = plan.map((recipe) => normalize(recipe.title));
  if (new Set(titles).size !== titles.length) errors.push('weekly plan contains duplicate recipe titles');

  for (const pinned of pinnedIngredients) {
    const used = plan.some((recipe) => recipe.ingredients.some((item) => fuzzyIngredientIncludes(item.name, pinned)));
    if (!used) errors.push(`pinned ingredient is never used in the plan: ${pinned}`);
  }

  const mealOrder = { lunch: 0, dinner: 1 } as const;
  const ordered = [...plan].sort((a, b) =>
    a.date.localeCompare(b.date) || mealOrder[a.meal_slot] - mealOrder[b.meal_slot]
  );
  for (let index = 1; index < ordered.length; index++) {
    const previous = dominantProtein(ordered[index - 1]);
    const current = dominantProtein(ordered[index]);
    if (previous && previous === current) {
      errors.push(`adjacent meals repeat the same main protein: ${ordered[index - 1].title} / ${ordered[index].title}`);
      break;
    }
  }

  if (plan.length >= 4) {
    const genres = new Set(plan.map((recipe) => recipe.genre).filter(Boolean));
    if (genres.size < 2) errors.push('weekly plan needs at least two cuisine genres for variety');
  }

  // A single-slot regeneration cannot rebalance a whole week. Per-recipe plausibility is
  // still checked by qualityGateErrors, so aggregate target validation starts at 2 slots.
  if (plan.length >= 2 && plan.every((recipe) => recipe.nutrition)) {
    const total = plan.reduce<NutritionTargets>((sum, recipe) => ({
      calories: sum.calories + (recipe.nutrition?.calories || 0),
      protein_g: sum.protein_g + (recipe.nutrition?.protein_g || 0),
      fat_g: sum.fat_g + (recipe.nutrition?.fat_g || 0),
      carbs_g: sum.carbs_g + (recipe.nutrition?.carbs_g || 0),
    }), { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 });
    (Object.keys(targets) as (keyof NutritionTargets)[]).forEach((key) => {
      if (targets[key] <= 0) return;
      const differenceRatio = Math.abs(total[key] - targets[key]) / targets[key];
      if (differenceRatio > 0.20) {
        errors.push(`weekly ${key} total is outside the target tolerance: ${Math.round(total[key])} vs ${Math.round(targets[key])}`);
      }
    });
  }
  return errors;
}
