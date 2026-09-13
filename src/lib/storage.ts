// LocalStorage Unified Storage Service with JSON Backup & Restore

import { toHiragana } from './kana';
import type { TrayThemeId } from './trayThemes';
import {
  FREE_DAILY_RECEIPT_SCANS,
  FREE_DAILY_RECIPE_CREDITS,
  FREE_WEEKLY_PLAN_GENERATIONS,
  getRecipeGenerationCost,
  normalizeDailyFeatureUsage,
  normalizeFreeGenerationUsage,
  type DailyFeatureUsage,
  type FreeGenerationUsage,
} from './premiumQuota';

export {
  FREE_COMMUNITY_RECIPE_ITEMS,
  FREE_DAILY_RECEIPT_SCANS,
  FREE_DAILY_RECIPE_CREDITS,
  FREE_HISTORY_ITEMS,
  FREE_WEEKLY_PLAN_GENERATIONS,
  getGenerationWeekKey,
  getRecipeGenerationCost,
} from './premiumQuota';

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

export type FlavorFeedbackTag = 'delicious' | 'bland' | 'salty' | 'too_sweet' | 'heavy';
export type RecipeFeedbackRating = 'positive' | 'negative';

export type CookingFeedback = {
  tags: FlavorFeedbackTag[];
  wouldCookAgain: boolean;
  rating?: RecipeFeedbackRating;
  note?: string;
  comment?: string;
};

export type RecipeFeedbackInput = {
  title: string;
  ingredients?: { name: string; amount?: string }[];
};

export type LocalRecipeFeedback = {
  recipeKey: string;
  recipeTitle: string;
  rating: RecipeFeedbackRating;
  note: string;
  source: 'generation' | 'completion';
  createdAt: string;
};

export type RescuedIngredientSnapshot = {
  name: string;
  ageDays: number;
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
  // 「何を表示したか」ではなく、どの導線から実際に調理を完了したかを残す。
  // みんなのレシピ由来の料理を再共有しないことや、履歴削除時に対応する
  // 自炊記録だけを取り除くために使う。旧データとの互換性のため任意。
  source?: 'generated' | 'meal-plan' | 'history' | 'community' | 'daily-pick';
  sourceRecipeId?: string;
  calories?: number;
  protein_g?: number;
  fat_g?: number;
  carbs_g?: number;
  // 「食材が呼びかける」機能用: 実際に消費したかに関わらず、そのレシピで
  // 使った材料名を全て記録しておく（在庫にずっと残っている食材が、直近の
  // 料理で本当に使われていないかを判定するために使う）
  ingredientNames?: string[];
  // 実際に在庫から減らした食材と、そのうち「使い時」を迎えていた食材を分けて
  // 保存する。従来データとの互換性のため任意項目にしている。
  consumedCount?: number;
  consumedIngredientNames?: string[];
  rescuedIngredients?: RescuedIngredientSnapshot[];
  feedback?: CookingFeedback;
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
  // レシピ結果で使う配膳トレー。旧データには存在しないため任意項目として扱う。
  trayTheme?: TrayThemeId;
  // 実際に作ったレシピ本文だけを「みんなのレシピ」へ自動共有する。Plus利用者は
  // falseにして共有を停止できる。旧データは未定義=trueとして扱う。
  shareGeneratedRecipes?: boolean;
  // 「そろそろ使って」通知をユーザーが明示的に非表示にした食材ID。
  // 食材を削除して再登録した場合は新IDになるため、再び通常判定へ戻る。
  ignoredForgottenIngredientIds?: number[];
};

// --- 材料の不足チェック (レシピの材料が在庫にあるか) ---

// 常備調味料と前提としているもの（AIプロンプトのSEASONING_SECTIONと対応）。
// 在庫に無くても「不足」扱いにはしない。
export const PANTRY_STAPLES = [
  '水', '湯', '塩', 'こしょう', '胡椒', '砂糖', '醤油', 'しょうゆ', '味噌', 'みそ', 'みりん', '酒',
  '酢', 'サラダ油', 'ごま油', 'バター', 'だし', 'コンソメ', '鶏がらスープ',
  'ケチャップ', 'マヨネーズ', 'にんにく', 'ニンニク', 'しょうが', '生姜',
  'water', 'hot water', 'salt', 'pepper', 'sugar', 'soy sauce', 'miso', 'mirin', 'cooking sake', 'vinegar',
  'vegetable oil', 'salad oil', 'cooking oil', 'sesame oil', 'butter', 'stock', 'broth', 'bouillon', 'ketchup',
  'mayonnaise', 'garlic', 'ginger',
];

export function isPantryStaple(ingredientName: string): boolean {
  const name = ingredientName.normalize('NFKC').trim().toLowerCase();
  return PANTRY_STAPLES.some(s => name.includes(s));
}

// 在庫画面(page.tsx)・レシピ生成画面(recipe/page.tsx)の食材選択UIなど、
// カテゴリ別に食材をグルーピングして表示する画面で共通して使う表示順とアイコン。
// (2026-09) ユーザーからのフィードバックで、従来の12カテゴリは種類が多すぎると
// 指摘があり、似た用途のものをまとめて7カテゴリへ圧縮した。
export const CATEGORY_ORDER = ['野菜・果物', '肉・魚介', '乳製品・卵', '穀物・豆・ナッツ', '調味料', 'お菓子・飲み物', 'その他'];

export const CATEGORY_ICON_SLUGS: Record<string, string> = {
  '野菜・果物': 'vegetables',
  '肉・魚介': 'meat',
  '乳製品・卵': 'dairy_egg',
  '穀物・豆・ナッツ': 'grains_bread',
  '調味料': 'seasoning',
  'お菓子・飲み物': 'sweets_category',
  'その他': 'other',
};

