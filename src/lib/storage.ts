// LocalStorage Unified Storage Service with JSON Backup & Restore

export type Ingredient = {
  id: number;
  name: string;
  is_pinned: boolean;
  category: string;
  created_at: string;
};

export type ShoppingItem = {
  id: number;
  name: string;
  category: string;
  is_completed: boolean;
  created_at: string;
};

export type NutritionData = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type SavedRecipe = {
  id: number;
  title: string;
  time: string;
  difficulty?: 'かんたん' | 'ふつう' | 'むずかしい';
  rating?: number;
  category_tag?: 'メイン' | 'デザート' | 'その他';
  ingredients: { name: string; amount: string }[];
  steps: string[];
  tips: string;
  image_url: string | null;
  nutrition: NutritionData | null;
  genre: string | null;
  saved_at: string;
};

export type CookedRecord = {
  id: number;
  recipe_title: string;
  cooked_at: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
};

export type UserStats = {
  streak_days: number;
  last_cooked_date: string | null;
  total_cooked: number;
  saved_food_count: number;
  chef_level: number;
  total_calories: number;
  total_protein: number;
  total_fat: number;
  total_carbs: number;
  cooked_records: CookedRecord[];
};

export type SavedTip = {
  id: string;
  category: string;
  tip: string;
  saved_at: string;
};

export type UserProfile = {
  servings: number | null;
  tastePreferences: string[];
  excludedIngredients: string[];
  cookingStyles: string[];
  address: string;
  enableClimate: boolean;
};

export type ClimateState = {
  condition: string;
  temperature: number;
  timeOfDay: string;
  advice: string;
  cityName?: string;
  isRealData?: boolean;
};

const KEYS = {
  INVENTORY: 'lily_app_inventory',
  SHOPPING: 'lily_app_shopping',
  SAVED_RECIPES: 'lily_app_saved_recipes',
  STATS: 'lily_app_user_stats',
  PROFILE: 'lily_app_user_profile',
  CLIMATE: 'lily_app_climate',
  SAVED_TIPS: 'lily_app_saved_tips',
};

function getStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (e) {
    console.error(`Failed to read localStorage for key ${key}:`, e);
    return defaultValue;
  }
}

function setStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event('storage-updated'));
  } catch (e) {
    console.error(`Failed to write localStorage for key ${key}:`, e);
  }
}

// --- 在庫 (Inventory) ---

export function getLocalIngredients(): Ingredient[] {
  return getStorage<Ingredient[]>(KEYS.INVENTORY, [
    { id: 1, name: '豚バラ肉', is_pinned: true, category: '肉', created_at: new Date().toISOString() },
    { id: 2, name: 'キャベツ', is_pinned: false, category: '野菜', created_at: new Date().toISOString() },
    { id: 3, name: 'トマト', is_pinned: false, category: '野菜', created_at: new Date().toISOString() },
    { id: 4, name: '卵', is_pinned: false, category: '乳製品・卵', created_at: new Date().toISOString() },
  ]);
}

export function addLocalIngredient(name: string, category: string = 'その他'): Ingredient {
  const list = getLocalIngredients();
  const clean = name.trim();
  const existing = list.find(i => i.name.toLowerCase() === clean.toLowerCase());
  if (existing) return existing;

  const newItem: Ingredient = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    name: clean,
    is_pinned: false,
    category,
    created_at: new Date().toISOString(),
  };
  setStorage(KEYS.INVENTORY, [newItem, ...list]);
  return newItem;
}

export function deleteLocalIngredient(id: number): void {
  const list = getLocalIngredients();
  setStorage(KEYS.INVENTORY, list.filter(i => i.id !== id));
}

export function toggleLocalIngredientPin(id: number): Ingredient | null {
  const list = getLocalIngredients();
  const target = list.find(i => i.id === id);
  if (!target) return null;

  const updated = list.map(i => i.id === id ? { ...i, is_pinned: !i.is_pinned } : i);
  updated.sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));
  setStorage(KEYS.INVENTORY, updated);
  return target;
}

export function updateLocalIngredientCategory(id: number, category: string): void {
  const list = getLocalIngredients();
  setStorage(KEYS.INVENTORY, list.map(i => i.id === id ? { ...i, category } : i));
}

export function consumeLocalIngredients(names: string[]): number {
  if (!names || names.length === 0) return 0;
  const list = getLocalIngredients();
  const toRemove = new Set(names.map(n => n.trim().toLowerCase()));
  const filtered = list.filter(i => !toRemove.has(i.name.trim().toLowerCase()));
  const consumedCount = list.length - filtered.length;
  setStorage(KEYS.INVENTORY, filtered);
  return consumedCount;
}

