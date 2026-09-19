import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = (process.env.SIKUREPI_DEMO_BASE_URL || 'https://sikurepi.vercel.app').replace(/\/$/, '');
const outputPath = path.resolve('public/demo/sikurepi-video-account.en.json');
const cachePath = path.resolve('.tmp/video-backup-ai-cache.json');

// These are briefs, not fixture recipes. Every title, ingredient list, amount,
// method, tip and nutrition value in the resulting backup comes from Sikurepi's
// real /api/recipes generation and validation pipeline.
const briefs = [
  'Create a simple one-pan lemon chicken dinner with broccoli and carrots.',
  'Create a Japanese salmon dinner with rice, spinach, miso, and green onion.',
  'Create a colorful tofu and egg bibimbap with several vegetables.',
  'Create a quick shrimp and broccoli fried rice for a busy evening.',
  'Create a ginger pork and cabbage stir-fry with a crisp texture.',
  'Create a tender beef and bell pepper stir-fry with rice.',
  'Create a rich tomato chickpea curry with spinach and aromatic spices.',
  'Create a creamy mushroom pasta using milk and cheese, without heavy cream.',
  'Create a gentle pumpkin and soy milk soup with potato and good toast.',
  'Create a satisfying avocado and egg breakfast toast with tomato and a fresh yogurt side.',
  'Create a baked cod dinner with asparagus, potatoes, and a lemon sauce.',
  'Create a warming lentil, sweet potato, and kale soup with contrasting texture.',
];

const profile = {
  tastePreferences: ['High protein', 'Light seasoning'],
  excludedIngredients: [], allergies: [], dietaryRestrictions: [],
  cookingStyles: ['Quick weekday cooking', 'One-pan when possible'],
  kitchenAppliances: ['Microwave', 'Oven', 'Blender'],
  targetCalories: 2000, targetProtein: 80, servings: 2,
  assumeSeasoningsAvailable: true,
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let generationCache = [];
try {
  generationCache = JSON.parse(await fs.readFile(cachePath, 'utf8'));
} catch {
  generationCache = [];
}

async function generateRecipe(instruction, index) {
  if (generationCache[index]?.recipe?.title) {
    console.log(`[${index + 1}/${briefs.length}] cached: ${generationCache[index].recipe.title}`);
    return generationCache[index];
  }
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'free', mealStyle: 'single', language: 'en', servings: 2,
          pinnedIngredients: [], conditions: [], instruction, userProfile: profile,
        }),
        signal: AbortSignal.timeout(190_000),
      });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.recipes) || !data.recipes[0]) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      const recipe = data.recipes[0];
      console.log(`[${index + 1}/${briefs.length}] ${recipe.title}`);
      const generated = { recipe, tips: Array.isArray(data.cooking_tips) ? data.cooking_tips : [] };
      generationCache[index] = generated;
      await fs.mkdir(path.dirname(cachePath), { recursive: true });
      await fs.writeFile(cachePath, `${JSON.stringify(generationCache, null, 2)}\n`, 'utf8');
      return generated;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await wait(attempt * 1500);
    }
  }
  throw new Error(`Generation failed for brief ${index + 1}: ${lastError instanceof Error ? lastError.message : lastError}`);
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }));
  return results;
}

function daysFrom(date, days, hour = 19) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(hour, 12, 0, 0);
  return next.toISOString();
}