// 旧12カテゴリ(圧縮前)の名前がそのまま保存されている既存データ(ユーザーの
// localStorage・Supabaseバックアップ)を、新しい7カテゴリへ読み込み時に
// 変換するための対応表。新カテゴリ名はキーが存在しないのでそのまま通す。
const LEGACY_CATEGORY_MIGRATION: Record<string, string> = {
  '野菜': '野菜・果物',
  '果物': '野菜・果物',
  '肉': '肉・魚介',
  '魚介類': '肉・魚介',
  '穀物・パン': '穀物・豆・ナッツ',
  '豆類': '穀物・豆・ナッツ',
  'ナッツ類': '穀物・豆・ナッツ',
  'お菓子・スイーツ': 'お菓子・飲み物',
  '飲み物': 'お菓子・飲み物',
};

export function normalizeCategory(category: string): string {
  return LEGACY_CATEGORY_MIGRATION[category] || category;
}

// --- 食材名からのカテゴリ自動判定 (在庫の手動追加時に使用) ---
// 上のCATEGORY_ORDER(在庫画面のカテゴリ)と対応させている。
// 各カテゴリの正規表現は上から順に評価し、最初に一致したものを採用する。
// 「いちごジャム」のような加工品が素材名(いちご→野菜・果物)に引っ張られないよう、
// 調味料・加工品の判定は生鮮カテゴリ(野菜・果物)より先に置いている。
export const CATEGORY_RULES: { category: string; pattern: RegExp }[] = [
  // 「ちくわぶ」は小麦粉が原料で魚介ではないため、「ちくわ」には後ろに「ぶ」が
  // 続かない場合のみマッチするようにし、穀物側のちくわぶ判定に譲る。
  // 「サバ/さば」も「キャッサバ」(野菜・果物)の一部と誤って拾わないよう、カタカナ・
  // ひらがな両方の表記に同じ否定先読みを付ける(判定時にひらがな正規化される
  // ため、ここで両方書いておかないと片方の表記だけ誤爆する)。
  // 「牛」「鶏」は未知の部位名を拾うための総称キーワードだが、素のままだと
  // 「牛乳」「鶏卵」まで肉・魚介として拾ってしまう(乳製品・卵カテゴリの判定に譲る)。
  { category: '肉・魚介', pattern: /肉|豚|牛(?!乳)|鶏(?!卵)|ミンチ|ひき肉|挽肉|ベーコン|ハム|ソーセージ|ウインナー|つくね|つみれ|サラダチキン|マトン|七面鳥|ターキー|プラントベースミート|ささみ|コンビーフ|ハラミ|ジャーキー|サラミ|パストラミ|チョリソー|プルドポーク|スペアリブ|レバー|砂肝|ホルモン|パンチェッタ|プロシュート|魚|鮭|サーモン|マグロ|ツナ|エビ|海老|イカ|タコ|蛸|貝|あさり|ハマグリ|はまぐり|蛤|しじみ|(?<!キャッ)サバ|鯖|(?<!キャッ)さば|アジ|鯵|イワシ|鰯|アンチョビ|サンマ|秋刀魚|タラ|鱈|鯛|かに|蟹|カニカマ|タラバガニ|ズワイガニ|ほたて|帆立|かき|牡蠣|かまぼこ|さつま揚げ|ちくわ(?!ぶ)|竹輪|海苔|あおのり|あおさ|わかめ|もずく|めかぶ|昆布|ひじき|かつお|鰹|削り節|しらす|たらこ|明太子|はんぺん|するめ|ぶり|はまち|うなぎ|あなご|いくら|うに/ },
  { category: '乳製品・卵', pattern: /卵|たまご|玉子|牛乳|ヨーグルト|ケフィア|チーズ|パルメザン|チェダー|モッツァレラ|カマンベール|ゴルゴンゾーラ|マスカルポーネ|リコッタ|ブリー|ゴーダ|バター|ギー|生クリーム|サワークリーム|ホイップクリーム|豆腐|納豆|油揚げ|厚揚げ|豆乳|テンペ|オーツミルク|アーモンドミルク|ココナッツミルク|おから|湯葉/ },
  // 「米」は米油(調味料の油)・米酢(調味料の酢)・米麹(調味料の発酵麹)には一致させない
  // (後続の「調味料」カテゴリの判定に譲る)
  { category: '穀物・豆・ナッツ', pattern: /ごはん|ご飯|米(?!油|酢|麹|こうじ)|パン|うどん|そば|パスタ|マカロニ|スパゲティ|春雨|小麦粉|薄力粉|強力粉|片栗粉|ごま|胡麻|もち|餅|求肥|ぎゅうひ|そうめん|素麺|中華麺|中華そば|ラーメン|キヌア|キノア|ファッロ|テフ|クスクス|ブルグア|ブルグル|ポレンタ|ライ麦|トルティーヤ|ピタパン|ナン(?!プラー)|ドライイースト|イースト|ライスペーパー|オートミール|シリアル|白玉粉|上新粉|ちくわぶ|ライスヌードル|フォー|ビーフン|豆(?!腐|乳|板醤)|えだまめ|枝豆|もやし|スプラウト|カイワレ|かいわれ|アーモンド|くるみ|カシューナッツ|ピーナッツ|落花生|ナッツ|ピスタチオ|松の実|ヘーゼルナッツ|マカダミア|ペカン/ },
  { category: '調味料', pattern: /塩|しお|砂糖|さとう|酢|醤油|しょうゆ|ナンプラー|味噌|みそ|みりん|酒|だし|コンソメ|スープの素|ガラスープ|油|マヨネーズ|ケチャップ|ソース|ドレッシング|ぽん酢|ポン酢|はちみつ|蜂蜜|わさび|山葵|こしょう|コショウ|胡椒|ジャム|スプレッド|カレールー|カレールウ|豆板醤|ハリッサ|コチュジャン|カレー粉|ガラムマサラ|ケイジャンスパイス|チリパウダー|フムス|タヒニ|サルサ|スリラチャ|ペスト|タイカレーペースト|クミン|ターメリック|サフラン|シナモン|バニラ|マスタード|タマリンド|ケッパー|八角|スターアニス|カルダモン|クローブ|コリアンダーシード|海鮮醤|ホイシンソース|メープルシロップ|アガベシロップ|オリーブオイル/ },
  // 「いちごのショートケーキ」等が野菜・果物(いちご)に引っ張られないよう、生鮮カテゴリより先に置く。
  // 「水菜」を誤って拾わないよう「水」には否定先読みを付ける。
  { category: 'お菓子・飲み物', pattern: /ショートケーキ|あめ(?!ちゃん)|飴|キャンディ|駄菓子|クッキー|ポテトチップス|ポテトチップ|チップス|アイスクリーム|アイス|プリン|チョコレート|チョコ|ガナッシュ|マカロン|ドーナツ|ゼリー|わらび餅|大福|羊羹|団子|グミ|マシュマロ|水(?!菜)|ミネラルウォーター|炭酸水|ジュース|コーヒー|紅茶|緑茶|お茶|麦茶|ビール|ワイン|日本酒|焼酎|ハイボール|サワー/ },
  { category: '野菜・果物', pattern: /りんご|リンゴ|林檎|バナナ|プランテン|プランテーン|レモン(?!グラス)|オレンジ|みかん|デコポン|キンカン|金柑|いちご|イチゴ|苺|ぶどう|ブドウ|シャインマスカット|巨峰|デラウェア|梨|なし|柿|かき|桃|もも|アプリコット|あんず|杏|メロン|スイカ|すいか|キウイ|パイナップル|パイン|マンゴー|グレープフルーツ|ポメロ|レーズン|ゆず|ユズ|柚子|梅|うめ|ライチ|レイシ|茘枝|ロンガン|リュウガン|龍眼|ラズベリー|木いちご|パパイヤ|パパイア|すもも|スモモ|李|プラム|デーツ|ナツメヤシ|たまねぎ|玉ねぎ|エシャロット|エシャレット|シャロット|にんじん|人参|パースニップ|じゃがいも|トマト|きゅうり|キャベツ|だいこん|大根|なす|ナス|ピーマン|パプリカ|ブロッコリー|カリフラワー|ほうれん|とうもろこし|コーン|ねぎ|ネギ|レモングラス|スカリオン|にんにく|ニンニク|ガーリック|しょうが|生姜|しいたけ|椎茸|えのき|しめじ|ブナシメジ|ぶなしめじ|エリンギ|舞茸|まいたけ|マッシュルーム|なめこ|きのこ|こんにゃく|しらたき|たけのこ|筍|ごぼう|牛蒡|山芋|長芋|ヤムイモ|れんこん|蓮根|アボカド|アスパラ|かぼちゃ|カボチャ|オクラ|しそ|大葉|唐辛子|白菜|ズッキーニ|かぶ|カブ|ルタバガ|さつまいも|キャッサバ|ユカ|レタス|チコリ|エンダイブ|セロリ|フェンネル|ゴーヤ|水菜|小松菜|スイスチャード|キムチ|パセリ|バジル|パクチー|コリアンダー|ローズマリー|ルッコラ|クレソン|ニラ|にら|ミント|春菊|オレガノ|タイム|セージ|ディル|ガランガル|ハラペーニョ|アーティチョーク|オリーブ|トリュフ|バイマックルー|こぶみかんの葉/ },
];

