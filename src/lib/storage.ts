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
  ingredients: { name: string; amount: string }[];
  steps: string[];
  tips: string;
  image_url: string | null;
  nutrition: NutritionData | null;
  genre: string | null;
  saved_at: string;
};

export type UserStats = {
  streak_days: number;
  last_cooked_date: string | null;
  total_cooked: number;
  saved_food_count: number;
  chef_level: number;
};

export type UserProfile = {
  servings: number;
  tastePreferences: string[]; // 例: [うす味・減塩, 高タンパク]
  excludedIngredients: string[]; // 例: [エビ, パクチー]
  cookingStyles: string[]; // 例: [15分以内の時短, フライパン1つ]
};

export type ClimateState = {
  condition: string; // 猛暑・晴れ, 雨・肌寒い, 冬の寒波, 春・うららか, 秋・快晴
  temperature: number; // ℃
  timeOfDay: string; // 朝食, 昼食, 夕食, 夜食
  advice: string;
};

const KEYS = {
  INVENTORY: 'lily_app_inventory',
  SHOPPING: 'lily_app_shopping',
  SAVED_RECIPES: 'lily_app_saved_recipes',
  STATS: 'lily_app_user_stats',
  PROFILE: 'lily_app_user_profile',
  CLIMATE: 'lily_app_climate',
};

// ヘルパー：ブラウザ判定とローカルストレージ取得
function getStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (e) {
    console.error(Failed to read localStorage for key :, e);
    return defaultValue;
  }
}

function setStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event('storage-updated'));
  } catch (e) {
    console.error(Failed to write localStorage for key :, e);
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
    streak_days: 1,
    last_cooked_date: new Date().toISOString().split('T')[0],
    total_cooked: 1,
    saved_food_count: 3,
    chef_level: 1,
  });
}

export function recordLocalCookingDone(consumedCount = 0): UserStats {
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

  const updated: UserStats = {
    streak_days: newStreak,
    last_cooked_date: today,
    total_cooked: newTotal,
    saved_food_count: newSavedFood,
    chef_level: newLevel,
  };
  setStorage(KEYS.STATS, updated);
  return updated;
}

// --- クッキングプロファイル (User Profile) ---

export const DEFAULT_USER_PROFILE: UserProfile = {
  servings: 2,
  tastePreferences: ['うす味・減塩', '高タンパク'],
  excludedIngredients: ['エビ', 'カニ', 'パクチー'],
  cookingStyles: ['15分以内の時短', 'フライパン1つ'],
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
    condition: '猛暑・晴れ',
    temperature: 33,
    timeOfDay: '夕食',
    advice: '熱中症予防・塩分＆さっぱり酸味レシピを優先中',
  });
}

export function setLocalClimateState(state: ClimateState): void {
  setStorage(KEYS.CLIMATE, state);
}

// --- バックアップ (Download JSON) & 復元 (Upload JSON) ---

export type AppBackupPayload = {
  version: '1.0';
  exportedAt: string;
  inventory: Ingredient[];
  shopping: ShoppingItem[];
  savedRecipes: SavedRecipe[];
  stats: UserStats;
  profile: UserProfile;
  climate: ClimateState;
};

export function exportBackupJSON(): void {
  if (typeof window === 'undefined') return;

  const payload: AppBackupPayload = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    inventory: getLocalIngredients(),
    shopping: getLocalShoppingItems(),
    savedRecipes: getLocalSavedRecipes(),
    stats: getLocalUserStats(),
    profile: getLocalUserProfile(),
    climate: getLocalClimateState(),
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().split('T')[0];

  const a = document.createElement('a');
  a.href = url;
  a.download = lily_cooking_backup_.json;
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

    window.dispatchEvent(new Event('storage-updated'));
    return { success: true };
  } catch (e: any) {
    console.error('Import error:', e);
    return { success: false, error: e.message || '復元に失敗しました' };
  }
}
