import { NextResponse } from 'next/server';
import { ThinkingLevel } from '@google/genai';
import {
  ai,
  generateWithRetry,
  FAST_AI_MODEL,
  QUALITY_AI_MODEL,
  buildProfileSection,
  buildClimateSection,
  buildSeasoningSection,
  buildLanguageSection,
  DISH_LOAD_INSTRUCTION,
  FLAVOR_INTENSITY_INSTRUCTION,
  RecipeProfile,
  Language,
} from '@/lib/ai';
import { validateRecipeShape, validateRecipeLogic, buildValidationRetryNote, ValidatedRecipe, FeasibilityContext } from '@/lib/recipeValidation';
import { parseAiJson } from '@/lib/aiJson';
import { validateDietaryRestrictions, validateExcludedIngredients } from '@/lib/dietaryRules';
import {
  qualityGateErrors,
  sanitizeServings,
  validateWeeklyPlan,
  WeeklyRecipe,
  WeeklySlot,
} from '@/lib/recipeQuality';

const SLOT_LABEL: Record<string, string> = { lunch: '昼', dinner: '夜' };
const WEEKDAY_LABEL = ['日', '月', '火', '水', '木', '金', '土'];
const WEEKLY_PLAN_MODEL_ORDER = [
  [FAST_AI_MODEL, QUALITY_AI_MODEL],
  [QUALITY_AI_MODEL, FAST_AI_MODEL],
] as const;
const MAX_VALIDATION_ATTEMPTS = WEEKLY_PLAN_MODEL_ORDER.length;

// 厚生労働省「日本人の食事摂取基準」の目安（たんぱく質エネルギー比13〜20%中央値15%、脂質20〜30%中央値25%、
// 炭水化物は残り約60%）を用いて、目標値未設定時のデフォルトPFCを算出する。
// 1日3食を基準に、依頼された食事枠1件あたりの目安値として按分する。
function computeDailyTargets(profile: RecipeProfile | null | undefined) {
  const rawCalories = Number(profile?.targetCalories);
  const dailyCalories = rawCalories > 0 ? rawCalories : 2000;
  const rawProtein = Number(profile?.targetProtein);
  const dailyProtein = rawProtein > 0 ? rawProtein : Math.round((dailyCalories * 0.15) / 4);
  const dailyFat = Math.round((dailyCalories * 0.25) / 9);
  const dailyCarbs = Math.round((dailyCalories * 0.60) / 4);
  return { dailyCalories, dailyProtein, dailyFat, dailyCarbs };
}