// カタカナ/ひらがなの表記ゆれ(「トマト」⇔「とまと」等)を吸収するため、
// 判定時は食材名・パターン双方をひらがなに正規化してから照合する
// (パターン中の漢字・記号はひらがな化の対象外なのでそのまま残る)。
const NORMALIZED_CATEGORY_RULES = CATEGORY_RULES.map(rule => ({
  category: rule.category,
  pattern: new RegExp(toHiragana(rule.pattern.source), rule.pattern.flags),
}));

export function inferIngredientCategory(ingredientName: string): string {
  const name = ingredientName.trim();
  if (!name) return 'その他';
  const normalizedName = toHiragana(name);
  const hit = NORMALIZED_CATEGORY_RULES.find(r => r.pattern.test(normalizedName));
  return hit ? hit.category : 'その他';
}

export function isIngredientMissing(
  ingredientName: string,
  inventory: Ingredient[],
  assumeSeasoningsAvailable: boolean = true
): boolean {
  const target = normalizeIngredientName(ingredientName);
  if (!target) return false;
  if (assumeSeasoningsAvailable && isPantryStaple(ingredientName)) return false;
  return !inventory.some(inv => {
    const invName = normalizeIngredientName(inv.name);
    if (!invName) return false;
    return invName.includes(target) || target.includes(invName);
  });
}

function normalizeIngredientName(name: string): string {
  return toHiragana(name.normalize('NFKC').trim().toLowerCase()).replace(/\s+/g, '');
}

// --- レシピ検索: 材料充足度 ---
// 「材料が1個でも一致したから作れる」ではなく、レシピの必要材料それぞれが
// 在庫にあるかどうかをisIngredientMissingと同じ基準(表記ゆれの部分一致・
// 常備調味料の扱い)で判定し、その充足割合をパーセンテージとして算出する。
// 常備調味料の扱いは、在庫画面・レシピ生成と同じユーザー設定
// (assumeSeasoningsAvailable)にそのまま従わせ、アプリ全体で判定基準がぶれない
// ようにする。
export type IngredientFulfillment = {
  percent: number; // 0〜100(材料が1つも無いレシピは0扱い)
  matchedCount: number;
  totalCount: number;
  missingNames: string[];
};

export function computeIngredientFulfillment(
  recipeIngredients: { name: string }[],
  inventory: Ingredient[],
  assumeSeasoningsAvailable: boolean = true
): IngredientFulfillment {
  const names = recipeIngredients.map(i => i.name).filter(n => n && n.trim());
  if (names.length === 0) {
    return { percent: 0, matchedCount: 0, totalCount: 0, missingNames: [] };
  }

  const missingNames = names.filter(name => isIngredientMissing(name, inventory, assumeSeasoningsAvailable));
  const matchedCount = names.length - missingNames.length;
  const percent = Math.round((matchedCount / names.length) * 100);

  return { percent, matchedCount, totalCount: names.length, missingNames };
}

// --- 「食材が呼びかける」機能 (食品ロス防止) ---
// 一定日数以上在庫にあり、かつ直近の「料理した！」記録のどのレシピにも
// 使われていない食材を検出する。調味料・常備品は対象外にする。

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const RECENT_USAGE_WINDOW_DAYS = 30;