function dayKey(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

function categoryFor(name) {
  const value = name.toLocaleLowerCase();
  if (/chicken|pork|beef|salmon|shrimp|cod|fish|meat/.test(value)) return '肉・魚介';
  if (/egg|milk|cheese|yogurt|butter|tofu|soy milk/.test(value)) return '乳製品・卵';
  if (/rice|bread|pasta|lentil|chickpea|flour|oat|bean/.test(value)) return '穀物・豆・ナッツ';
  if (/salt|sugar|oil|vinegar|sauce|miso|spice|pepper|honey|mayonnaise|ketchup/.test(value)) return '調味料';
  if (/water|tea|coffee|juice|chocolate|cookie|cake/.test(value)) return 'お菓子・飲み物';
  return '野菜・果物';
}

const generated = await mapWithConcurrency(briefs, 3, generateRecipe);
const recipes = generated.map(({ recipe }) => ({ ...recipe, image_url: recipe.image_url || null, servings: recipe.servings || 2 }));
const allTips = generated.flatMap(({ tips }) => tips);
const now = new Date();
const cookedRecords = Array.from({ length: 72 }, (_, index) => {
  const recipe = recipes[index % recipes.length];
  const daysAgo = index < 12 ? index : index + 2;
  const ingredientNames = recipe.ingredients.map((item) => item.name);
  const rescuedIngredients = index % 5 === 0 && ingredientNames.length > 0
    ? [{ name: ingredientNames[index % ingredientNames.length], ageDays: 8 + (index % 6) }]
    : [];
  return {
    date: daysFrom(now, -daysAgo), recipeTitle: recipe.title, recipe,
    source: index % 4 === 0 ? 'meal-plan' : 'generated', sourceRecipeId: `ai-demo-${index}`,
    calories: recipe.nutrition?.calories || 0, protein_g: recipe.nutrition?.protein_g || 0,
    carbs_g: recipe.nutrition?.carbs_g || 0, fat_g: recipe.nutrition?.fat_g || 0,
    ingredientNames, consumedCount: Math.min(4, ingredientNames.length),
    consumedIngredientNames: ingredientNames.slice(0, 4), rescuedIngredients,
    feedback: index % 3 === 0
      ? { tags: ['delicious'], wouldCookAgain: true, rating: 'positive', comment: 'Delicious, practical, and worth making again.' }
      : undefined,
  };
});

const ingredientNames = [...new Set(recipes.flatMap((recipe) => recipe.ingredients.map((item) => item.name)))];
const inventoryNames = ingredientNames.slice(0, 26);
const shoppingNames = ingredientNames.slice(26, 36);
const nutritionTotals = cookedRecords.reduce((totals, record) => ({
  calories: totals.calories + record.calories,
  protein: totals.protein + record.protein_g,
  carbs: totals.carbs + record.carbs_g,
  fat: totals.fat + record.fat_g,
}), { calories: 0, protein: 0, carbs: 0, fat: 0 });

const backup = {
  version: '2.0', exportedAt: now.toISOString(),
  guideProgress: { welcomeDismissed: true, dismissed: ['home', 'inventory', 'shopping', 'recipe', 'mealPlan', 'history', 'myPage', 'receipt'] },
  inventory: inventoryNames.map((name, index) => ({
    id: 8_100_000 + index, name, category: categoryFor(name), is_pinned: index < 3,
    created_at: daysFrom(now, -(index % 14), 9),
  })),
  shopping: shoppingNames.map((name, index) => ({
    id: 8_200_000 + index, name, category: categoryFor(name), is_completed: index % 4 === 0,
    created_at: daysFrom(now, -(index % 4), 10),
  })),
  savedRecipes: recipes.slice(0, 8).map((recipe, index) => ({ ...recipe, id: 8_300_000 + index, saved_at: daysFrom(now, -index - 1) })),
  recentRecipes: recipes.slice(8, 11).map((recipe, index) => ({ ...recipe, id: `ai-demo-recent-${index}`, recent_at: daysFrom(now, -index, 20), source: 'generated' })),
  stats: {
    streak_days: 12, last_cooked_date: dayKey(now, 0), total_cooked: cookedRecords.length,
    saved_food_count: cookedRecords.reduce((sum, item) => sum + item.rescuedIngredients.length, 0),
    chef_level: 5, total_calories: nutritionTotals.calories, total_protein: nutritionTotals.protein,
    total_carbs: nutritionTotals.carbs, total_fat: nutritionTotals.fat, cooked_records: cookedRecords,
  },
  profile: {
    tastePreferences: ['高タンパク', 'うす味・減塩'], excludedIngredients: [], allergies: [], dietaryRestrictions: [],
    cookingStyles: ['15分以内の時短', 'フライパン1つ（ワンパン）'], kitchenAppliances: ['Microwave', 'Oven', 'Blender'],
    targetCalories: 2000, targetProtein: 80, address: 'Tokyo', enableClimate: true,
    assumeSeasoningsAvailable: true, preferredGenres: ['和食', '洋食', '韓国料理'], servings: 2,
    trayTheme: 'midnight', shareGeneratedRecipes: true, ignoredForgottenIngredientIds: [],
  },
  climate: { condition: 'Clear', temperature: 24, timeOfDay: 'Dinner', advice: 'A colorful, balanced dinner fits tonight.' },
  tips: allTips.slice(0, 12).map((tip, index) => ({ id: `ai-demo-tip-${index}`, category: tip.category, tip: tip.tip, created_at: daysFrom(now, -index) })),
  weekPlan: Array.from({ length: 7 }, (_, index) => ({ date: dayKey(now, index), mealSlot: 'dinner', recipe: recipes[(index + 2) % recipes.length] })),
  recipeFeedback: [],
  lastRecipeGeneration: {
    recipes: [recipes[0]], cookingTips: allTips.slice(0, 3), expandedIndex: 0, savedIndices: [0],
    creationMode: 'free', mealStyle: 'single', instruction: briefs[0], selectedIngredientIds: [], servings: 2,
    savedAt: now.toISOString(), requestKey: 'ai-generated-video-account',
  },
  recipeGenerationCache: [],
  freeWeeklyPlanUsage: { weekStart: dayKey(now, 0), count: 0 },
  freeRecipeUsage: { date: dayKey(now, 0), count: 0 },
  freeReceiptUsage: { date: dayKey(now, 0), count: 0 },
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(backup, null, 2)}\n`, 'utf8');
console.log(`Wrote ${outputPath}`);
console.log(`${recipes.length} Sikurepi AI recipes, ${ingredientNames.length} unique ingredient labels, ${cookedRecords.length} cooking records.`);
