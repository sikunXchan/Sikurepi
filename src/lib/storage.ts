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
  dish_badge?: string | null;
  saved_at: string;
};

export type CookedRecord = {
  date: string;
  recipeTitle: string;
  calories?: number;
  protein_g?: number;
  fat_g?: number;
  carbs_g?: number;
  // 「食材が呼びかける」機能用: 実際に消費したかに関わらず、そのレシピで
  // 使った材料名を全て記録しておく（在庫にずっと残っている食材が、直近の
  // 料理で本当に使われていないかを判定するために使う）
  ingredientNames?: string[];
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

export type UserProfile = {
  tastePreferences: string[];
  excludedIngredients: string[];
  cookingStyles: string[];
  allergies: string[];
  kitchenAppliances: string[];
  targetCalories: number | null;
  targetProtein: number | null;
  address: string;
  enableClimate: boolean;
  // false にすると、塩・醤油などの調味料も「常備してある」前提を外し、
  // 在庫に無ければ通常の食材と同じく不足扱い・AIにも常備を仮定させない。
  assumeSeasoningsAvailable: boolean;
  // ヴィーガン・ハラール等、宗教上/ライフスタイル上の食事制限。
  // アレルギー(excludedIngredients)と同じく、AIには「絶対に破らない制約」として渡す。
  dietaryRestrictions: string[];
  // 優先的に食べたい料理ジャンル。dietaryRestrictionsと違い「絶対」ではなく
  // 「できれば優先して」というやわらかい希望としてAIに伝える。デフォルトは未選択。
  preferredGenres: string[];
};

// --- 材料の不足チェック (レシピの材料が在庫にあるか) ---

// 常備調味料と前提としているもの（AIプロンプトのSEASONING_SECTIONと対応）。
// 在庫に無くても「不足」扱いにはしない。
export const PANTRY_STAPLES = [
  '塩', 'こしょう', '胡椒', '砂糖', '醤油', 'しょうゆ', '味噌', 'みそ', 'みりん', '酒',
  '酢', 'サラダ油', 'ごま油', 'バター', 'だし', 'コンソメ', '鶏がらスープ',
  'ケチャップ', 'マヨネーズ', 'にんにく', 'ニンニク', 'しょうが', '生姜',
];

export function isPantryStaple(ingredientName: string): boolean {
  const name = ingredientName.trim();
  return PANTRY_STAPLES.some(s => name.includes(s));
}

// --- 食材名からのカテゴリ自動判定 (在庫の手動追加時に使用) ---
// src/app/page.tsx の CATEGORY_ORDER (在庫画面のカテゴリ) と対応させている。
// 各カテゴリの正規表現は上から順に評価し、最初に一致したものを採用する。
// 「いちごジャム」のような加工品が素材名(いちご→果物)に引っ張られないよう、
// 調味料・加工品の判定は生鮮カテゴリ(果物・野菜)より先に置いている。
export const CATEGORY_RULES: { category: string; pattern: RegExp }[] = [
  { category: '肉', pattern: /肉|豚|牛|鶏|ミンチ|ひき肉|挽肉|ベーコン|ハム|ソーセージ|ウインナー|つくね|つみれ|サラダチキン|マトン|七面鳥|ターキー|プラントベースミート|ささみ|コンビーフ|ハラミ|ジャーキー|サラミ|パストラミ|チョリソー|プルドポーク|スペアリブ/ },
  { category: '魚介類', pattern: /魚|鮭|サーモン|マグロ|ツナ|エビ|海老|イカ|タコ|蛸|貝|あさり|ハマグリ|はまぐり|蛤|しじみ|(?<!キャッ)サバ|鯖|さば|アジ|鯵|イワシ|鰯|アンチョビ|サンマ|秋刀魚|タラ|鱈|鯛|かに|蟹|タラバガニ|ズワイガニ|ほたて|帆立|かき|牡蠣|かまぼこ|ちくわ|竹輪|海苔|わかめ|昆布|ひじき|かつお|鰹|削り節|しらす|たらこ|明太子|はんぺん|するめ/ },
  { category: '乳製品・卵', pattern: /卵|たまご|玉子|牛乳|ヨーグルト|ケフィア|チーズ|パルメザン|チェダー|モッツァレラ|カマンベール|ゴルゴンゾーラ|マスカルポーネ|リコッタ|ブリー|ゴーダ|バター|ギー|生クリーム|サワークリーム|ホイップクリーム|豆腐|納豆|油揚げ|厚揚げ|豆乳|テンペ|オーツミルク|アーモンドミルク|ココナッツミルク/ },
  { category: '穀物・パン', pattern: /ごはん|ご飯|米|パン|うどん|そば|パスタ|スパゲティ|春雨|小麦粉|薄力粉|強力粉|片栗粉|ごま|胡麻|もち|餅|求肥|ぎゅうひ|そうめん|素麺|中華麺|中華そば|ラーメン|キヌア|キノア|ファッロ|テフ|クスクス|ブルグア|ブルグル|ポレンタ|ライ麦|トルティーヤ|ピタパン|ナン(?!プラー)/ },
  { category: '調味料', pattern: /塩|しお|砂糖|さとう|酢|醤油|しょうゆ|ナンプラー|味噌|みそ|みりん|酒|だし|コンソメ|スープの素|ガラスープ|油|マヨネーズ|ケチャップ|ソース|ぽん酢|ポン酢|はちみつ|蜂蜜|わさび|山葵|こしょう|コショウ|胡椒|ジャム|スプレッド|カレールー|カレールウ|豆板醤|ハリッサ|コチュジャン|カレー粉|ガラムマサラ|ケイジャンスパイス|チリパウダー|フムス|タヒニ|サルサ|スリラチャ|ペスト|タイカレーペースト|クミン|ターメリック|サフラン|シナモン/ },
  // 「いちごのショートケーキ」等が果物(いちご)に引っ張られないよう、生鮮カテゴリより先に置く
  { category: 'お菓子・スイーツ', pattern: /ショートケーキ|あめ(?!ちゃん)|飴|キャンディ|駄菓子|クッキー|ポテトチップス|ポテトチップ|チップス|アイスクリーム|アイス|プリン|チョコレート|チョコ|ガナッシュ|マカロン|ドーナツ|ゼリー|わらび餅|大福|羊羹|団子|グミ|マシュマロ/ },
  { category: '豆類', pattern: /豆(?!腐|乳|板醤)|えだまめ|枝豆|もやし|スプラウト|カイワレ|かいわれ/ },
  { category: 'ナッツ類', pattern: /アーモンド|くるみ|カシューナッツ|ピーナッツ|落花生|ナッツ|ピスタチオ|松の実|ヘーゼルナッツ|マカダミア|ペカン/ },
  { category: '果物', pattern: /りんご|リンゴ|林檎|バナナ|プランテン|プランテーン|レモン(?!グラス)|オレンジ|みかん|デコポン|キンカン|金柑|いちご|イチゴ|苺|ぶどう|ブドウ|シャインマスカット|巨峰|デラウェア|梨|なし|柿|かき|桃|もも|アプリコット|あんず|杏|メロン|スイカ|すいか|キウイ|パイナップル|パイン|マンゴー|グレープフルーツ|ポメロ|レーズン|ゆず|ユズ|柚子|梅|うめ|ライチ|レイシ|茘枝|ロンガン|リュウガン|龍眼|ラズベリー|木いちご|パパイヤ|パパイア|すもも|スモモ|李|プラム/ },
  { category: '野菜', pattern: /たまねぎ|玉ねぎ|エシャロット|エシャレット|シャロット|にんじん|人参|パースニップ|じゃがいも|トマト|きゅうり|キャベツ|だいこん|大根|なす|ナス|ピーマン|パプリカ|ブロッコリー|カリフラワー|ほうれん|とうもろこし|コーン|ねぎ|ネギ|レモングラス|スカリオン|にんにく|ニンニク|ガーリック|しょうが|生姜|しいたけ|椎茸|えのき|しめじ|ブナシメジ|ぶなしめじ|エリンギ|舞茸|まいたけ|きのこ|こんにゃく|しらたき|たけのこ|筍|ごぼう|牛蒡|山芋|長芋|ヤムイモ|れんこん|蓮根|アボカド|アスパラ|かぼちゃ|カボチャ|オクラ|しそ|大葉|唐辛子|白菜|ズッキーニ|かぶ|カブ|ルタバガ|さつまいも|キャッサバ|ユカ|レタス|チコリ|エンダイブ|セロリ|フェンネル|ゴーヤ|水菜|小松菜|スイスチャード|キムチ|パセリ|バジル|パクチー|コリアンダー|ローズマリー|ルッコラ|クレソン/ },
  // 「水菜」等を誤って拾わないよう、最後に置いた上で「水」に否定先読みを付ける
  { category: '飲み物', pattern: /水(?!菜)|ミネラルウォーター|炭酸水|ジュース|コーヒー|紅茶|緑茶|お茶|麦茶|ビール|ワイン|日本酒|焼酎|ハイボール|サワー/ },
];

export function inferIngredientCategory(ingredientName: string): string {
  const name = ingredientName.trim();
  if (!name) return 'その他';
  const hit = CATEGORY_RULES.find(r => r.pattern.test(name));
  return hit ? hit.category : 'その他';
}

export function isIngredientMissing(
  ingredientName: string,
  inventory: Ingredient[],
  assumeSeasoningsAvailable: boolean = true
): boolean {
  const target = ingredientName.trim().toLowerCase();
  if (!target) return false;
  if (assumeSeasoningsAvailable && isPantryStaple(ingredientName)) return false;
  return !inventory.some(inv => {
    const invName = inv.name.trim().toLowerCase();
    return invName.includes(target) || target.includes(invName);
  });
}

// --- 「食材が呼びかける」機能 (食品ロス防止) ---
// 一定日数以上在庫にあり、かつ直近の「料理した！」記録のどのレシピにも
// 使われていない食材を検出する。調味料・常備品は対象外にする。

const FORGOTTEN_INGREDIENT_MIN_DAYS = 5;

export function getForgottenIngredients(minDays: number = FORGOTTEN_INGREDIENT_MIN_DAYS): Ingredient[] {
  const inventory = getLocalIngredients();
  const stats = getLocalUserStats();

  // 表記ゆれ(「キャベツ」⇔「キャベツ（千切り）」等)に強くするため部分一致で判定する
  const usedNames = (stats.cooked_records || [])
    .flatMap(r => r.ingredientNames || [])
    .map(n => n.trim().toLowerCase())
    .filter(Boolean);

  const now = Date.now();

  return inventory.filter(item => {
    if ((item.category || '') === '調味料') return false;
    if (isPantryStaple(item.name)) return false;

    const ageDays = (now - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < minDays) return false;

    const target = item.name.trim().toLowerCase();
    const wasUsedRecently = usedNames.some(used => used.includes(target) || target.includes(used));
    return !wasUsedRecently;
  });
}

// --- 週間献立プラン (Weekly Meal Plan) ---

export type MealSlot = 'lunch' | 'dinner';

export type PlannedRecipe = {
  title: string;
  time: string;
  genre?: string | null;
  dish_badge?: string | null;
  ingredients: { name: string; amount: string }[];
  steps: string[];
  tips: string;
  nutrition?: NutritionData | null;
};

export type WeeklyPlanEntry = {
  date: string; // 'YYYY-MM-DD'
  mealSlot: MealSlot;
  recipe: PlannedRecipe;
};

export type SavedTip = {
  id: string;
  category: string;
  tip: string;
  created_at: string;
};

export type ClimateState = {
  condition: string;
  temperature: number;
  timeOfDay: string;
  advice: string;
};

const KEYS = {
  INVENTORY: 'lily_app_inventory',
  SHOPPING: 'lily_app_shopping',
  SAVED_RECIPES: 'lily_app_saved_recipes',
  STATS: 'lily_app_user_stats',
  PROFILE: 'lily_app_user_profile',
  CLIMATE: 'lily_app_climate',
  TIPS: 'lily_app_saved_tips',
  WEEK_PLAN: 'lily_app_week_plan',
  FREE_GENERATIONS_USED: 'lily_app_free_generations_used',
  LAST_RECIPE_GENERATION: 'lily_app_last_recipe_generation',
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

// 単純な Date.now() をIDに使うと、レシート一括登録のような同期forループ内で
// 複数件を追加した際に同じミリ秒になり、全く別の食材が同一IDを持ってしまう
// (在庫のチェック選択・削除・ピン留めが別アイテムに誤爆する不具合の原因だった)。
// 同一ミリ秒内でも呼び出すたびに必ず値が増える単調増加IDにして衝突を防ぐ。
let idCounter = 0;
function generateId(): number {
  idCounter = (idCounter + 1) % 1000;
  return Date.now() * 1000 + idCounter;
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
  const newItem: Ingredient = {
    id: generateId(),
    name: name.trim(),
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

export function toggleLocalIngredientPin(id: number): void {
  const list = getLocalIngredients();
  const updated = list.map(i => i.id === id ? { ...i, is_pinned: !i.is_pinned } : i);
  setStorage(KEYS.INVENTORY, updated);
}

// カテゴリの意味マッチング判定(非同期)が完了する前にEnterで追加された場合、
// 「その他」のまま登録された食材を後から正しいカテゴリへ更新するために使う。
export function updateLocalIngredientCategory(id: number, category: string): void {
  const list = getLocalIngredients();
  const updated = list.map(i => i.id === id ? { ...i, category } : i);
  setStorage(KEYS.INVENTORY, updated);
}

export function consumeLocalIngredients(ingredientNames: string[]): number {
  const list = getLocalIngredients();
  const normalizedTargets = new Set(ingredientNames.map(n => n.trim().toLowerCase()));
  const remaining = list.filter(item => {
    const itemName = item.name.trim().toLowerCase();
    const shouldRemove = Array.from(normalizedTargets).some(t => itemName.includes(t) || t.includes(itemName));
    return !shouldRemove;
  });
  const consumedCount = list.length - remaining.length;
  setStorage(KEYS.INVENTORY, remaining);
  return consumedCount;
}

// --- 買い物リスト (Shopping) ---

export function getLocalShoppingItems(): ShoppingItem[] {
  return getStorage<ShoppingItem[]>(KEYS.SHOPPING, [
    { id: 1, name: '牛乳', category: '卵・乳製品', is_completed: false, created_at: new Date().toISOString() },
    { id: 2, name: '玉ねぎ', category: '野菜・果物', is_completed: false, created_at: new Date().toISOString() },
  ]);
}

export function addLocalShoppingItem(name: string, category: string = 'その他'): ShoppingItem {
  const list = getLocalShoppingItems();
  const newItem: ShoppingItem = {
    id: generateId(),
    name: name.trim(),
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

export function toggleLocalShoppingItem(id: number): void {
  const list = getLocalShoppingItems();
  const target = list.find(i => i.id === id);
  if (!target) return;

  deleteLocalShoppingItem(id);
  addLocalIngredient(target.name, target.category === '精肉' ? '肉' : target.category === '鮮魚' ? '魚介類' : target.category === '野菜・果物' ? '野菜' : 'その他');
}

// --- 保存レシピ (Saved Recipes) ---

export function getLocalSavedRecipes(): SavedRecipe[] {
  return getStorage<SavedRecipe[]>(KEYS.SAVED_RECIPES, []);
}

export function saveLocalRecipe(recipe: Omit<SavedRecipe, 'id' | 'saved_at'>): SavedRecipe {
  const list = getLocalSavedRecipes();
  const newItem: SavedRecipe = {
    ...recipe,
    id: generateId(),
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

// --- 直近のAIレシピ生成結果 (別タブへ移動しても消えないように保持する) ---

export type LastRecipeGeneration = {
  recipes: any[];
  cookingTips: any[];
  expandedIndex: number;
  savedIndices: number[];
  creationMode: 'inventory' | 'free';
  instruction: string;
  selectedIngredientIds: number[];
  servings: number;
  savedAt: string;
};

export function getLocalLastRecipeGeneration(): LastRecipeGeneration | null {
  return getStorage<LastRecipeGeneration | null>(KEYS.LAST_RECIPE_GENERATION, null);
}

export function setLocalLastRecipeGeneration(data: LastRecipeGeneration): void {
  setStorage(KEYS.LAST_RECIPE_GENERATION, data);
}

// --- 統計 ＆ PFC記録 (Stats) ---

export const DEFAULT_USER_STATS: UserStats = {
  streak_days: 1,
  last_cooked_date: null,
  total_cooked: 0,
  saved_food_count: 0,
  chef_level: 1,
  total_calories: 0,
  total_protein: 0,
  total_fat: 0,
  total_carbs: 0,
  cooked_records: [],
};

export function getLocalUserStats(): UserStats {
  return getStorage<UserStats>(KEYS.STATS, DEFAULT_USER_STATS);
}

// ブリガード・ド・キュイジーヌの階級(Lv.1〜10)に必要な累計自炊回数のしきい値。
// 以前は sqrt(2n)+1 で最大レベルに41回で到達してしまい簡単すぎたため、
// 最上位(エグゼクティブシェフ)には555回の自炊が必要になるよう調整した
// (段階が上がるほど必要回数の伸びが大きくなる、いわゆるRPG的な成長曲線)。
const LEVEL_THRESHOLDS = [0, 5, 15, 35, 65, 110, 170, 260, 380, 555];

export function computeChefLevel(totalCooked: number): number {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (totalCooked >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  return level;
}

// 現在のレベルと次のレベルに必要な回数(進捗バー表示用)。最大レベルではnextを返さない。
export function getChefLevelProgress(totalCooked: number): { level: number; currentThreshold: number; nextThreshold: number | null } {
  const level = computeChefLevel(totalCooked);
  const currentThreshold = LEVEL_THRESHOLDS[level - 1];
  const nextThreshold = level < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[level] : null;
  return { level, currentThreshold, nextThreshold };
}

export function recordLocalCookingDone(consumedCount = 0, recipeTitle = '手作り料理', nutrition?: NutritionData | null, ingredientNames: string[] = []): UserStats {
  const stats = getLocalUserStats();
  const today = new Date().toISOString().split('T')[0];
  let newStreak = stats.streak_days;

  if (stats.last_cooked_date) {
    const lastDate = new Date(stats.last_cooked_date);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));
    if (diffDays === 1) newStreak += 1;
    else if (diffDays > 1) newStreak = 1;
  } else {
    newStreak = 1;
  }

  const newTotal = stats.total_cooked + 1;
  const newSavedFood = stats.saved_food_count + consumedCount;
  const newLevel = computeChefLevel(newTotal);

  const addCals = nutrition?.calories || 0;
  const addProtein = nutrition?.protein_g || 0;
  const addFat = nutrition?.fat_g || 0;
  const addCarbs = nutrition?.carbs_g || 0;

  const newRecord: CookedRecord = {
    date: new Date().toISOString(),
    recipeTitle,
    calories: addCals,
    protein_g: addProtein,
    fat_g: addFat,
    carbs_g: addCarbs,
    ingredientNames,
  };

  const updated: UserStats = {
    streak_days: newStreak,
    last_cooked_date: today,
    total_cooked: newTotal,
    saved_food_count: newSavedFood,
    chef_level: newLevel,
    total_calories: (stats.total_calories || 0) + addCals,
    total_protein: (stats.total_protein || 0) + addProtein,
    total_fat: (stats.total_fat || 0) + addFat,
    total_carbs: (stats.total_carbs || 0) + addCarbs,
    cooked_records: [newRecord, ...(stats.cooked_records || [])].slice(0, 50),
  };
  setStorage(KEYS.STATS, updated);
  return updated;
}

// --- 週間献立プラン (Weekly Meal Plan) ---

export function getLocalWeekPlan(): WeeklyPlanEntry[] {
  return getStorage<WeeklyPlanEntry[]>(KEYS.WEEK_PLAN, []);
}

// 既存の同じ日付・スロットは上書きし、それ以外は保持したままマージする
export function setLocalWeekPlanEntries(entries: WeeklyPlanEntry[]): void {
  const merged = [...getLocalWeekPlan()];
  for (const entry of entries) {
    const idx = merged.findIndex(e => e.date === entry.date && e.mealSlot === entry.mealSlot);
    if (idx >= 0) merged[idx] = entry;
    else merged.push(entry);
  }
  setStorage(KEYS.WEEK_PLAN, merged);
}

export function removeLocalWeekPlanEntry(date: string, mealSlot: MealSlot): void {
  const list = getLocalWeekPlan();
  setStorage(KEYS.WEEK_PLAN, list.filter(e => !(e.date === date && e.mealSlot === mealSlot)));
}

export function clearLocalWeekPlanRange(dates: string[]): void {
  const list = getLocalWeekPlan();
  setStorage(KEYS.WEEK_PLAN, list.filter(e => !dates.includes(e.date)));
}

// --- プレミアムプラン無料枠 (アプリ版のみ有効。Web版は無制限) ---

// アプリ版で「週間献立の自動生成」を無料で使える回数。これを超えるとプレミアムプラン加入を促す。
export const FREE_WEEKLY_PLAN_GENERATIONS = 3;

export function getFreeGenerationsUsed(): number {
  return getStorage<number>(KEYS.FREE_GENERATIONS_USED, 0);
}

export function incrementFreeGenerationsUsed(): number {
  const next = getFreeGenerationsUsed() + 1;
  setStorage(KEYS.FREE_GENERATIONS_USED, next);
  return next;
}

// --- クッキングプロファイル (User Profile: 初期値は未入力) ---

export const DEFAULT_USER_PROFILE: UserProfile = {
  tastePreferences: [],
  excludedIngredients: [],
  cookingStyles: [],
  allergies: [],
  kitchenAppliances: [],
  targetCalories: null,
  targetProtein: null,
  address: '',
  enableClimate: true,
  assumeSeasoningsAvailable: true,
  dietaryRestrictions: [],
  preferredGenres: [],
};

export function getLocalUserProfile(): UserProfile {
  return getStorage<UserProfile>(KEYS.PROFILE, DEFAULT_USER_PROFILE);
}

export function setLocalUserProfile(profile: UserProfile): void {
  setStorage(KEYS.PROFILE, profile);
}

// --- 料理のコツ＆豆知識ライブラリ (Saved Tips) ---

export function getLocalSavedTips(): SavedTip[] {
  return getStorage<SavedTip[]>(KEYS.TIPS, []);
}

export function saveLocalTip(category: string, tip: string): void {
  if (!tip || !tip.trim()) return;
  const list = getLocalSavedTips();
  if (list.some(t => t.tip.trim() === tip.trim())) return;

  const newTip: SavedTip = {
    id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    category: category || 'コツ',
    tip: tip.trim(),
    created_at: new Date().toISOString(),
  };
  setStorage(KEYS.TIPS, [newTip, ...list].slice(0, 100));
}

export function deleteLocalSavedTip(id: string): void {
  const list = getLocalSavedTips();
  setStorage(KEYS.TIPS, list.filter(t => t.id !== id));
}

// --- 気候設定 (Climate State) ---

export const DEFAULT_CLIMATE_STATE: ClimateState = {
  condition: '猛暑・晴れ',
  temperature: 33,
  timeOfDay: '夕食',
  advice: '熱中症予防・塩分＆さっぱり酸味レシピを優先中',
};

export function getLocalClimateState(): ClimateState {
  return getStorage<ClimateState>(KEYS.CLIMATE, DEFAULT_CLIMATE_STATE);
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
  tips?: SavedTip[];
  weekPlan?: WeeklyPlanEntry[];
};

// アカウント同期(SyncManager)でも同じ形のスナップショットを使うため、
// 手動バックアップ(exportBackupJSON)と共通化しておく。
export function buildBackupPayload(): AppBackupPayload {
  return {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    inventory: getLocalIngredients(),
    shopping: getLocalShoppingItems(),
    savedRecipes: getLocalSavedRecipes(),
    stats: getLocalUserStats(),
    profile: getLocalUserProfile(),
    climate: getLocalClimateState(),
    tips: getLocalSavedTips(),
    weekPlan: getLocalWeekPlan(),
  };
}

export function exportBackupJSON(): void {
  if (typeof window === 'undefined') return;

  const payload = buildBackupPayload();
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

// アカウント同期(SyncManager)でも、サーバーから取得したスナップショットを
// ローカルへ反映するのに同じロジックを使うため、JSON文字列を受け取る
// importBackupJSON と、パース済みオブジェクトを受け取るこちらとで分けている。
export function applyBackupPayload(data: any): void {
  if (typeof window === 'undefined') return;
  if (!data || typeof data !== 'object') return;

  if (Array.isArray(data.inventory)) setStorage(KEYS.INVENTORY, data.inventory);
  if (Array.isArray(data.shopping)) setStorage(KEYS.SHOPPING, data.shopping);
  if (Array.isArray(data.savedRecipes)) setStorage(KEYS.SAVED_RECIPES, data.savedRecipes);
  if (data.stats && typeof data.stats === 'object') setStorage(KEYS.STATS, data.stats);
  if (data.profile && typeof data.profile === 'object') setStorage(KEYS.PROFILE, data.profile);
  if (data.climate && typeof data.climate === 'object') setStorage(KEYS.CLIMATE, data.climate);
  if (Array.isArray(data.tips)) setStorage(KEYS.TIPS, data.tips);
  if (Array.isArray(data.weekPlan)) setStorage(KEYS.WEEK_PLAN, data.weekPlan);

  window.dispatchEvent(new Event('storage-updated'));
}

// ローカルに何かしら意味のあるデータが既にあるかどうか。
// 初回ログイン時に「ローカルが空ならサーバーの内容をそのまま反映」
// 「ローカルにデータがあるならサーバーへ送る」を判断するのに使う。
export function hasLocalData(): boolean {
  return (
    getLocalIngredients().length > 0 ||
    getLocalShoppingItems().length > 0 ||
    getLocalSavedRecipes().length > 0 ||
    getLocalUserStats().total_cooked > 0
  );
}

export function importBackupJSON(jsonStr: string): { success: boolean; error?: string } {
  if (typeof window === 'undefined') return { success: false, error: 'Window not available' };

  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') {
      throw new Error('無効なJSONフォーマットです');
    }
    applyBackupPayload(data);
    return { success: true };
  } catch (e: any) {
    console.error('Import error:', e);
    return { success: false, error: e.message || '復元に失敗しました' };
  }
}
