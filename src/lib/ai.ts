import {
  GoogleGenAI,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from '@google/genai';
import { DIETARY_RESTRICTION_INSTRUCTIONS } from '@/lib/dietaryRules';

export { DIETARY_RESTRICTION_INSTRUCTIONS } from '@/lib/dietaryRules';

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const FAST_AI_MODEL = 'models/gemini-3.5-flash-lite';
export const QUALITY_AI_MODEL = 'models/gemini-3.5-flash';
export const DEFAULT_AI_MODELS = [FAST_AI_MODEL, QUALITY_AI_MODEL];

export type AiCallTelemetry = {
  model: string;
  durationMs: number;
  modelIndex: number;
  attempt: number;
  failedAttempts: Array<{
    model: string;
    durationMs: number;
    reason: string;
    retryable: boolean;
  }>;
};

const aiCallTelemetry = new WeakMap<object, AiCallTelemetry>();

export function getAiCallTelemetry(response: GenerateContentResponse): AiCallTelemetry | null {
  return aiCallTelemetry.get(response) || null;
}

const SEASONING_NOT_ASSUMED_SECTION = `\n【調味料・味付けの前提】\n塩・こしょうなどの基本的な調味料であっても「常備されている」とは仮定しないでください。レシピで使用する調味料は、ユーザーが指定した在庫食材に含まれているもの、または一般的にどの家庭にもある可能性が高い最小限のもの（塩・こしょう程度）に留め、それ以外の調味料を使う場合は必ず材料リストに明記してください。\n`;

// ユーザーが「調味料は常備している」を前提にするかどうかで文面を切り替える。
// falseの場合、常備調味料も通常の食材と同じくAIに明示させる。
export function buildSeasoningSection(
  assumeSeasoningsAvailable: boolean = true,
  dietaryRestrictions: string[] = [],
): string {
  if (!assumeSeasoningsAvailable) return SEASONING_NOT_ASSUMED_SECTION;

  const restricted = new Set(dietaryRestrictions);
  const seasonings = ['塩', 'こしょう', '砂糖', '酢', 'サラダ油', 'ケチャップ', 'にんにく', 'しょうが'];
  if (!restricted.has('大豆不使用')) {
    seasonings.push(restricted.has('グルテンフリー') ? 'グルテンフリー醤油・小麦不使用の味噌' : '醤油・味噌');
  }
  // ごまは種子でありナッツではない。個別に除外指定された場合は生成後の
  // 除外食材検証が止めるため、ナッツ不使用だけを理由には外さない。
  seasonings.push('ごま油');
  if (!restricted.has('アルコール不可') && !restricted.has('ハラール（イスラム教）')) {
    seasonings.push('みりん・料理酒');
  }
  if (!restricted.has('ヴィーガン') && !restricted.has('乳製品不使用') && !restricted.has('コーシャ（ユダヤ教）')) {
    seasonings.push('バター');
  }
  if (!restricted.has('ヴィーガン') && !restricted.has('卵不使用')) {
    seasonings.push('マヨネーズ');
  } else {
    seasonings.push('卵不使用マヨネーズ');
  }
  if (restricted.has('ヴィーガン') || restricted.has('ベジタリアン')) {
    seasonings.push('昆布だし・野菜だし');
  } else if (!restricted.has('魚介類不使用')) {
    seasonings.push('和風だし');
  }

  return `\n【調味料・味付けの前提】\n${seasonings.join('・')}は「常備されている」前提で使用できます。食事制限で禁止される通常品や動物性のだし・エキスへ置き換えないでください。使用する調味料は少量でも必ず材料リストに明記してください。\n`;
}

export const DISH_LOAD_INSTRUCTION = `【洗い物量の見積もり】各レシピについて、使用する鍋・フライパン・ボウル・まな板など「洗う必要のある調理器具・食器の点数」を見積もり、"dish_badge"に文字だけの短いタグで示してください（例：「洗い物少なめ（2点）」「洗い物やや多め（5点）」）。絵文字や装飾記号は含めないでください。ワンパン・電子レンジのみ・ボウル1つ等で完結する場合は積極的に「少なめ」と評価してください。`;

// 「味を濃くする = 塩分を増やす」にならないよう、味の輪郭を旨味・酸味・香り・
// 食感まで含めて組み立てる。最後に少量ずつ調整する手順も必須にし、家庭での
// 再現性とおいしさを両立する。
export const FLAVOR_INTENSITY_INSTRUCTION = `\n【最優先で厳守：味の設計】一口目から味の輪郭が分かる家庭料理にしてください。ただし、塩・醤油・味噌を単純に増やして濃くするのは禁止です。主となる塩味・旨味を1つ決め、酸味または自然な甘味、にんにく・しょうが・香辛料・ハーブ等の香り、食感の対比を料理に合う範囲で重ねてください。調味料は人数に合わせた再現可能な数値で示し、仕上げ前に味見して、塩味は小さじ1/8程度ずつ、酸味や香りも少量ずつ調整する手順またはコツを含めてください。ユーザーが「うす味・減塩」等を指定した場合はそれを最優先し、香り・酸味・旨味で満足感を補ってください。\n`;

export type FlavorFeedbackSummary = {
  recipeTitle: string;
  tags: string[];
  wouldCookAgain?: boolean;
};

export type RecipeProfile = {
  tastePreferences?: string[];
  excludedIngredients?: string[];
  allergies?: string[];
  cookingStyles?: string[];
  servings?: number;
  targetCalories?: number | null;
  targetProtein?: number | null;
  assumeSeasoningsAvailable?: boolean;
  dietaryRestrictions?: string[];
  preferredGenres?: string[];
  flavorFeedback?: FlavorFeedbackSummary[];
};

// レシピ生成画面の「テンプレート」ボタンは、単なる参考キーワードではなく
// AIが必ず遵守すべき絶対条件として扱う。特に「スイーツ」「鍋・スープ」は
// 料理カテゴリそのものを固定する指定なので、他カテゴリの提案を明確に禁止する。
// (この文言と対応する機械的な検証は src/lib/recipeValidation.ts の
// TEMPLATE_CATEGORY_CHECKS を参照。両方を変更する際は一緒に見直すこと。)
export const RECIPE_TEMPLATE_CONSTRAINTS: Record<string, string> = {
  bento: "【絶対条件】お弁当に入れることを前提に、冷めても美味しく汁気の出にくいおかずだけを提案してください。汁気の多い煮物やスープ等、お弁当に不向きな料理は絶対に提案しないでください。",
  meaty: "【絶対条件】ご飯が進むボリューミーな肉料理だけを提案してください。野菜が主役の料理や、肉を使わない料理は絶対に提案しないでください。",
  healthy: "【絶対条件】野菜をたっぷり使った高タンパク・低カロリーなヘルシー料理だけを提案してください。揚げ物や過度に高カロリーな料理は絶対に提案しないでください。",
  soup: "【絶対条件：料理カテゴリ】ユーザーは「鍋・スープ」を明示的に指定しました。生成するレシピは必ず鍋物、またはスープ・汁物として成立するものにしてください。炒め物・丼物・単純な焼き物・サラダなど、鍋・スープに該当しない料理を提案することは絶対に禁止です。",
  sweets: "【絶対条件：料理カテゴリ】ユーザーは「スイーツ」を明示的に指定しました。生成するレシピは必ずデザート・お菓子として成立するものにしてください。主菜・副菜・鍋物・スープなど、スイーツに該当しない料理を提案することは絶対に禁止です。",
  easyClean: "【絶対条件】使う鍋・フライパン・ボウル・皿の数が最小限になり、洗い物が少なく済む料理だけを提案してください。複数の調理器具や皿を要する手間のかかる料理は絶対に提案しないでください。",
};

// テンプレート指定は「参考にする」ものではなく「必ず守る生成条件」として、
// 他のセクションより優先度の高い位置(冒頭の厳守事項)に差し込む。
export function buildTemplateConstraintSection(templateKey: string | null | undefined): string {
  const instruction = templateKey ? RECIPE_TEMPLATE_CONSTRAINTS[templateKey] : null;
  if (!instruction) return "";
  return `\n【テンプレート指定(必ず遵守してください。参考情報ではなく絶対条件です)】\n${instruction}\n`;
}

export type ClimateInfo = {
  condition?: string;
  temperature?: number;
  timeOfDay?: string;
  advice?: string;
};

export type Language = 'ja' | 'en';

// UIの選択言語をAIの出力言語に反映するセクション。
// "genre"だけは在庫アイコン・フィルター等の内部分類キーとして日本語の固定リストを
// そのまま使い続ける必要があるため、翻訳対象から明示的に除外する。
export function buildLanguageSection(language: Language = 'ja'): string {
  if (language !== 'en') return '';
  return `\n【出力言語（最重要）】\nJSON内の"title"、"ingredients"（"name"・"amount"とも）、"steps"、"tips"、"climate_badge"、"dish_badge"、"cooking_tips"（"category"・"tip"とも）は、すべて自然で読みやすい英語（English）で出力してください。ただし"genre"の値だけは翻訳せず、後述の日本語の選択肢リストの中からそのまま日本語表記で選んでください（内部的な分類キーとして使用するため）。\n`;
}

// ユーザープロファイル（マイ一括設定）セクションを組み立てる
export function buildProfileSection(profile: RecipeProfile | null | undefined): string {
  if (!profile) return '';
  const taste = profile.tastePreferences && profile.tastePreferences.length > 0
    ? `・味の好み/栄養方針: ${profile.tastePreferences.join('、')}\n`
    : '';
  const excludedItems = [...new Set([...(profile.excludedIngredients || []), ...(profile.allergies || [])])];
  const excluded = excludedItems.length > 0
    ? `・【絶対除外（アレルギー・苦手）】: ${excludedItems.join('、')} ※表記・言語が違う同一食材、だし、エキス、加工品も含めて絶対に提案レシピに含めないでください！\n`
    : '';
  const dietary = profile.dietaryRestrictions && profile.dietaryRestrictions.length > 0
    ? `・【絶対厳守（食事制限・宗教上の理由）】: ${profile.dietaryRestrictions
        .map(r => `${r}（${DIETARY_RESTRICTION_INSTRUCTIONS[r] || ''}）`)
        .join('、')} ※これらの制約に違反する食材・調味料は絶対に提案レシピに含めないでください！\n`
    : '';
  const styles = profile.cookingStyles && profile.cookingStyles.length > 0
    ? `・調理スタイル/設備: ${profile.cookingStyles.join('、')}\n`
    : '';
  // 食事制限とは異なり「絶対」ではなく、できる範囲で優先してほしいという
  // やわらかい希望として伝える（他ジャンルを完全に排除する必要はない）
  const preferredGenre = profile.preferredGenres && profile.preferredGenres.length > 0
    ? `・優先したい料理ジャンル: ${profile.preferredGenres.join('、')} ※必須ではありませんが、できるだけこれらのジャンルから提案してください\n`
    : '';
  const nutritionGoals = [
    typeof profile.targetCalories === 'number' && profile.targetCalories > 0
      ? `1日${Math.round(profile.targetCalories)}kcal（1食は約${Math.round(profile.targetCalories / 3)}kcalを目安）`
      : null,
    typeof profile.targetProtein === 'number' && profile.targetProtein > 0
      ? `1日たんぱく質${Math.round(profile.targetProtein)}g（1食は約${Math.round(profile.targetProtein / 3)}gを目安）`
      : null,
  ].filter(Boolean);
  const nutrition = nutritionGoals.length > 0
    ? `・栄養目標: ${nutritionGoals.join('、')}\n`
    : '';
  const feedback = profile.flavorFeedback && profile.flavorFeedback.length > 0
    ? `・直近の実食フィードバック: ${profile.flavorFeedback
        .slice(0, 12)
        .map(item => `${item.recipeTitle}=[${item.tags.join('、')}]${item.wouldCookAgain ? '（また作りたい）' : ''}`)
        .join(' / ')}\n  「薄い」は塩だけを増やさず旨味・香り・酸味を先に補い、「塩辛い」は塩分、「甘すぎる」は糖分、「重い」は油脂を控えてください。「おいしい」「また作りたい」の味の系統は、新しい料理にも応用してください。\n`
    : '';
  if (!taste && !excluded && !dietary && !styles && !preferredGenre && !nutrition && !feedback) return '';
  return `\n【ユーザーのマイ設定（クッキングプロファイル）】\n${taste}${excluded}${dietary}${styles}${preferredGenre}${nutrition}${feedback}`;
}

// 気候・環境連動セクションを組み立てる
export function buildClimateSection(climate: ClimateInfo | null | undefined): string {
  if (!climate) return '';
  const cond = climate.condition || '通常';
  const temp = climate.temperature !== undefined ? `${climate.temperature}℃` : '';
  const tod = climate.timeOfDay || '';
  const advice = climate.advice || '';
  return `\n【現在の気候・気温・時間帯（最重要：身体の状態に合わせてレシピを最適化してください）】
・気候/天気: ${cond} (${temp})
・時間帯: ${tod}
・気候アドバイス方針: ${advice}
※ 気候や気温に合わせた調理法（例：猛暑ならさっぱり冷製・酸味・水分ミネラル補給、寒い日ならあったかスープや生姜、夜遅い時間なら消化の良いヘルシーメニュー等）を自然に取り入れてください。ただし「酸味」を加える手段は梅干しに限らず、酢の物・レモンや柑橘・トマト・ヨーグルト・ピクルスなど料理のジャンルに合わせて多様な選択肢から選び、同じ食材ばかりに偏らないようにしてください。\n`;
}

export async function generateWithRetry(
  aiInstance: GoogleGenAI,
  config: Omit<GenerateContentParameters, 'model'>,
  models: string[] = DEFAULT_AI_MODELS,
  maxRetries = 3
): Promise<GenerateContentResponse> {
  const callStartedAt = Date.now();
  const failedAttempts: AiCallTelemetry['failedAttempts'] = [];
  for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
    const model = models[modelIndex];
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const attemptStartedAt = Date.now();
      try {
        const response = await aiInstance.models.generateContent({ ...config, model });
        const telemetry: AiCallTelemetry = {
          model,
          durationMs: Date.now() - callStartedAt,
          modelIndex,
          attempt: attempt + 1,
          failedAttempts: [...failedAttempts],
        };
        aiCallTelemetry.set(response, telemetry);
        console.info('[AI_CALL]', JSON.stringify({
          outcome: 'success',
          ...telemetry,
          failedAttempts: telemetry.failedAttempts.length,
        }));
        return response;
      } catch (err: unknown) {
        const details = typeof err === 'object' && err !== null
          ? err as { status?: unknown; httpStatusCode?: unknown; code?: unknown; message?: unknown }
          : {};
        const status = details.status ?? details.httpStatusCode;
        const code = details.code;
        const reason = status ?? code ?? details.message ?? 'unknown error';
        const retryable = status === 503 || status === 429 || code === 'UNAVAILABLE' || code === 'RESOURCE_EXHAUSTED';
        failedAttempts.push({
          model,
          durationMs: Date.now() - attemptStartedAt,
          reason: String(reason).slice(0, 160),
          retryable,
        });
        if (retryable) {
          if (attempt < maxRetries - 1) {
            const delay = Math.pow(2, attempt) * 1000;
            console.warn(`Model ${model} attempt ${attempt + 1} failed (${String(reason)}), retrying in ${delay}ms...`);
            await new Promise((r) => setTimeout(r, delay));
          } else {
            console.warn(`All retries exhausted for model ${model}, trying next model...`);
          }
        } else {
          // リトライ対象外(不正なパラメータ・非対応モデル等)のエラーでも、
          // フォールバック配列に他のモデルが残っていれば試す価値があるため
          // (例: 世代の異なるモデルを混在させた際、片方だけthinkingConfig等の
          // パラメータを受け付けない、といったモデル固有の非互換を吸収する)、
          // ここでは即座に諦めず次のモデルに進む。全モデルを使い切った時だけ
          // 最終的にエラーを投げる。
          console.warn(`Model ${model} failed with non-retryable error (${String(reason)}), trying next model...`);
          break;
        }
      }
    }
  }
  console.error('[AI_CALL]', JSON.stringify({
    outcome: 'failed',
    durationMs: Date.now() - callStartedAt,
    failedAttempts,
  }));
  throw new Error('すべてのAIモデルが一時的に利用不可です。しばらく時間をおいてお試しください。');
}
