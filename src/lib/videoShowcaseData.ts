import {
  applyBackupPayload,
  buildBackupPayload,
  computeChefLevel,
  type AppBackupPayload,
  type CookedRecipeSnapshot,
  type CookedRecord,
  type Ingredient,
  type NutritionData,
  type ShoppingItem,
  type WeeklyPlanEntry,
} from './storage';

const SHOWCASE_BACKUP_KEY = 'sikurepi_video_showcase_backup_v1';
const LANGUAGE_KEY = 'lily_app_language';

type ShowcaseBackup = {
  payload: AppBackupPayload;
  language: 'ja' | 'en';
};

type RecipeSeed = Omit<CookedRecipeSnapshot, 'genre' | 'dish_badge' | 'nutrition'> & {
  genre: string;
  dish_badge: string;
  nutrition: NutritionData;
};

const RECIPES: RecipeSeed[] = [
  {
    title: 'Lemon Herb Chicken with Roasted Vegetables', time: '30 min', genre: 'Western', dish_badge: 'High-protein favorite', servings: 2,
    ingredients: [{ name: 'Chicken breast', amount: '300 g' }, { name: 'Broccoli', amount: '1/2 head' }, { name: 'Carrot', amount: '1' }, { name: 'Lemon', amount: '1/2' }, { name: 'Garlic', amount: '1 clove' }],
    steps: ['Season the chicken with lemon, garlic, salt, and pepper.', 'Roast the vegetables until tender.', 'Pan-sear the chicken and serve with the vegetables.'],
    tips: 'Rest the chicken for three minutes before slicing to keep it juicy.', image_url: null,
    nutrition: { calories: 510, protein_g: 49, carbs_g: 34, fat_g: 19 }, meal_format: 'set',
    components: [{ course: 'main', title: 'Lemon Herb Chicken' }, { course: 'side', title: 'Roasted Vegetables' }],
  },
  {
    title: 'Miso-Glazed Salmon Set', time: '25 min', genre: 'Japanese', dish_badge: 'Balanced dinner', servings: 2,
    ingredients: [{ name: 'Salmon', amount: '2 fillets' }, { name: 'Rice', amount: '1 cup' }, { name: 'Spinach', amount: '1 bunch' }, { name: 'Miso', amount: '1 tbsp' }, { name: 'Green onion', amount: '1 stalk' }],
    steps: ['Brush the salmon with miso glaze.', 'Bake until the center flakes easily.', 'Serve with rice and seasoned spinach.'],
    tips: 'Wipe away excess marinade before baking so the miso does not burn.', image_url: null,
    nutrition: { calories: 620, protein_g: 38, carbs_g: 72, fat_g: 20 }, meal_format: 'set',
    components: [{ course: 'main', title: 'Miso-Glazed Salmon' }, { course: 'staple', title: 'Steamed Rice' }, { course: 'side', title: 'Seasoned Spinach' }],
  },
  {
    title: 'Tomato Chickpea Curry', time: '25 min', genre: 'Indian-inspired', dish_badge: 'Plant-powered', servings: 3,
    ingredients: [{ name: 'Chickpeas', amount: '1 can' }, { name: 'Tomato', amount: '2' }, { name: 'Onion', amount: '1' }, { name: 'Spinach', amount: '2 handfuls' }, { name: 'Rice', amount: '1.5 cups' }],
    steps: ['Sauté the onion with curry spices.', 'Add tomato and chickpeas, then simmer.', 'Fold in spinach and serve with rice.'],
    tips: 'Mash a spoonful of chickpeas to naturally thicken the sauce.', image_url: null,
    nutrition: { calories: 540, protein_g: 19, carbs_g: 91, fat_g: 11 }, meal_format: 'single',
  },
  {
    title: 'Ginger Pork and Cabbage Stir-Fry', time: '18 min', genre: 'Japanese', dish_badge: 'Weeknight quick meal', servings: 2,
    ingredients: [{ name: 'Pork', amount: '250 g' }, { name: 'Cabbage', amount: '1/4 head' }, { name: 'Ginger', amount: '1 tbsp' }, { name: 'Onion', amount: '1/2' }, { name: 'Rice', amount: '1 cup' }],
    steps: ['Brown the pork in a hot pan.', 'Add onion and cabbage and stir-fry.', 'Finish with ginger sauce and serve over rice.'],
    tips: 'Cook the cabbage briefly over high heat to keep its sweet crunch.', image_url: null,
    nutrition: { calories: 590, protein_g: 31, carbs_g: 68, fat_g: 22 }, meal_format: 'set',
    components: [{ course: 'main', title: 'Ginger Pork and Cabbage' }, { course: 'staple', title: 'Steamed Rice' }],
  },
  {
    title: 'Creamy Mushroom Pasta', time: '22 min', genre: 'Italian', dish_badge: 'Comfort food', servings: 2,
    ingredients: [{ name: 'Pasta', amount: '180 g' }, { name: 'Mushrooms', amount: '200 g' }, { name: 'Milk', amount: '200 ml' }, { name: 'Cheese', amount: '40 g' }, { name: 'Garlic', amount: '1 clove' }],
    steps: ['Boil the pasta until al dente.', 'Sauté mushrooms and garlic.', 'Add milk and cheese, then toss with pasta.'],
    tips: 'A splash of pasta water makes the sauce silky without extra cream.', image_url: null,
    nutrition: { calories: 610, protein_g: 25, carbs_g: 83, fat_g: 21 }, meal_format: 'single',
  },
  {
    title: 'Colorful Tofu Bibimbap', time: '28 min', genre: 'Korean', dish_badge: 'Vegetable-packed', servings: 2,
    ingredients: [{ name: 'Tofu', amount: '300 g' }, { name: 'Rice', amount: '1 cup' }, { name: 'Carrot', amount: '1/2' }, { name: 'Spinach', amount: '1 bunch' }, { name: 'Mushrooms', amount: '100 g' }, { name: 'Egg', amount: '2' }],
    steps: ['Crisp the tofu in a skillet.', 'Season and cook each vegetable.', 'Arrange over rice and top with an egg.'],
    tips: 'Keep each topping separate until serving for the brightest presentation.', image_url: null,
    nutrition: { calories: 570, protein_g: 28, carbs_g: 76, fat_g: 18 }, meal_format: 'single',
  },
  {
    title: 'Shrimp and Broccoli Fried Rice', time: '16 min', genre: 'Chinese-inspired', dish_badge: 'Fast pantry meal', servings: 2,
    ingredients: [{ name: 'Shrimp', amount: '180 g' }, { name: 'Rice', amount: '2 bowls' }, { name: 'Broccoli', amount: '1/2 head' }, { name: 'Egg', amount: '2' }, { name: 'Green onion', amount: '2 stalks' }],
    steps: ['Sear the shrimp and set aside.', 'Scramble the egg, then fry the rice.', 'Return the shrimp and add broccoli and green onion.'],
    tips: 'Cold rice stays separate and turns lightly crisp in the pan.', image_url: null,
    nutrition: { calories: 560, protein_g: 34, carbs_g: 74, fat_g: 14 }, meal_format: 'single',
  },
  {
    title: 'Pumpkin Soy Milk Soup', time: '24 min', genre: 'Cafe-style', dish_badge: 'Gentle and warming', servings: 3,
    ingredients: [{ name: 'Pumpkin', amount: '400 g' }, { name: 'Soy milk', amount: '400 ml' }, { name: 'Onion', amount: '1/2' }, { name: 'Potato', amount: '1' }, { name: 'Bread', amount: '4 slices' }],
    steps: ['Cook pumpkin, potato, and onion until soft.', 'Blend until smooth.', 'Stir in soy milk over low heat and serve with toast.'],
    tips: 'Do not boil after adding soy milk; gentle heat keeps the texture smooth.', image_url: null,
    nutrition: { calories: 430, protein_g: 16, carbs_g: 69, fat_g: 12 }, meal_format: 'set',
    components: [{ course: 'soup', title: 'Pumpkin Soy Milk Soup' }, { course: 'staple', title: 'Toast' }],
  },
  {
    title: 'Avocado Egg Breakfast Toast', time: '12 min', genre: 'Cafe-style', dish_badge: 'Quick breakfast', servings: 1,
    ingredients: [{ name: 'Bread', amount: '2 slices' }, { name: 'Avocado', amount: '1/2' }, { name: 'Egg', amount: '1' }, { name: 'Tomato', amount: '1/2' }, { name: 'Yogurt', amount: '100 g' }],
    steps: ['Toast the bread.', 'Mash avocado with lemon and pepper.', 'Top with egg and tomato; serve with yogurt.'],
    tips: 'A little lemon keeps the avocado bright and balances its richness.', image_url: null,
    nutrition: { calories: 460, protein_g: 20, carbs_g: 49, fat_g: 22 }, meal_format: 'set',
    components: [{ course: 'main', title: 'Avocado Egg Toast' }, { course: 'side', title: 'Yogurt' }],
  },
  {
    title: 'Beef and Bell Pepper Stir-Fry', time: '20 min', genre: 'Chinese-inspired', dish_badge: 'High-protein dinner', servings: 2,
    ingredients: [{ name: 'Beef', amount: '250 g' }, { name: 'Bell pepper', amount: '2' }, { name: 'Onion', amount: '1/2' }, { name: 'Rice', amount: '1 cup' }, { name: 'Garlic', amount: '1 clove' }],
    steps: ['Sear the beef quickly over high heat.', 'Stir-fry bell pepper and onion.', 'Combine with the sauce and serve with rice.'],
    tips: 'Slice the beef across the grain for a tender bite.', image_url: null,
    nutrition: { calories: 640, protein_g: 39, carbs_g: 70, fat_g: 23 }, meal_format: 'set',
    components: [{ course: 'main', title: 'Beef and Bell Pepper Stir-Fry' }, { course: 'staple', title: 'Steamed Rice' }],
  },
];

