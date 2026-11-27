// レシピの「方向性」設定。ユーザーは日本の家庭で料理する前提なので、既定では
// 日本の家庭料理として定着した味付けを土台にし、世界の料理への広がりは
// ユーザーが明示的に「冒険」を選んだときだけ許可する。
// UI(設定画面)とサーバー(プロンプト組み立て)の両方から使うため、サーバー専用の
// 依存は持たない。
import { RECIPE_GENRES } from './recipeQuality.ts';

export const RECIPE_STYLES = ['classic', 'balanced', 'adventurous'] as const;
export type RecipeStyle = typeof RECIPE_STYLES[number];

export const DEFAULT_RECIPE_STYLE: RecipeStyle = 'balanced';

export function normalizeRecipeStyle(value: unknown): RecipeStyle {
  return RECIPE_STYLES.includes(value as RecipeStyle) ? (value as RecipeStyle) : DEFAULT_RECIPE_STYLE;
}

// 日本の家庭の食卓に定着しているジャンル。「中華」「イタリアン」も本場ではなく
// 日本の家庭で作られている形(麻婆豆腐・ナポリタン等)を想定している。
const HOME_GENRES = ['和食', '洋食', '中華', '韓国料理', 'イタリアン'] as const;
// 「ちょいアレンジ」では、ガパオライスやルーロー飯のように日本の家庭でも
// 定着したアジアの料理までは許可する。
const BALANCED_EXTRA_GENRES = ['アジア料理', 'タイ料理', '台湾料理'] as const;

export function allowedGenresForStyle(style: RecipeStyle): string[] {
  if (style === 'adventurous') return [...RECIPE_GENRES];
  const genres: string[] = [...HOME_GENRES];
  if (style === 'balanced') genres.push(...BALANCED_EXTRA_GENRES);
  genres.push('その他');
  return genres;
}

/** 設定画面の「優先ジャンル」に出す選択肢(「その他」は選ぶ意味が薄いので除く)。 */
export function preferredGenreOptionsForStyle(style: RecipeStyle): string[] {
  return allowedGenresForStyle(style).filter((genre) => genre !== 'その他');
}

/** 方向性の範囲外になった優先ジャンルは保存値を残したまま、AIには渡さない。 */
export function filterGenresForStyle(genres: string[] | undefined, style: RecipeStyle): string[] {
  if (!Array.isArray(genres)) return [];
  const allowed = new Set(allowedGenresForStyle(style));
  return genres.filter((genre) => allowed.has(genre));
}

const STYLE_INSTRUCTIONS: Record<RecipeStyle, string> = {
  classic: `【最優先で厳守：レシピの方向性＝定番】
ユーザーは日本に住んでいて、日本の家庭で長く親しまれている定番料理を求めています。
・料理名を聞いただけで誰でも味が想像できる定番料理（例：豚の生姜焼き、肉じゃが、鶏の照り焼き、親子丼、ハンバーグ、ナポリタン、麻婆豆腐、回鍋肉、チヂミ、豚汁、ほうれん草のおひたし）から選んでください。
・味付けは下記の基本比率に忠実にしてください。創作的なアレンジ、複数の国の料理の融合、定番にない調味料の追加はしないでください。
・「ひと工夫」は不要です。定番の作り方を、失敗しにくい具体的な分量・下ごしらえ・火加減で丁寧に書くことに集中してください。`,
  balanced: `【最優先で厳守：レシピの方向性＝定番ベースのちょいアレンジ】
ユーザーは日本に住んでいて、日本の家庭の食卓になじむ料理を求めています。
・土台は日本の家庭で親しまれている定番料理と定番の味付け（醤油・みりん・酒の甘辛、味噌、ポン酢、めんつゆ、ケチャップ、コンソメ、オイスターソース、鶏がらスープ等）にしてください。
・アレンジは最大1つまでにしてください（例：仕上げにバターを落とす、柚子胡椒を添える、チーズをのせる、大葉を散らす）。日本の家庭で違和感のない範囲に留め、定番から大きく外さないでください。
・複数の国の料理を混ぜた無国籍な組み合わせや、酸味・甘味・香辛料を何重にも重ねた凝りすぎの味付けはしないでください。`,
  adventurous: `【レシピの方向性＝冒険】
ユーザーは日本に住んでいて、普段と違う世界の料理にも挑戦したいと考えています。世界各国の料理を提案して構いませんが、次を守ってください。
・日本のスーパーで手に入る食材・調味料で作れること。入手しにくいスパイスや食材を必須にしないでください。
・日本人の味覚に合うよう、塩味・辛味・香りの強さを調整してください。
・その料理の本場の基本の味付けは崩さず、根拠のない創作や国籍の違う料理の寄せ集めにしないでください。`,
};

// 家庭で定着している調味比率。モデルは日本の家庭料理の比率を外しがちなので、
// 和食・日本式の料理を作るときの基準として渡す。
const JAPANESE_HOME_RATIOS = `【参考：日本の家庭料理の基本の味付け（2人分の目安。人数に比例させる）】
・照り焼き・甘辛炒め：醤油・みりん・酒 各大さじ2、砂糖 小さじ1〜2
・豚の生姜焼き：豚肉200〜250gに醤油・みりん・酒 各大さじ1.5、おろし生姜 小さじ2
・煮物（肉じゃが等）：だし300ml、醤油・みりん 各大さじ2、砂糖・酒 各大さじ1
・丼のたれ（親子丼等）：だし100ml、醤油・みりん 各大さじ1.5、砂糖 小さじ1
・味噌汁：だし400mlに味噌 大さじ2弱
・甘酢：酢・砂糖 各大さじ2、醤油 大さじ1
・ごま和え：野菜150〜200gにすりごま 大さじ2、醤油・砂糖 各小さじ2
・きんぴら：醤油・みりん 各大さじ1、砂糖 小さじ1、ごま油 大さじ1/2
料理に合わせて微調整してよいですが、この比率から大きく外さないでください。`;

export function buildRecipeStyleSection(style: RecipeStyle): string {
  const ratioNote = style === 'adventurous'
    ? `\n和食・日本式の料理を作る場合は、次の比率を基準にしてください。\n${JAPANESE_HOME_RATIOS}`
    : `\n${JAPANESE_HOME_RATIOS}`;
  return `\n${STYLE_INSTRUCTIONS[style]}\n${ratioNote}\n`;
}

/** プロンプト末尾の「genreはこの中から選ぶ」指示。方向性に応じて候補を絞る。 */
export function buildGenreChoiceInstruction(style: RecipeStyle): string {
  return `genreは${allowedGenresForStyle(style).map((genre) => `「${genre}」`).join('')}から選んでください。`;
}
