import { GoogleGenAI } from '@google/genai';

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const DEFAULT_AI_MODELS = ['models/gemini-2.5-flash', 'models/gemini-3.5-flash'];

const SEASONING_ASSUMED_SECTION = `\n【調味料・味付けの前提】\n塩・こしょう・砂糖・醤油・味噌・みりん・酒・酢・サラダ油・ごま油・バター・だし（顆粒和風だし/コンソメ/鶏がらスープの素）・ケチャップ・マヨネーズ・にんにく・しょうがなどの基本的な調味料は「常備されている」前提で自由に使用してください。\n`;

const SEASONING_NOT_ASSUMED_SECTION = `\n【調味料・味付けの前提】\n塩・こしょうなどの基本的な調味料であっても「常備されている」とは仮定しないでください。レシピで使用する調味料は、ユーザーが指定した在庫食材に含まれているもの、または一般的にどの家庭にもある可能性が高い最小限のもの（塩・こしょう程度）に留め、それ以外の調味料を使う場合は必ず材料リストに明記してください。\n`;

// ユーザーが「調味料は常備している」を前提にするかどうかで文面を切り替える。
// falseの場合、常備調味料も通常の食材と同じくAIに明示させる。
export function buildSeasoningSection(assumeSeasoningsAvailable: boolean = true): string {
  return assumeSeasoningsAvailable ? SEASONING_ASSUMED_SECTION : SEASONING_NOT_ASSUMED_SECTION;
}

export const DISH_LOAD_INSTRUCTION = `【洗い物量の見積もり】各レシピについて、使用する鍋・フライパン・ボウル・まな板など「洗う必要のある調理器具・食器の点数」を見積もり、"dish_badge"に短いタグで示してください（例：「🍽️ 洗い物少なめ（2点）」「🍽️ 洗い物やや多め（5点）」）。ワンパン・電子レンジのみ・ボウル1つ等で完結する場合は積極的に「少なめ」と評価してください。`;

export type RecipeProfile = {
  tastePreferences?: string[];
  excludedIngredients?: string[];
  cookingStyles?: string[];
  servings?: number;
  targetCalories?: number | null;
  targetProtein?: number | null;
  assumeSeasoningsAvailable?: boolean;
};

export type ClimateInfo = {
  condition?: string;
  temperature?: number;
  timeOfDay?: string;
  advice?: string;
};

// ユーザープロファイル（マイ一括設定）セクションを組み立てる
export function buildProfileSection(profile: RecipeProfile | null | undefined): string {
  if (!profile) return '';
  const taste = profile.tastePreferences && profile.tastePreferences.length > 0
    ? `・味の好み/栄養方針: ${profile.tastePreferences.join('、')}\n`
    : '';
  const excluded = profile.excludedIngredients && profile.excludedIngredients.length > 0
    ? `・【絶対除外（アレルギー・苦手）】: ${profile.excludedIngredients.join('、')} ※これらの食材は絶対に提案レシピに含めないでください！\n`
    : '';
  const styles = profile.cookingStyles && profile.cookingStyles.length > 0
    ? `・調理スタイル/設備: ${profile.cookingStyles.join('、')}\n`
    : '';
  if (!taste && !excluded && !styles) return '';
  return `\n【ユーザーのマイ設定（クッキングプロファイル）】\n${taste}${excluded}${styles}`;
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
※ 気候や気温に合わせた調理法（例：猛暑ならさっぱり冷製・酸味・水分ミネラル補給、寒い日ならあったかスープや生姜、夜遅い時間なら消化の良いヘルシーメニュー等）を自然に取り入れてください。\n`;
}

export async function generateWithRetry(
  aiInstance: any,
  config: any,
  models: string[] = DEFAULT_AI_MODELS,
  maxRetries = 3
): Promise<any> {
  for (const model of models) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await aiInstance.models.generateContent({ ...config, model });
        return response;
      } catch (err: any) {
        const status = err?.status ?? err?.httpStatusCode;
        const code = err?.code;
        const retryable = status === 503 || status === 429 || code === 'UNAVAILABLE' || code === 'RESOURCE_EXHAUSTED';
        if (retryable) {
          if (attempt < maxRetries - 1) {
            const delay = Math.pow(2, attempt) * 1000;
            console.warn(`Model ${model} attempt ${attempt + 1} failed (${status || code}), retrying in ${delay}ms...`);
            await new Promise((r) => setTimeout(r, delay));
          } else {
            console.warn(`All retries exhausted for model ${model}, trying next model...`);
          }
        } else {
          throw err;
        }
      }
    }
  }
  throw new Error('すべてのAIモデルが一時的に利用不可です。しばらく時間をおいてお試しください。');
}