// --- 買い物リスト (Shopping) ---

export function getLocalShoppingItems(): ShoppingItem[] {
  return getStorage<ShoppingItem[]>(KEYS.SHOPPING, []);
}

export function addLocalShoppingItem(name: string, category: string = 'その他'): ShoppingItem {
  const list = getLocalShoppingItems();
  const clean = name.trim();
  const existing = list.find(i => i.name.toLowerCase() === clean.toLowerCase() && !i.is_completed);
  if (existing) return existing;

  const newItem: ShoppingItem = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    name: clean,
    category,
    is_completed: false,
    created_at: new Date().toISOString(),
  };
  setStorage(KEYS.SHOPPING, [newItem, ...list]);
  return newItem;
}

export function deleteLocalShoppingItem(id: number): void {
  const list = getLocalShoppingItems();
  setStorage(KEYS.SHOPPING, list.filter(i => i.id !== id));
}

export function toggleLocalShoppingItem(id: number): ShoppingItem | null {
  const list = getLocalShoppingItems();
  const item = list.find(i => i.id === id);
  if (!item) return null;

  // 購入完了したら冷蔵庫（在庫）に自動追加してリストから削除
  addLocalIngredient(item.name, item.category);
  deleteLocalShoppingItem(id);
  return item;
}

// --- 保存レシピ (Saved Recipes) ---

export function getLocalSavedRecipes(): SavedRecipe[] {
  return getStorage<SavedRecipe[]>(KEYS.SAVED_RECIPES, []);
}

export function saveLocalRecipe(recipe: Omit<SavedRecipe, 'id' | 'saved_at'>): SavedRecipe {
  const list = getLocalSavedRecipes();
  const newItem: SavedRecipe = {
    ...recipe,
    id: Date.now() + Math.floor(Math.random() * 1000),
    saved_at: new Date().toISOString(),
  };
  setStorage(KEYS.SAVED_RECIPES, [newItem, ...list]);
  return newItem;
}

export function deleteLocalSavedRecipe(id: number): void {
  const list = getLocalSavedRecipes();
  setStorage(KEYS.SAVED_RECIPES, list.filter(i => i.id !== id));
}

export function getRecentLocalRecipeNames(limit = 5): string[] {
  const list = getLocalSavedRecipes();
  return list.slice(0, limit).map(r => r.title);
}

// --- 統計 ＆ ゲーミフィケーション (Stats) ---

export function getLocalUserStats(): UserStats {
  return getStorage<UserStats>(KEYS.STATS, {
    streak_days: 0,
    last_cooked_date: null,
    total_cooked: 0,
    saved_food_count: 0,
    chef_level: 1,
    total_calories: 0,
    total_protein: 0,
    total_fat: 0,
    total_carbs: 0,
    cooked_records: [],
  });
}

export function recordLocalCookingDone(
  consumedCount = 0,
  recipeTitle?: string,
  nutrition?: NutritionData | null
): UserStats {
  const stats = getLocalUserStats();
  const today = new Date().toISOString().split('T')[0];
  let newStreak = stats.streak_days;

  if (stats.last_cooked_date) {
    const lastDate = new Date(stats.last_cooked_date);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));

    if (diffDays === 1) {
      newStreak += 1;
    } else if (diffDays > 1) {
      newStreak = 1;
    }
  } else {
    newStreak = 1;
  }

  const newTotal = stats.total_cooked + 1;
  const newSavedFood = stats.saved_food_count + consumedCount;
  const newLevel = Math.max(1, Math.min(10, Math.floor(Math.sqrt(newTotal * 2)) + 1));

  const cal = nutrition?.calories || 0;
  const pro = nutrition?.protein_g || 0;
  const fat = nutrition?.fat_g || 0;
  const carb = nutrition?.carbs_g || 0;

  const newRecords: CookedRecord[] = recipeTitle ? [
    {
      id: Date.now(),
      recipe_title: recipeTitle,
      cooked_at: new Date().toISOString(),
      calories: cal,
      protein_g: pro,
      fat_g: fat,
      carbs_g: carb,
    },
    ...(stats.cooked_records || []).slice(0, 49),
  ] : (stats.cooked_records || []);

  const updated: UserStats = {
    streak_days: newStreak,
    last_cooked_date: today,
    total_cooked: newTotal,
    saved_food_count: newSavedFood,
    chef_level: newLevel,
    total_calories: (stats.total_calories || 0) + cal,
    total_protein: (stats.total_protein || 0) + pro,
    total_fat: (stats.total_fat || 0) + fat,
    total_carbs: (stats.total_carbs || 0) + carb,
    cooked_records: newRecords,
  };
  setStorage(KEYS.STATS, updated);
  return updated;
}