function forgottenThresholdDays(item: Ingredient): number {
  const name = item.name.normalize('NFKC').toLowerCase();

  // 丸ごとの根菜・かぼちゃ等は6日程度で急かさない。カテゴリだけでは判断しにくい
  // 長持ち食材を先に個別判定し、一般的な生鮮品より保守的な期間にする。
  if (/かぼちゃ|南瓜|たまねぎ|玉ねぎ|玉葱|じゃがいも|さつまいも|にんじん|人参|ごぼう|大根|pumpkin|squash|onion|potato|carrot/.test(name)) return 14;
  if (/キャベツ|白菜|れんこん|蓮根|cabbage|napa cabbage|lotus root/.test(name)) return 10;
  if (/きのこ|キノコ|えのき|しめじ|舞茸|まいたけ|椎茸|しいたけ|トマト|tomato|mushroom/.test(name)) return 8;

  switch (item.category) {
    case '肉・魚介': return 3;
    case '乳製品・卵': return 5;
    case '野菜・果物': return 8;
    case '穀物・豆・ナッツ': return 21;
    case 'お菓子・飲み物': return 30;
    default: return 14;
  }
}

export function getIngredientAgeDays(item: Ingredient, now = Date.now()): number {
  const createdAt = new Date(item.created_at).getTime();
  if (!Number.isFinite(createdAt)) return 0;
  return Math.max(0, Math.floor((now - createdAt) / MS_PER_DAY));
}

function isRescueEligibleIngredient(item: Ingredient, now: number, minDays?: number): boolean {
  if ((item.category || '') === '調味料' || isPantryStaple(item.name)) return false;
  const createdAt = new Date(item.created_at).getTime();
  if (!Number.isFinite(createdAt)) return false;
  return (now - createdAt) / MS_PER_DAY >= (minDays ?? forgottenThresholdDays(item));
}

// 呼びかけを非表示にしていても、実際に使い切れた時は成果として記録できるよう、
// ignored設定や最近の使用履歴には左右されない「救済対象」だけを返す。
export function getRescueEligibleIngredients(minDays?: number): Ingredient[] {
  const now = Date.now();
  return getLocalIngredients()
    .filter(item => isRescueEligibleIngredient(item, now, minDays))
    .sort((a, b) => getIngredientAgeDays(b, now) - getIngredientAgeDays(a, now));
}

export function getIgnoredForgottenIngredientIds(): number[] {
  return getLocalUserProfile().ignoredForgottenIngredientIds || [];
}

export function ignoreForgottenIngredient(id: number): void {
  const profile = getLocalUserProfile();
  const current = profile.ignoredForgottenIngredientIds || [];
  if (current.includes(id)) return;
  setLocalUserProfile({ ...profile, ignoredForgottenIngredientIds: [...current, id] });
}

export function clearIgnoredForgottenIngredients(): void {
  const profile = getLocalUserProfile();
  setLocalUserProfile({ ...profile, ignoredForgottenIngredientIds: [] });
}

export function getForgottenIngredients(minDays?: number): Ingredient[] {
  const inventory = getLocalIngredients();
  const stats = getLocalUserStats();
  const ignoredIds = new Set(getIgnoredForgottenIngredientIds());
  const now = Date.now();
  const recentUsageCutoff = now - RECENT_USAGE_WINDOW_DAYS * MS_PER_DAY;

  // 表記ゆれ(「キャベツ」⇔「キャベツ（千切り）」等)に強くするため部分一致で判定する
  const usedNames = (stats.cooked_records || [])
    .filter((record) => {
      const usedAt = new Date(record.date).getTime();
      return Number.isFinite(usedAt) && usedAt >= recentUsageCutoff;
    })
    .flatMap(r => r.ingredientNames || [])
    .map(n => n.trim().toLowerCase())
    .filter(Boolean);

  return inventory.filter(item => {
    if (ignoredIds.has(item.id)) return false;
    if (!isRescueEligibleIngredient(item, now, minDays)) return false;

    const target = item.name.trim().toLowerCase();
    const wasUsedRecently = usedNames.some(used => used.includes(target) || target.includes(used));
    return !wasUsedRecently;
  }).sort((a, b) => getIngredientAgeDays(b, now) - getIngredientAgeDays(a, now));
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
  FREE_RECIPE_USAGE: 'lily_app_free_recipe_usage_v1',
  FREE_RECEIPT_USAGE: 'lily_app_free_receipt_usage_v1',
  LAST_RECIPE_GENERATION: 'lily_app_last_recipe_generation',
  RECIPE_GENERATION_CACHE: 'lily_app_recipe_generation_cache_v2',
  RECIPE_FEEDBACK: 'lily_app_recipe_feedback_v1',
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

// --- 端末ID (みんなのレシピのいいね重複防止用) ---

const DEVICE_ID_KEY = 'lily_app_device_id';

// ログイン不要の「いいね」機能で、同じ端末からの多重いいねをサーバー側の
// unique制約で防ぐために使う匿名の端末識別子。ユーザーデータではないため
// バックアップ/復元・アカウント同期の対象には含めない。
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

// --- 今日のおすすめ (ホームタブ) のクライアント側キャッシュ ---
// 在庫・好みから生成した端末ごとのおすすめを、ローカル日付をキーに1件保存する。
// 同じ日はタブを開き直しても通信・再生成せず、日付が変わった時だけ更新する。
// scopeは旧「全ユーザー共通」キャッシュを一度だけ無効化するためのバージョン。
const DAILY_PICK_CACHE_KEY = 'lily_app_daily_pick_cache';
const DAILY_PICK_CACHE_SCOPE = 'personalized-v3-quality';

export function getTodayLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCachedDailyPick<T>(todayDate: string, constraintKey = ''): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DAILY_PICK_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed?.scope !== DAILY_PICK_CACHE_SCOPE ||
      parsed?.date !== todayDate ||
      parsed?.constraintKey !== constraintKey
    ) return null;
    return parsed.recipe ?? null;
  } catch {
    return null;
  }
}