const INVENTORY: Array<[string, string, number, boolean]> = [
  ['Chicken breast', '肉・魚介', 1, true], ['Salmon', '肉・魚介', 2, false], ['Egg', '乳製品・卵', 1, true],
  ['Tofu', '乳製品・卵', 3, false], ['Milk', '乳製品・卵', 2, false], ['Yogurt', '乳製品・卵', 4, false],
  ['Cabbage', '野菜・果物', 12, true], ['Carrot', '野菜・果物', 5, false], ['Onion', '野菜・果物', 7, true],
  ['Tomato', '野菜・果物', 2, false], ['Spinach', '野菜・果物', 6, false], ['Broccoli', '野菜・果物', 4, false],
  ['Mushrooms', '野菜・果物', 8, true], ['Avocado', '野菜・果物', 3, false], ['Lemon', '野菜・果物', 5, false],
  ['Green onion', '野菜・果物', 6, false], ['Pumpkin', '野菜・果物', 9, false], ['Potato', '野菜・果物', 8, false],
  ['Rice', '穀物・豆・ナッツ', 2, true], ['Pasta', '穀物・豆・ナッツ', 4, false], ['Bread', '穀物・豆・ナッツ', 1, false],
  ['Chickpeas', '穀物・豆・ナッツ', 10, false], ['Miso', '調味料', 14, false], ['Soy sauce', '調味料', 20, false],
];