// --- 料理のコツ ＆ 豆知識ライブラリ (Saved Tips) ---

export function getLocalSavedTips(): SavedTip[] {
  return getStorage<SavedTip[]>(KEYS.SAVED_TIPS, []);
}

export function addLocalSavedTips(tips: { category: string; tip: string }[]): number {
  if (!tips || tips.length === 0) return 0;
  const current = getLocalSavedTips();
  const existingSet = new Set(current.map(t => t.tip.trim()));
  let addedCount = 0;
  const newItems: SavedTip[] = [];

  for (const t of tips) {
    const clean = t.tip.trim();
    if (clean && !existingSet.has(clean)) {
      existingSet.add(clean);
      newItems.push({
        id: `tip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        category: t.category || '調理のコツ',
        tip: clean,
        saved_at: new Date().toISOString(),
      });
      addedCount++;
    }
  }

  if (newItems.length > 0) {
    setStorage(KEYS.SAVED_TIPS, [...newItems, ...current]);
  }
  return addedCount;
}

export function deleteLocalSavedTip(id: string): void {
  const current = getLocalSavedTips();
  setStorage(KEYS.SAVED_TIPS, current.filter(t => t.id !== id));
}

// --- クッキングプロファイル (User Profile) ---

export const DEFAULT_USER_PROFILE: UserProfile = {
  servings: null,
  tastePreferences: [],
  excludedIngredients: [],
  cookingStyles: [],
  address: '',
  enableClimate: true,
};

export function getLocalUserProfile(): UserProfile {
  return getStorage<UserProfile>(KEYS.PROFILE, DEFAULT_USER_PROFILE);
}

export function setLocalUserProfile(profile: UserProfile): void {
  setStorage(KEYS.PROFILE, profile);
}

// --- 気候設定 (Climate State) ---

export function getLocalClimateState(): ClimateState {
  return getStorage<ClimateState>(KEYS.CLIMATE, {
    condition: '過ごしやすい',
    temperature: 22,
    timeOfDay: '夕食',
    advice: '旬の食材を活かしたヘルシーレシピを優先中',
    cityName: '',
    isRealData: false,
  });
}

export function setLocalClimateState(state: ClimateState): void {
  setStorage(KEYS.CLIMATE, state);
}

// --- バックアップ (Download JSON) & 復元 (Upload JSON) ---

export type AppBackupPayload = {
  version: '2.0';
  exportedAt: string;
  inventory: Ingredient[];
  shopping: ShoppingItem[];
  savedRecipes: SavedRecipe[];
  stats: UserStats;
  profile: UserProfile;
  climate: ClimateState;
  savedTips: SavedTip[];
};

export function exportBackupJSON(): void {
  if (typeof window === 'undefined') return;

  const payload: AppBackupPayload = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    inventory: getLocalIngredients(),
    shopping: getLocalShoppingItems(),
    savedRecipes: getLocalSavedRecipes(),
    stats: getLocalUserStats(),
    profile: getLocalUserProfile(),
    climate: getLocalClimateState(),
    savedTips: getLocalSavedTips(),
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().split('T')[0];

  const a = document.createElement('a');
  a.href = url;
  a.download = `lily_cooking_backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importBackupJSON(jsonStr: string): { success: boolean; error?: string } {
  if (typeof window === 'undefined') return { success: false, error: 'Window not available' };

  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') {
      throw new Error('無効なJSONフォーマットです');
    }

    if (Array.isArray(data.inventory)) setStorage(KEYS.INVENTORY, data.inventory);
    if (Array.isArray(data.shopping)) setStorage(KEYS.SHOPPING, data.shopping);
    if (Array.isArray(data.savedRecipes)) setStorage(KEYS.SAVED_RECIPES, data.savedRecipes);
    if (data.stats && typeof data.stats === 'object') setStorage(KEYS.STATS, data.stats);
    if (data.profile && typeof data.profile === 'object') setStorage(KEYS.PROFILE, data.profile);
    if (data.climate && typeof data.climate === 'object') setStorage(KEYS.CLIMATE, data.climate);
    if (Array.isArray(data.savedTips)) setStorage(KEYS.SAVED_TIPS, data.savedTips);

    window.dispatchEvent(new Event('storage-updated'));
    return { success: true };
  } catch (e: any) {
    console.error('Import error:', e);
    return { success: false, error: e.message || '復元に失敗しました' };
  }
}