export function setCachedDailyPick<T>(todayDate: string, recipe: T, constraintKey = ''): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DAILY_PICK_CACHE_KEY, JSON.stringify({
      scope: DAILY_PICK_CACHE_SCOPE,
      date: todayDate,
      constraintKey,
      recipe,
    }));
  } catch {
    // 保存に失敗しても致命的ではない(次回また生成し直すだけ)ので無視する
  }
}

// 「今日のおすすめ」をタップした時、レシピタブの通常のレシピカードと全く同じ見た目・
// 機能(材料の不足表示・クッキングモード・保存・料理完了ボタン等)で開けるようにする
// ための1回きりの受け渡し。ホームタブ側で言語に応じて文言を確定させてから
// ここへ入れ、レシピタブのマウント時に読み出して消費する(タブ間ナビゲーションを
// 挟むだけの一時データなので、バックアップ対象のlocalStorageではなくsessionStorageを使う)。
const DAILY_PICK_HANDOFF_KEY = 'lily_app_daily_pick_handoff';

export type DailyPickHandoffRecipe = {
  title: string;
  time: string;
  genre?: string;
  dish_badge?: string;
  ingredients: { name: string; amount: string }[];
  steps: string[];
  tips: string;
  nutrition?: NutritionData | null;
  source?: 'daily-pick' | 'community';
  sourceRecipeId?: string;
};

export function setPendingDailyPickHandoff(recipe: DailyPickHandoffRecipe): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(DAILY_PICK_HANDOFF_KEY, JSON.stringify(recipe));
  } catch {
    // 保存に失敗しても致命的ではない(レシピタブが通常の空の状態で開くだけ)ので無視する
  }
}