export async function POST(req: Request) {
  let language: Language = 'ja';
  try {
    const body = await req.json();
    const {
      slots = [],
      ingredients = [],
      pinnedIngredients = [],
      userProfile,
      profile,
      climate,
      recentHistory,
      mode,
    } = body;
    language = body.language === 'en' ? 'en' : 'ja';

    if (!Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json({
        error: language === 'en'
          ? 'Please select at least one day and meal slot to generate a plan for'
          : '献立を生成する日付・食事枠が指定されていません',
      }, { status: 400 });
    }

    const requestedSlots: WeeklySlot[] = slots
      .filter((slot): slot is { date: string; mealSlot: 'lunch' | 'dinner' } =>
        Boolean(slot)
        && typeof slot.date === 'string'
        && /^\d{4}-\d{2}-\d{2}$/.test(slot.date)
        && (slot.mealSlot === 'lunch' || slot.mealSlot === 'dinner'))
      .map((slot) => ({ date: slot.date, mealSlot: slot.mealSlot }));
    if (requestedSlots.length !== slots.length || new Set(requestedSlots.map((slot) => `${slot.date}:${slot.mealSlot}`)).size !== requestedSlots.length) {
      return NextResponse.json({
        error: language === 'en'
          ? 'The requested meal slots are invalid or duplicated.'
          : '献立の日付・食事枠に不正または重複があります。',
      }, { status: 400 });
    }

    const actualProfile = userProfile || profile;
    const isFreeMode = mode === 'free' || !ingredients || ingredients.length === 0;

    const ingredientsSection = isFreeMode
      ? `【作成方針】\n冷蔵庫の在庫に縛られず、自由でおいしく栄養バランスの良いレシピを提案してください。\n`
      : `【現在の在庫食材】\n${ingredients.join(', ')}\n※ 在庫食材は特に日付の早いレシピで優先的に使用し、無駄なく使い切れるようにしてください。\n`;

    const pinnedSection = !isFreeMode && pinnedIngredients && pinnedIngredients.length > 0
      ? `\n【ピン留め食材（これらを必ずどこかのレシピで使用してください！）】\n${pinnedIngredients.join(', ')}\n`
      : '';

    const climateSection = buildClimateSection(climate);
    const profileSection = buildProfileSection(actualProfile);
    const dietaryRestrictions: string[] = Array.isArray(actualProfile?.dietaryRestrictions) ? actualProfile.dietaryRestrictions : [];
    const excludedIngredients: string[] = [...new Set([
      ...(Array.isArray(actualProfile?.excludedIngredients) ? actualProfile.excludedIngredients : []),
      ...(Array.isArray(actualProfile?.allergies) ? actualProfile.allergies : []),
    ])];
    if (Array.isArray(pinnedIngredients) && pinnedIngredients.length > 0) {
      const pinnedContent = { ingredients: pinnedIngredients.map((name: string) => ({ name, amount: '' })) };
      const pinnedViolations = [
        ...validateDietaryRestrictions(pinnedContent, dietaryRestrictions),
        ...validateExcludedIngredients(pinnedContent, excludedIngredients),
      ];
      if (pinnedViolations.length > 0) {
        return NextResponse.json({
          error: language === 'en'
            ? 'A pinned ingredient conflicts with your dietary restrictions or excluded ingredients.'
            : 'ピン留め食材に、食事制限または除外食材と両立しないものが含まれています。',
        }, { status: 400 });
      }
    }
    const seasoningSection = buildSeasoningSection(
      actualProfile?.assumeSeasoningsAvailable !== false,
      dietaryRestrictions,
    );

    const targetServings = sanitizeServings(actualProfile?.servings, 2);
    const servingsSection = `\n【分量指定】\nすべてのレシピの材料・分量は ${targetServings}人分 で記載してください。\n`;

    const historyNote = Array.isArray(recentHistory) && recentHistory.length > 0
      ? `\n【直近の料理履歴（マンネリ防止のため、これらと異なる料理を提案してください）】\n${recentHistory.join('、')}\n`
      : '';

    const { dailyCalories, dailyProtein, dailyFat, dailyCarbs } = computeDailyTargets(actualProfile);
    const perMealCalories = Math.round(dailyCalories / 3);
    const perMealProtein = Math.round(dailyProtein / 3);
    const perMealFat = Math.round(dailyFat / 3);
    const perMealCarbs = Math.round(dailyCarbs / 3);
    const weeklyCalories = perMealCalories * requestedSlots.length;
    const weeklyProtein = perMealProtein * requestedSlots.length;
    const weeklyFat = perMealFat * requestedSlots.length;
    const weeklyCarbs = perMealCarbs * requestedSlots.length;

    const slotLines = requestedSlots.map((s) => {
      const d = new Date(s.date);
      const weekday = WEEKDAY_LABEL[d.getDay()];
      const slotLabel = SLOT_LABEL[s.mealSlot] || s.mealSlot;
      return `- ${s.date}(${weekday}) ${slotLabel}`;
    }).join('\n');

    const pfcSection = `\n【週間PFCバランス目標（最重要）】
1食あたりの目安: カロリー約${perMealCalories}kcal、タンパク質約${perMealProtein}g、脂質約${perMealFat}g、炭水化物約${perMealCarbs}g
今回生成する${requestedSlots.length}食の合計目安: カロリー約${weeklyCalories}kcal、タンパク質約${weeklyProtein}g、脂質約${weeklyFat}g、炭水化物約${weeklyCarbs}g
※ 個々のレシピは目安から前後してよいですが、指定された全レシピの栄養価の合計が、この週間合計目安のプラスマイナス15%程度に収まるように、各食の分量・内容を調整してください。夕食はやや多め、昼食はやや控えめ、など常識的な配分は問題ありません。\n`;
    const languageSection = buildLanguageSection(language);

    const prompt = `あなたは経験豊富なプロの管理栄養士兼シェフです。以下の日付・食事枠それぞれに1品ずつ、家庭で再現できる料理を提案し、1週間を通してPFCバランスの取れた献立プランを組んでください。

【生成が必要な日付・食事枠一覧（合計${requestedSlots.length}件）】
${slotLines}

${ingredientsSection}
${seasoningSection}${FLAVOR_INTENSITY_INSTRUCTION}${pinnedSection}${climateSection}${profileSection}${servingsSection}${historyNote}${pfcSection}${languageSection}
【重要・厳守事項】
1. 上記の日付・食事枠それぞれに必ず1品ずつ、過不足なくレシピを割り当ててください。
2. 同じ主菜・主要食材（例:鶏肉料理が連日続く等）が連続しないよう、1週間を通して献立にバリエーションを持たせてください。
3. ピン留め食材がある場合、1週間のどこかのレシピで必ず使用してください。
4. 気候や気温に合った最適な温度感・味付けを取り入れてください。
5. 【絶対除外食材】が指定されている場合は、該当食材やその類縁食材を一切使用しないでください。
6. 【栄養バランス】各レシピでPFCバランスを計算し、1人分あたりの推定栄養価を算出してください。
7. 【手順の具体性】各ステップには温度・火加減・時間・視覚的なキューを含めてください。
8. ${DISH_LOAD_INSTRUCTION}
9. 【提出前の自己監査】各材料が手順内で使われているか、分量・所要時間・PFCとcaloriesが矛盾していないかを確認してください。鶏肉・豚肉・ひき肉・内臓は中心75℃で1分以上または同等に十分加熱する指示を含め、味は塩分だけでなく旨味・酸味・香り・食感の組み合わせを確認してください。
10. 以下のJSON構造で、"plan"配列の中に上記の食事枠と同じ件数だけレシピデータを格納して返してください。"date"と"meal_slot"は依頼された値と完全に一致させてください（meal_slotは"lunch"または"dinner"）。これ以外のテキストは一切含めないでください。
{
  "plan": [
    {
      "date": "2026-09-02",
      "meal_slot": "dinner",
      "title": "料理名",
      "time": "調理時間目安（例：15分）",
      "genre": "和食",
      "dish_badge": "洗い物少なめ（2点）",
      "ingredients": [
        { "name": "使用する具材または調味料", "amount": "分量の目安" }
      ],
      "steps": ["手順1", "手順2", "手順3..."],
      "tips": "調理のコツ・アドバイス",
      "nutrition": { "calories": 420, "protein_g": 28, "fat_g": 14, "carbs_g": 35 }
    }
  ]
}
genreは「和食」「洋食」「中華」「アジア料理」「韓国料理」「タイ料理」「インド料理」「メキシコ料理」「中東料理」「イタリアン」「フレンチ」「スペイン料理」「ギリシャ料理」「ドイツ・中欧料理」「北欧料理」「ロシア・東欧料理」「ベトナム料理」「台湾料理」「インドネシア・マレーシア料理」「アメリカ南部料理」「モロッコ・北アフリカ料理」「エチオピア料理」「ジャマイカ・カリブ料理」「ペルー料理」「ブラジル料理」「シンガポール料理」「その他」から選んでください。${language === 'en' ? '（genreの値は必ずこの日本語表記のまま出力し、翻訳しないでください）' : ''}`;

    // 生成後の検証(要件10): JSON構造 + 食事制限・アレルギー違反の論理検証。
    // 週間献立は「在庫だけで完成させる」ことを強制していないため(在庫は優先的に
    // 使う程度の位置づけ)、在庫限定チェックとテンプレートのカテゴリチェックは
    // ここでは適用しない(単発レシピ生成/api/recipesとの差)。
    const feasibilityContext: FeasibilityContext = {
      mode: 'free',
      inventoryNames: [],
      assumeSeasoningsAvailable: actualProfile?.assumeSeasoningsAvailable !== false,
      dietaryRestrictions,
      excludedIngredients,
      templateKey: null,
    };

    let lastErrors: string[] = [];
    for (let attempt = 0; attempt < MAX_VALIDATION_ATTEMPTS; attempt++) {
      const attemptPrompt = attempt === 0 ? prompt : `${prompt}\n${buildValidationRetryNote(lastErrors)}`;

      const models = [...WEEKLY_PLAN_MODEL_ORDER[attempt]];
      const thinkingLevel = attempt === 0 ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW;
      const response = await generateWithRetry(ai, {
        contents: [{ role: 'user', parts: [{ text: attemptPrompt }] }],
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel },
        }
      }, models, 2);

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || response.text || '';
      if (!text) throw new Error('AI output was empty');

      let json: Record<string, unknown>;
      try {
        json = parseAiJson<Record<string, unknown>>(text);
      } catch (parseError) {
        lastErrors = [
          `response was not valid JSON: ${parseError instanceof Error ? parseError.message : 'unknown parse error'}`,
        ];
        continue;
      }
      const planArray: unknown[] = Array.isArray(json.plan) ? json.plan : [];

      const shapeErrors = planArray.length > 0
        ? planArray.flatMap((item, i) => {
            const errs = validateRecipeShape(item, `plan[${i}]`);
            const entry = item as Record<string, unknown>;
            if (typeof entry?.date !== 'string' || !entry.date) errs.push(`plan[${i}].date is missing`);
            if (entry?.meal_slot !== 'lunch' && entry?.meal_slot !== 'dinner') {
              errs.push(`plan[${i}].meal_slot must be "lunch" or "dinner"`);
            }
            return errs;
          })
        : ['plan must be a non-empty array'];

      if (shapeErrors.length > 0) {
        lastErrors = shapeErrors;
        continue;
      }

      const logicErrors = (planArray as ValidatedRecipe[]).flatMap((item) => validateRecipeLogic(item, feasibilityContext));
      logicErrors.push(...(planArray as ValidatedRecipe[]).flatMap((item, index) =>
        qualityGateErrors(item, {
          servings: targetServings,
          targetCaloriesPerServing: perMealCalories,
          targetProteinPerServing: perMealProtein,
        }, `plan[${index}]`)
      ));
      logicErrors.push(...validateWeeklyPlan(
        planArray as WeeklyRecipe[],
        requestedSlots,
        Array.isArray(pinnedIngredients) ? pinnedIngredients : [],
        { calories: weeklyCalories, protein_g: weeklyProtein, fat_g: weeklyFat, carbs_g: weeklyCarbs },
      ));
      if (logicErrors.length > 0) {
        lastErrors = logicErrors;
        continue;
      }

      return NextResponse.json({
        ...json,
        weeklyTargets: { calories: weeklyCalories, protein_g: weeklyProtein, fat_g: weeklyFat, carbs_g: weeklyCarbs },
      });
    }

    console.error('Weekly plan validation failed after retries:', lastErrors);
    return NextResponse.json({
      error: language === 'en'
        ? 'The AI could not produce a plan that satisfies your conditions after multiple attempts. Please try again.'
        : '条件を満たす献立をAIが生成できませんでした。もう一度お試しください。',
    }, { status: 422 });

  } catch (error: unknown) {
    console.error('Weekly Plan Gen Error:', error);
    const details = typeof error === 'object' && error !== null
      ? error as { status?: unknown; httpStatusCode?: unknown; code?: unknown }
      : {};
    const status = details.status || details.httpStatusCode || details.code;
    const message = error instanceof Error ? error.message : String(error);
    if (status === 429 || status === 503 || status === 'UNAVAILABLE') {
      return NextResponse.json({
        error: language === 'en'
          ? 'The AI model is temporarily busy. Please try again in a moment.'
          : 'AIモデルが一時的に混雑しています。しばらく時間をおいてから再度お試しください。',
      }, { status: 503 });
    }
    return NextResponse.json({
      error: language === 'en'
        ? `Failed to generate weekly plan: ${message}`
        : `週間献立の生成に失敗しました: ${message}`,
    }, { status: 500 });
  }
}