const SHOPPING: Array<[string, string, boolean]> = [
  ['Fresh basil', '野菜・果物', false], ['Greek yogurt', '乳製品・卵', false], ['Whole-grain bread', '穀物・豆・ナッツ', false],
  ['Shrimp', '肉・魚介', false], ['Cheese', '乳製品・卵', false], ['Strawberries', '野菜・果物', true],
  ['Oat milk', 'お菓子・飲み物', false], ['Black pepper', '調味料', true],
];

function dateDaysFrom(now: Date, offset: number, hour = 19): string {
  const date = new Date(now);
  date.setHours(hour, 12, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString();
}

function dateKeyDaysFrom(now: Date, offset: number): string {
  const date = new Date(now);
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createVideoShowcasePayload(now = new Date()): AppBackupPayload {
  const inventory: Ingredient[] = INVENTORY.map(([name, category, ageDays, isPinned], index) => ({
    id: 9_100_000 + index,
    name,
    category,
    is_pinned: isPinned,
    created_at: dateDaysFrom(now, -ageDays, 9),
  }));
  const shopping: ShoppingItem[] = SHOPPING.map(([name, category, isCompleted], index) => ({
    id: 9_200_000 + index,
    name,
    category,
    is_completed: isCompleted,
    created_at: dateDaysFrom(now, -index, 10),
  }));

  const cookedRecords: CookedRecord[] = Array.from({ length: 72 }, (_, index) => {
    const recipe = RECIPES[index % RECIPES.length];
    const daysAgo = index < 12 ? index : index + 2;
    const ingredientNames = recipe.ingredients.map((item) => item.name);
    const rescued = index % 5 === 0 ? [{ name: ingredientNames[index % ingredientNames.length], ageDays: 8 + (index % 6) }] : [];
    return {
      date: dateDaysFrom(now, -daysAgo),
      recipeTitle: recipe.title,
      recipe,
      source: index % 4 === 0 ? 'meal-plan' : 'generated',
      sourceRecipeId: `showcase-${index}`,
      calories: recipe.nutrition.calories,
      protein_g: recipe.nutrition.protein_g,
      carbs_g: recipe.nutrition.carbs_g,
      fat_g: recipe.nutrition.fat_g,
      ingredientNames,
      consumedCount: Math.min(4, ingredientNames.length),
      consumedIngredientNames: ingredientNames.slice(0, 4),
      rescuedIngredients: rescued,
      feedback: index % 3 === 0 ? { tags: ['delicious'], wouldCookAgain: true, rating: 'positive', comment: 'Easy to make and worth cooking again.' } : undefined,
    };
  });
  const nutritionTotals = cookedRecords.reduce((sum, record) => ({
    calories: sum.calories + (record.calories || 0),
    protein: sum.protein + (record.protein_g || 0),
    carbs: sum.carbs + (record.carbs_g || 0),
    fat: sum.fat + (record.fat_g || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const rescuedTotal = cookedRecords.reduce((sum, record) => sum + (record.rescuedIngredients?.length || 0), 0);

  const weekPlan: WeeklyPlanEntry[] = Array.from({ length: 7 }, (_, index) => ({
    date: dateKeyDaysFrom(now, index),
    mealSlot: 'dinner',
    recipe: RECIPES[(index + 1) % RECIPES.length],
  }));

  return {
    version: '2.0',
    exportedAt: now.toISOString(),
    guideProgress: { welcomeDismissed: true, dismissed: ['home', 'inventory', 'shopping', 'recipe', 'mealPlan', 'history', 'myPage', 'receipt'] },
    inventory,
    shopping,
    savedRecipes: RECIPES.slice(0, 8).map((recipe, index) => ({ ...recipe, id: 9_300_000 + index, saved_at: dateDaysFrom(now, -index - 1) })),
    recentRecipes: RECIPES.slice(0, 3).map((recipe, index) => ({ ...recipe, id: `showcase-recent-${index}`, recent_at: dateDaysFrom(now, -index, 20), source: 'generated' })),
    stats: {
      streak_days: 12,
      last_cooked_date: dateKeyDaysFrom(now, 0),
      total_cooked: cookedRecords.length,
      saved_food_count: rescuedTotal,
      chef_level: computeChefLevel(cookedRecords.length),
      total_calories: nutritionTotals.calories,
      total_protein: nutritionTotals.protein,
      total_carbs: nutritionTotals.carbs,
      total_fat: nutritionTotals.fat,
      cooked_records: cookedRecords,
    },
    profile: {
      tastePreferences: ['高タンパク', 'うす味・減塩'],
      excludedIngredients: [], allergies: [], dietaryRestrictions: [],
      cookingStyles: ['15分以内の時短', 'フライパン1つ（ワンパン）'],
      kitchenAppliances: ['Microwave', 'Oven', 'Blender'],
      targetCalories: 2000, targetProtein: 80, address: 'Tokyo', enableClimate: true,
      assumeSeasoningsAvailable: true, preferredGenres: ['和食', '洋食', '韓国料理'],
      trayTheme: 'midnight', shareGeneratedRecipes: true, ignoredForgottenIngredientIds: [],
    },
    climate: { condition: 'Clear', temperature: 24, timeOfDay: 'Dinner', advice: 'A fresh, colorful dinner fits tonight.' },
    tips: [
      ['Knife skills', 'Cut ingredients to a similar size so they finish cooking together.'],
      ['Meal prep', 'Wash leafy greens before storing, then keep them dry.'],
      ['Flavor', 'Add acid at the end to brighten a rich dish.'],
      ['Heat control', 'Preheat the pan before adding meat for better browning.'],
      ['Food rescue', 'Use soft vegetables in soups, curries, or sauces.'],
      ['Nutrition', 'Pair grains with beans for a satisfying plant-based meal.'],
    ].map(([category, tip], index) => ({ id: `showcase-tip-${index}`, category, tip, created_at: dateDaysFrom(now, -index) })),
    weekPlan,
    recipeFeedback: [],
    lastRecipeGeneration: {
      recipes: [RECIPES[0]], cookingTips: [{ category: 'Chef’s tip', tip: RECIPES[0].tips }], expandedIndex: 0,
      savedIndices: [0], creationMode: 'free', mealStyle: 'set', instruction: '', selectedIngredientIds: [], servings: 2,
      savedAt: now.toISOString(), requestKey: 'video-showcase',
    },
    recipeGenerationCache: [],
    freeWeeklyPlanUsage: { weekStart: dateKeyDaysFrom(now, 0), count: 0 },
    freeRecipeUsage: { date: dateKeyDaysFrom(now, 0), count: 0 },
    freeReceiptUsage: { date: dateKeyDaysFrom(now, 0), count: 0 },
  };
}

export function installVideoShowcaseData(now = new Date()): void {
  if (typeof window === 'undefined') return;
  if (!window.localStorage.getItem(SHOWCASE_BACKUP_KEY)) {
    const language = window.localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'ja';
    const backup: ShowcaseBackup = { payload: buildBackupPayload(), language };
    window.localStorage.setItem(SHOWCASE_BACKUP_KEY, JSON.stringify(backup));
  }
  applyBackupPayload(createVideoShowcasePayload(now));
  window.localStorage.setItem(LANGUAGE_KEY, 'en');
  window.dispatchEvent(new Event('storage-updated'));
}

export function hasVideoShowcaseBackup(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.localStorage.getItem(SHOWCASE_BACKUP_KEY));
}

export function restoreBeforeVideoShowcaseData(): 'ja' | 'en' | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(SHOWCASE_BACKUP_KEY);
  if (!raw) return null;
  try {
    const backup = JSON.parse(raw) as ShowcaseBackup;
    applyBackupPayload(backup.payload);
    window.localStorage.setItem(LANGUAGE_KEY, backup.language);
    window.localStorage.removeItem(SHOWCASE_BACKUP_KEY);
    window.dispatchEvent(new Event('storage-updated'));
    return backup.language;
  } catch {
    return null;
  }
}