export function consumePendingDailyPickHandoff(): DailyPickHandoffRecipe | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(DAILY_PICK_HANDOFF_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(DAILY_PICK_HANDOFF_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// --- 在庫 (Inventory) ---

export function getLocalIngredients(): Ingredient[] {
  const list = getStorage<Ingredient[]>(KEYS.INVENTORY, [
    { id: 1, name: '豚バラ肉', is_pinned: true, category: '肉・魚介', created_at: new Date().toISOString() },
    { id: 2, name: 'キャベツ', is_pinned: false, category: '野菜・果物', created_at: new Date().toISOString() },
    { id: 3, name: 'トマト', is_pinned: false, category: '野菜・果物', created_at: new Date().toISOString() },
    { id: 4, name: '卵', is_pinned: false, category: '乳製品・卵', created_at: new Date().toISOString() },
  ]);
  // 旧12カテゴリ時代に保存された既存データも、新しい7カテゴリへ読み込み時に変換する
  return list.map(i => ({ ...i, category: normalizeCategory(i.category || 'その他') }));
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

export function consumeLocalIngredientsDetailed(ingredientNames: string[]): Ingredient[] {
  const list = getLocalIngredients();
  const idsToRemove = new Set<number>();

  for (const rawTarget of ingredientNames) {
    const target = normalizeIngredientName(rawTarget);
    if (!target) continue;

    const available = list.filter(item => !idsToRemove.has(item.id));
    const exact = available.find(item => normalizeIngredientName(item.name) === target);
    if (exact) {
      idsToRemove.add(exact.id);
      continue;
    }

    // 「ねぎ」で玉ねぎと長ねぎの両方を消すような曖昧な削除は禁止する。
    // 部分一致しかない場合は候補を1件に特定できたときだけ消費する。
    const partial = available.filter(item => {
      const itemName = normalizeIngredientName(item.name);
      if (!itemName) return false;
      return itemName.includes(target) || target.includes(itemName);
    });
    if (partial.length === 1) idsToRemove.add(partial[0].id);
  }

  const consumed = list.filter(item => idsToRemove.has(item.id));
  const remaining = list.filter(item => !idsToRemove.has(item.id));
  setStorage(KEYS.INVENTORY, remaining);
  return consumed;
}

export function consumeLocalIngredients(ingredientNames: string[]): number {
  return consumeLocalIngredientsDetailed(ingredientNames).length;
}

// --- 買い物リスト (Shopping) ---

export function getLocalShoppingItems(): ShoppingItem[] {
  const list = getStorage<ShoppingItem[]>(KEYS.SHOPPING, [
    { id: 1, name: '牛乳', category: '乳製品・卵', is_completed: false, created_at: new Date().toISOString() },
    { id: 2, name: '玉ねぎ', category: '野菜・果物', is_completed: false, created_at: new Date().toISOString() },
  ]);
  // 旧12カテゴリ時代に保存された既存データも、新しい7カテゴリへ読み込み時に変換する
  return list.map(i => ({ ...i, category: normalizeCategory(i.category || 'その他') }));
}

// カテゴリを明示しなかった場合は、売り場独自の分類ではなく在庫タブと同じ
// inferIngredientCategory()で自動判定する(在庫と買い物リストのカテゴリ体系を
// 統一し、購入完了時に在庫へ移す際もカテゴリ変換が不要になるようにするため)。
export function addLocalShoppingItem(name: string, category?: string): ShoppingItem {
  const list = getLocalShoppingItems();
  const newItem: ShoppingItem = {
    id: generateId(),
    name: name.trim(),
    category: category || inferIngredientCategory(name),
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

// 買い物リストと在庫は同じカテゴリ体系(CATEGORY_ORDER)を使っているため、
// 購入完了時のカテゴリ変換は不要にそのまま引き渡せる。
export function toggleLocalShoppingItem(id: number): void {
  const list = getLocalShoppingItems();
  const target = list.find(i => i.id === id);
  if (!target) return;

  deleteLocalShoppingItem(id);
  addLocalIngredient(target.name, target.category || inferIngredientCategory(target.name));
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
  recipes: {
    title: string;
    time: string;
    genre?: string;
    climate_badge?: string;
    dish_badge?: string;
    course?: string;
    ingredients: { name: string; amount: string }[];
    steps: string[];
    tips: string;
    image_url: string | null;
    nutrition?: NutritionData | null;
  }[];
  cookingTips: { category: string; tip: string }[];
  expandedIndex: number;
  savedIndices: number[];
  creationMode: 'inventory' | 'free';
  mealStyle?: 'single' | 'set';
  instruction: string;
  selectedIngredientIds: number[];
  servings: number;
  savedAt: string;
  requestKey?: string;
};

export type RecipeGenerationCacheEntry = LastRecipeGeneration & {
  requestKey: string;
};

const RECIPE_GENERATION_CACHE_LIMIT = 6;
export const RECIPE_GENERATION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function withoutSavedInstruction<T extends LastRecipeGeneration>(data: T): T {
  return data.instruction ? { ...data, instruction: '' } : data;
}

export function getLocalLastRecipeGeneration(): LastRecipeGeneration | null {
  const stored = getStorage<LastRecipeGeneration | null>(KEYS.LAST_RECIPE_GENERATION, null);
  if (!stored) return null;
  const sanitized = withoutSavedInstruction(stored);
  if (sanitized !== stored) setStorage(KEYS.LAST_RECIPE_GENERATION, sanitized);
  return sanitized;
}

export function setLocalLastRecipeGeneration(data: LastRecipeGeneration): void {
  setStorage(KEYS.LAST_RECIPE_GENERATION, withoutSavedInstruction(data));
}

export function getLocalCachedRecipeGeneration(
  requestKey: string,
  maxAgeMs = RECIPE_GENERATION_CACHE_TTL_MS,
): LastRecipeGeneration | null {
  const now = Date.now();
  const entries = getLocalRecipeGenerationCache();
  const entry = entries.find((candidate) =>
    candidate.requestKey === requestKey
    && Number.isFinite(Date.parse(candidate.savedAt))
    && now - Date.parse(candidate.savedAt) <= maxAgeMs
  );
  return entry || null;
}

export function setLocalCachedRecipeGeneration(data: LastRecipeGeneration & { requestKey: string }): void {
  const entries = getLocalRecipeGenerationCache();
  const next = [
    withoutSavedInstruction(data),
    ...entries.filter((entry) => entry.requestKey !== data.requestKey),
  ].slice(0, RECIPE_GENERATION_CACHE_LIMIT);
  setStorage(KEYS.RECIPE_GENERATION_CACHE, next);
}

export function getLocalRecipeGenerationCache(): RecipeGenerationCacheEntry[] {
  const stored = getStorage<RecipeGenerationCacheEntry[]>(KEYS.RECIPE_GENERATION_CACHE, []);
  const sanitized = stored.map(withoutSavedInstruction);
  if (sanitized.some((entry, index) => entry !== stored[index])) {
    setStorage(KEYS.RECIPE_GENERATION_CACHE, sanitized);
  }
  return sanitized;
}

// --- 統計 ＆ PFC記録 (Stats) ---

export const DEFAULT_USER_STATS: UserStats = {
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
};

export function getLocalUserStats(): UserStats {
  const stats = getStorage<UserStats>(KEYS.STATS, DEFAULT_USER_STATS);
  if (!stats.last_cooked_date || stats.streak_days === 0) return stats;

  const lastCooked = new Date(`${stats.last_cooked_date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!Number.isFinite(lastCooked.getTime())) return stats;
  const diffDays = Math.floor((today.getTime() - lastCooked.getTime()) / (1000 * 3600 * 24));
  return diffDays > 1 ? { ...stats, streak_days: 0 } : stats;
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

export function recordLocalCookingDone(
  consumedCount = 0,
  recipeTitle = '手作り料理',
  nutrition?: NutritionData | null,
  ingredientNames: string[] = [],
  feedback?: CookingFeedback,
  consumedIngredientNames: string[] = [],
  rescuedIngredients: RescuedIngredientSnapshot[] = [],
  metadata: Pick<CookedRecord, 'source' | 'sourceRecipeId'> = {},
): UserStats {
  const stats = getLocalUserStats();
  const today = getTodayLocalDateKey();
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
  // 「救済した食材」は単なる在庫消費数ではなく、保管日数が食材別のしきい値を
  // 超えてから実際に使い切れた件数だけを数える。
  const newSavedFood = stats.saved_food_count + rescuedIngredients.length;
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
    consumedCount,
    consumedIngredientNames,
    rescuedIngredients,
    feedback,
    source: metadata.source,
    sourceRecipeId: metadata.sourceRecipeId,
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
    // 食材図鑑は調理履歴から復元できる設計なので、全300種を十分集められ、
    // 最上位ランク(555回)へ到達しても初期の発見が消えない件数を保持する。
    cooked_records: [newRecord, ...(stats.cooked_records || [])].slice(0, 750),
  };
  setStorage(KEYS.STATS, updated);
  return updated;
}

export function getRecentFlavorFeedbackSummary(limit = 12): {
  recipeTitle: string;
  tags: FlavorFeedbackTag[];
  wouldCookAgain: boolean;
  rating?: RecipeFeedbackRating;
  note?: string;
  comment?: string;
}[] {
  const cookedFeedback = getLocalUserStats().cooked_records
    .filter((record) => record.feedback && (
      (Array.isArray(record.feedback.tags) && record.feedback.tags.length > 0)
      || record.feedback.wouldCookAgain === true
      || record.feedback.rating === 'positive'
      || record.feedback.rating === 'negative'
      || Boolean(record.feedback.note?.trim())
      || Boolean(record.feedback.comment?.trim())
    ))
    .map((record) => ({
      recipeTitle: record.recipeTitle,
      tags: Array.isArray(record.feedback?.tags) ? record.feedback.tags : [],
      wouldCookAgain: record.feedback?.wouldCookAgain === true,
      rating: record.feedback?.rating,
      note: record.feedback?.note?.trim() || undefined,
      comment: record.feedback?.comment?.trim() || undefined,
      createdAt: record.date,
    }));

  const seenTitles = new Set<string>();
  // 生成結果を眺めただけの旧評価は学習へ混ぜず、調理完了まで記録された感想だけを使う。
  return cookedFeedback
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .filter((entry) => {
      const key = entry.recipeTitle.normalize('NFKC').trim().toLocaleLowerCase();
      if (!key || seenTitles.has(key)) return false;
      seenTitles.add(key);
      return true;
    })
    .slice(0, Math.max(0, limit))
    .map((entry) => ({
      recipeTitle: entry.recipeTitle,
      tags: entry.tags,
      wouldCookAgain: entry.wouldCookAgain,
      rating: entry.rating,
      note: entry.note,
      comment: entry.comment,
    }));
}

export function createLocalRecipeFeedbackKey(recipe: RecipeFeedbackInput): string {
  const title = recipe.title.normalize('NFKC').trim().toLocaleLowerCase();
  const ingredients = (recipe.ingredients || [])
    .map((item) => [
      item.name.normalize('NFKC').trim().toLocaleLowerCase(),
      (item.amount || '').normalize('NFKC').trim().toLocaleLowerCase(),
    ])
    .filter(([name]) => Boolean(name));
  return JSON.stringify([title, ingredients]);
}

export function getLocalRecipeFeedbackList(): LocalRecipeFeedback[] {
  return getStorage<LocalRecipeFeedback[]>(KEYS.RECIPE_FEEDBACK, []).filter((entry) =>
    Boolean(entry?.recipeKey && entry?.recipeTitle)
    && (entry.rating === 'positive' || entry.rating === 'negative')
  );
}

export function getLocalRecipeFeedback(recipe: RecipeFeedbackInput): LocalRecipeFeedback | null {
  const key = createLocalRecipeFeedbackKey(recipe);
  return getLocalRecipeFeedbackList().find((entry) => entry.recipeKey === key) || null;
}

export function saveLocalRecipeFeedback(
  recipe: RecipeFeedbackInput,
  rating: RecipeFeedbackRating,
  note = '',
  source: 'generation' | 'completion' = 'generation',
): LocalRecipeFeedback {
  const recipeKey = createLocalRecipeFeedbackKey(recipe);
  const next: LocalRecipeFeedback = {
    recipeKey,
    recipeTitle: recipe.title.normalize('NFKC').trim().slice(0, 160),
    rating,
    note: note.normalize('NFKC').trim().slice(0, 500),
    source,
    createdAt: new Date().toISOString(),
  };
  setStorage(KEYS.RECIPE_FEEDBACK, [
    next,
    ...getLocalRecipeFeedbackList().filter((entry) => entry.recipeKey !== recipeKey),
  ].slice(0, 150));
  return next;
}

function localDateKeyFromIso(value: string): string | null {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return getTodayLocalDateKey(date);
}

function deriveCookingStreak(records: CookedRecord[]): { streakDays: number; lastCookedDate: string | null } {
  const dateKeys = Array.from(new Set(records
    .map((record) => localDateKeyFromIso(record.date))
    .filter((value): value is string => Boolean(value))))
    .sort((a, b) => b.localeCompare(a));
  if (dateKeys.length === 0) return { streakDays: 0, lastCookedDate: null };

  let streakDays = 1;
  let cursor = new Date(`${dateKeys[0]}T12:00:00`);
  const available = new Set(dateKeys.slice(1));
  while (true) {
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() - 1);
    const previous = getTodayLocalDateKey(cursor);
    if (!available.has(previous)) break;
    streakDays += 1;
  }
  return { streakDays, lastCookedDate: dateKeys[0] };
}

function removeCookingRecords(stats: UserStats, shouldRemove: (record: CookedRecord, index: number) => boolean): UserStats {
  const records = stats.cooked_records || [];
  const removed = records.filter(shouldRemove);
  if (removed.length === 0) return stats;
  const kept = records.filter((record, index) => !shouldRemove(record, index));
  const streak = deriveCookingStreak(kept);
  const subtract = (key: 'calories' | 'protein_g' | 'fat_g' | 'carbs_g') =>
    removed.reduce((sum, record) => sum + (Number(record[key]) || 0), 0);
  const rescuedCount = removed.reduce((sum, record) => sum + (record.rescuedIngredients?.length || 0), 0);
  const totalCooked = Math.max(0, stats.total_cooked - removed.length);
  const updated: UserStats = {
    ...stats,
    cooked_records: kept,
    total_cooked: totalCooked,
    chef_level: computeChefLevel(totalCooked),
    saved_food_count: Math.max(0, stats.saved_food_count - rescuedCount),
    total_calories: Math.max(0, (stats.total_calories || 0) - subtract('calories')),
    total_protein: Math.max(0, (stats.total_protein || 0) - subtract('protein_g')),
    total_fat: Math.max(0, (stats.total_fat || 0) - subtract('fat_g')),
    total_carbs: Math.max(0, (stats.total_carbs || 0) - subtract('carbs_g')),
    streak_days: streak.streakDays,
    last_cooked_date: streak.lastCookedDate,
  };
  setStorage(KEYS.STATS, updated);
  return updated;
}

// 自炊記録を削除した時は、回数・階級・PFC・救済数・連続記録も同時に戻す。
export function deleteLocalCookedRecord(index: number): UserStats {
  const stats = getLocalUserStats();
  return removeCookingRecords(stats, (_, recordIndex) => recordIndex === index);
}

// 保存履歴を削除する時、その履歴から行った自炊記録も統計から除く。
// sourceRecipeIdを持たない旧データだけは、正規化した料理名で対応付ける。
export function deleteLocalCookingRecordsForRecipe(recipeId: number, recipeTitle: string): UserStats {
  const stats = getLocalUserStats();
  const id = String(recipeId);
  const normalizedTitle = recipeTitle.normalize('NFKC').trim().toLocaleLowerCase();
  return removeCookingRecords(stats, (record) => {
    if (record.sourceRecipeId) return record.sourceRecipeId === id;
    return record.recipeTitle.normalize('NFKC').trim().toLocaleLowerCase() === normalizedTitle;
  });
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

function getFreeGenerationUsage(now: Date = new Date()): FreeGenerationUsage {
  const stored = getStorage<unknown>(KEYS.FREE_GENERATIONS_USED, null);
  const usage = normalizeFreeGenerationUsage(stored, now);
  const current = stored as Partial<FreeGenerationUsage> | null;
  if (current?.weekStart !== usage.weekStart || current?.count !== usage.count) {
    setStorage(KEYS.FREE_GENERATIONS_USED, usage);
  }
  return usage;
}

export function getFreeGenerationsUsed(now: Date = new Date()): number {
  return getFreeGenerationUsage(now).count;
}

export function incrementFreeGenerationsUsed(now: Date = new Date()): number {
  const usage = getFreeGenerationUsage(now);
  const next = usage.count + 1;
  setStorage(KEYS.FREE_GENERATIONS_USED, { ...usage, count: next });
  return next;
}

export function getFreeGenerationsRemaining(now: Date = new Date()): number {
  return Math.max(0, FREE_WEEKLY_PLAN_GENERATIONS - getFreeGenerationsUsed(now));
}

function getDailyFeatureUsage(key: string, now: Date = new Date()): DailyFeatureUsage {
  const stored = getStorage<unknown>(key, null);
  const usage = normalizeDailyFeatureUsage(stored, now);
  const current = stored as Partial<DailyFeatureUsage> | null;
  if (current?.date !== usage.date || current?.count !== usage.count) {
    setStorage(key, usage);
  }
  return usage;
}

function incrementDailyFeatureUsage(key: string, amount: number, now: Date = new Date()): number {
  const usage = getDailyFeatureUsage(key, now);
  const next = usage.count + Math.max(0, Math.floor(amount));
  setStorage(key, { ...usage, count: next });
  return next;
}

export function getFreeRecipeCreditsRemaining(now: Date = new Date()): number {
  return Math.max(0, FREE_DAILY_RECIPE_CREDITS - getDailyFeatureUsage(KEYS.FREE_RECIPE_USAGE, now).count);
}

export function canUseFreeRecipeGeneration(mealStyle: 'single' | 'set', now: Date = new Date()): boolean {
  return getFreeRecipeCreditsRemaining(now) >= getRecipeGenerationCost(mealStyle);
}

export function incrementFreeRecipeGeneration(mealStyle: 'single' | 'set', now: Date = new Date()): number {
  incrementDailyFeatureUsage(KEYS.FREE_RECIPE_USAGE, getRecipeGenerationCost(mealStyle), now);
  return getFreeRecipeCreditsRemaining(now);
}

export function getFreeReceiptScansRemaining(now: Date = new Date()): number {
  return Math.max(0, FREE_DAILY_RECEIPT_SCANS - getDailyFeatureUsage(KEYS.FREE_RECEIPT_USAGE, now).count);
}

export function incrementFreeReceiptScan(now: Date = new Date()): number {
  incrementDailyFeatureUsage(KEYS.FREE_RECEIPT_USAGE, 1, now);
  return getFreeReceiptScansRemaining(now);
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
  trayTheme: 'wood',
  shareGeneratedRecipes: true,
  ignoredForgottenIngredientIds: [],
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
  recipeFeedback?: LocalRecipeFeedback[];
  lastRecipeGeneration?: LastRecipeGeneration | null;
  recipeGenerationCache?: RecipeGenerationCacheEntry[];
  freeWeeklyPlanUsage?: FreeGenerationUsage;
  freeRecipeUsage?: DailyFeatureUsage;
  freeReceiptUsage?: DailyFeatureUsage;
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
    recipeFeedback: getLocalRecipeFeedbackList(),
    lastRecipeGeneration: getLocalLastRecipeGeneration(),
    recipeGenerationCache: getLocalRecipeGenerationCache(),
    freeWeeklyPlanUsage: getFreeGenerationUsage(),
    freeRecipeUsage: getDailyFeatureUsage(KEYS.FREE_RECIPE_USAGE),
    freeReceiptUsage: getDailyFeatureUsage(KEYS.FREE_RECEIPT_USAGE),
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
export function applyBackupPayload(data: unknown): void {
  if (typeof window === 'undefined') return;
  if (!data || typeof data !== 'object') return;

  const payload = data as Record<string, unknown>;

  if (Array.isArray(payload.inventory)) setStorage(KEYS.INVENTORY, payload.inventory);
  if (Array.isArray(payload.shopping)) setStorage(KEYS.SHOPPING, payload.shopping);
  if (Array.isArray(payload.savedRecipes)) setStorage(KEYS.SAVED_RECIPES, payload.savedRecipes);
  if (payload.stats && typeof payload.stats === 'object') setStorage(KEYS.STATS, payload.stats);
  if (payload.profile && typeof payload.profile === 'object') setStorage(KEYS.PROFILE, payload.profile);
  if (payload.climate && typeof payload.climate === 'object') setStorage(KEYS.CLIMATE, payload.climate);
  if (Array.isArray(payload.tips)) setStorage(KEYS.TIPS, payload.tips);
  if (Array.isArray(payload.weekPlan)) setStorage(KEYS.WEEK_PLAN, payload.weekPlan);
  if (Array.isArray(payload.recipeFeedback)) setStorage(KEYS.RECIPE_FEEDBACK, payload.recipeFeedback);
  if ('lastRecipeGeneration' in payload && (
    payload.lastRecipeGeneration === null || typeof payload.lastRecipeGeneration === 'object'
  )) {
    setStorage(KEYS.LAST_RECIPE_GENERATION, payload.lastRecipeGeneration);
  }
  if (Array.isArray(payload.recipeGenerationCache)) setStorage(KEYS.RECIPE_GENERATION_CACHE, payload.recipeGenerationCache);
  if (payload.freeWeeklyPlanUsage && typeof payload.freeWeeklyPlanUsage === 'object') {
    setStorage(KEYS.FREE_GENERATIONS_USED, payload.freeWeeklyPlanUsage);
  }
  if (payload.freeRecipeUsage && typeof payload.freeRecipeUsage === 'object') {
    setStorage(KEYS.FREE_RECIPE_USAGE, payload.freeRecipeUsage);
  }
  if (payload.freeReceiptUsage && typeof payload.freeReceiptUsage === 'object') {
    setStorage(KEYS.FREE_RECEIPT_USAGE, payload.freeReceiptUsage);
  }

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
    getLocalUserStats().total_cooked > 0 ||
    getLocalWeekPlan().length > 0 ||
    getLocalLastRecipeGeneration() !== null
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
  } catch (e: unknown) {
    console.error('Import error:', e);
    return { success: false, error: e instanceof Error ? e.message : '復元に失敗しました' };
  }
}
