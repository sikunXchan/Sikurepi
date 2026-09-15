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
  reconcileRecipeTime,
  sanitizeServings,
  validateWeeklyPlan,
  WeeklyRecipe,
  WeeklySlot,
} from '@/lib/recipeQuality';
import { buildIngredientUnitInstruction } from '@/lib/ingredientUnits';

const SLOT_LABEL: Record<string, string> = { lunch: '昼', dinner: '夜' };
const WEEKDAY_LABEL = ['日', '月', '火', '水', '木', '金', '土'];
const WEEKLY_PLAN_MODEL_ORDER = [
  [FAST_AI_MODEL, QUALITY_AI_MODEL],
  [QUALITY_AI_MODEL, FAST_AI_MODEL],
  [FAST_AI_MODEL, QUALITY_AI_MODEL],
  [QUALITY_AI_MODEL, FAST_AI_MODEL],
] as const;
const MAX_VALIDATION_ATTEMPTS = WEEKLY_PLAN_MODEL_ORDER.length;

function slotKey(entry: { date?: unknown; meal_slot?: unknown }): string {
  return `${String(entry.date || '')}:${String(entry.meal_slot || '')}`;
}

function repairIndicesFromErrors(errors: string[], planLength: number): number[] {
  const indices = new Set<number>();
  let needsFullPlanRepair = false;
  let hasNutritionTotalError = false;

  for (const error of errors) {
    const match = error.match(/^plan\[(\d+)\]/);
    if (!match) {
      if (/^weekly (calories|protein_g|fat_g|carbs_g) total/.test(error)) {
        hasNutritionTotalError = true;
      } else {
        needsFullPlanRepair = true;
      }
      continue;
    }
    const index = Number(match[1]);
    if (Number.isInteger(index) && index >= 0 && index < planLength) indices.add(index);
  }

  if (needsFullPlanRepair) {
    return Array.from({ length: planLength }, (_, index) => index);
  }
  if (hasNutritionTotalError) {
    // 合計PFCだけが外れた場合、合格済みの全レシピを捨てず、最大4食を
    // 調整対象にして週間合計を戻す。既存の不合格食も優先して含める。
    const spreadOrder = [planLength - 1, 0, Math.floor(planLength / 2), planLength - 2, 1];
    for (const index of spreadOrder) {
      if (index >= 0 && index < planLength) indices.add(index);
      if (indices.size >= Math.min(4, planLength)) break;
    }
  }
  if (indices.size === 0) return Array.from({ length: planLength }, (_, index) => index);
  return [...indices].sort((a, b) => a - b);
}

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
    const assumeSeasoningsAvailable = actualProfile?.assumeSeasoningsAvailable !== false;
    const dietaryRestrictions: string[] = Array.isArray(actualProfile?.dietaryRestrictions) ? actualProfile.dietaryRestrictions : [];
    const excludedIngredients: string[] = [...new Set([
      ...(Array.isArray(actualProfile?.excludedIngredients) ? actualProfile.excludedIngredients : []),
      ...(Array.isArray(actualProfile?.allergies) ? actualProfile.allergies : []),
    ])];

    // 週間献立は常に自由作成。在庫は献立を制限する条件ではなく、購入量を
    // 減らすために使えるものを優先する参考情報としてだけ扱う。
    const inventoryNames = Array.isArray(ingredients)
      ? ingredients.filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
      : [];
    const ingredientsSection = inventoryNames.length > 0
      ? `【作成方針】\n週間献立は自由作成です。必要な食材は在庫外から追加して構いません。\n【現在の在庫食材（参考情報）】\n${inventoryNames.join(', ')}\n※ 在庫だけで完成させる必要はありません。献立の品質や栄養バランスを損なわない範囲で、在庫食材を先の日付から優先して活用し、購入する食材を減らしてください。\n`
      : `【作成方針】\n週間献立は自由作成です。在庫に縛られず、おいしさ・食事制限・栄養バランスを満たす食材を選んでください。\n`;

    const pinnedSection = pinnedIngredients && pinnedIngredients.length > 0
      ? `\n【在庫内の優先食材（これらを必ずどこかのレシピで使用してください）】\n${pinnedIngredients.join(', ')}\n`
      : '';

    const climateSection = buildClimateSection(climate);
    const profileSection = buildProfileSection(actualProfile);
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
      assumeSeasoningsAvailable,
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
※ 栄養値は推定値なので、個々のレシピは目安から前後して構いません。指定された全レシピの合計は週間目安のプラスマイナス30%程度を目標にし、夕食はやや多め、昼食はやや控えめに調整してください。\n`;
    const languageSection = buildLanguageSection(language);
    const unitSection = buildIngredientUnitInstruction(language);

    const prompt = `あなたは経験豊富なプロの管理栄養士兼シェフです。以下の日付・食事枠それぞれに、昼は作りやすさと多様性のある一食、夜は主菜・副菜・汁物・主食を組み合わせた定食を提案し、1週間を通してPFCバランスの取れた献立プランを組んでください。

【生成が必要な日付・食事枠一覧（合計${requestedSlots.length}件）】
${slotLines}

${ingredientsSection}
${seasoningSection}${FLAVOR_INTENSITY_INSTRUCTION}${unitSection}${pinnedSection}${climateSection}${profileSection}${servingsSection}${historyNote}${pfcSection}${languageSection}
【重要・厳守事項】
0. 週間献立は自由作成です。在庫外の食材も使えます。在庫食材は、品質や栄養バランスを損なわない範囲で優先してください。
1. 上記の日付・食事枠それぞれに必ず1食ずつ、過不足なくレシピを割り当ててください。昼は一皿料理または定食、夜は必ず主菜・副菜・汁物・主食を含む定食にしてください。
2. 同じ主菜・主要食材（例:鶏肉料理が連日続く等）が連続しないよう、1週間を通して献立にバリエーションを持たせてください。丼・パスタ・麺・ワンプレートなど特定の形式へ不自然に偏らせず、内容に合う食事形式を選んでください。
3. ピン留め食材がある場合、1週間のどこかのレシピで必ず使用してください。
4. 気候や気温に合った最適な温度感・味付けを取り入れてください。
5. 【絶対除外食材】が指定されている場合は、該当食材やその類縁食材を一切使用しないでください。
6. 【栄養バランス】各レシピでPFCバランスを計算し、1人分あたりの推定栄養価を算出してください。
7. 【手順の具体性】各ステップには温度・火加減・時間・視覚的なキューを含めてください。
8. ${DISH_LOAD_INSTRUCTION}
9. 【提出前の自己監査】各材料が手順内で使われているか、分量・所要時間・PFCとcaloriesが矛盾していないかを確認してください。鶏肉・豚肉・ひき肉・内臓は中心75℃で1分以上または同等に十分加熱する指示を含め、味は塩分だけでなく旨味・酸味・香り・食感の組み合わせを確認してください。
   "time"には浸水・漬け込み・炊飯・焼成・休ませる時間も含めてください。同じ手順内に複数の連続する所要時間を書く場合、それらの合計より"time"を短くしないでください。
10. 【一食として完結】各料理には米・パン・麺・いも類等の主食を必ず材料と手順に含め、nutritionには一食全体の値を記載してください。夜はmeal_formatを"set"にし、componentsに主菜・副菜・汁物・主食を各1件以上入れ、材料と手順には全ての構成料理を含めてください。componentsのcourse値だけは表示言語にかかわらず「主菜」「副菜」「汁物」「主食」の日本語固定です。昼は内容に応じてmeal_formatを"single"または"set"にしてください。画面上では一食を一つの献立名・一つのアイコンで表現します。
11. 以下のJSON構造で、"plan"配列の中に上記の食事枠と同じ件数だけレシピデータを格納して返してください。"date"と"meal_slot"は依頼された値と完全に一致させてください（meal_slotは"lunch"または"dinner"）。これ以外のテキストは一切含めないでください。
{
  "plan": [
    {
      "date": "2026-09-02",
      "meal_slot": "dinner",
      "meal_format": "set",
      "title": "鮭の塩焼きと季節野菜の定食",
      "components": [
        { "course": "主菜", "title": "鮭の塩焼き" },
        { "course": "副菜", "title": "季節野菜の和え物" },
        { "course": "汁物", "title": "豆腐のみそ汁" },
        { "course": "主食", "title": "ご飯" }
      ],
      "time": "調理時間目安（例：15分）",
      "genre": "和食",
      "dish_badge": "洗い物少なめ（2点）",
      "ingredients": [
        { "name": "使用する具材または調味料", "amount": "分量の目安" }
      ],
      "steps": ["手順1", "手順2", "手順3..."],
      "tips": "調理のコツ・アドバイス",
      "nutrition": { "calories": 650, "protein_g": 30, "fat_g": 20, "carbs_g": 85 }
    }
  ]
}
genreは「和食」「洋食」「中華」「アジア料理」「韓国料理」「タイ料理」「インド料理」「メキシコ料理」「中東料理」「イタリアン」「フレンチ」「スペイン料理」「ギリシャ料理」「ドイツ・中欧料理」「北欧料理」「ロシア・東欧料理」「ベトナム料理」「台湾料理」「インドネシア・マレーシア料理」「アメリカ南部料理」「モロッコ・北アフリカ料理」「エチオピア料理」「ジャマイカ・カリブ料理」「ペルー料理」「ブラジル料理」「シンガポール料理」「その他」から選んでください。${language === 'en' ? '（genreの値は必ずこの日本語表記のまま出力し、翻訳しないでください）' : ''}`;

    // 自由作成として扱いつつ、通常レシピと同じ食事制限・安全性・品質の
    // 各ゲートを週間献立にも適用する。
    const feasibilityContext: FeasibilityContext = {
      mode: 'free',
      inventoryNames: [],
      assumeSeasoningsAvailable,
      dietaryRestrictions,
      excludedIngredients,
      templateKey: null,
    };

    const validateCandidatePlan = (planArray: unknown[]): string[] => {
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

      if (shapeErrors.length > 0) return shapeErrors;

      const typedPlan = planArray as ValidatedRecipe[];
      const logicErrors = typedPlan.flatMap((item, index) =>
        validateRecipeLogic(item, feasibilityContext).map((error) => `plan[${index}]: ${error}`)
      );
      planArray.forEach((item, index) => {
        const entry = item as Record<string, unknown>;
        if (entry.meal_slot === 'dinner') {
          if (entry.meal_format !== 'set') logicErrors.push(`plan[${index}]: dinner meal_format must be "set"`);
          const components = Array.isArray(entry.components) ? entry.components : [];
          components.forEach((component, componentIndex) => {
            if (!component || typeof component !== 'object') {
              logicErrors.push(`plan[${index}].components[${componentIndex}] must be an object`);
              return;
            }
            const value = component as Record<string, unknown>;
            if (typeof value.title !== 'string' || !value.title.trim()) {
              logicErrors.push(`plan[${index}].components[${componentIndex}].title is missing`);
            }
          });
          const courses = new Set(components.map((component) =>
            component && typeof component === 'object' ? String((component as Record<string, unknown>).course || '') : ''
          ));
          for (const required of ['主菜', '副菜', '汁物', '主食']) {
            if (!courses.has(required)) logicErrors.push(`plan[${index}]: dinner components must include ${required}`);
          }
        } else if (entry.meal_format !== 'single' && entry.meal_format !== 'set') {
          logicErrors.push(`plan[${index}]: lunch meal_format must be "single" or "set"`);
        }
      });
      logicErrors.push(...typedPlan.flatMap((item, index) =>
        qualityGateErrors(item, {
          servings: targetServings,
          mealStyle: (planArray[index] as Record<string, unknown>)?.meal_format === 'set' ? 'set' : 'single',
          targetCaloriesPerServing: perMealCalories,
          targetProteinPerServing: perMealProtein,
        }, `plan[${index}]`)
      ));
      logicErrors.push(...validateWeeklyPlan(
        typedPlan as WeeklyRecipe[],
        requestedSlots,
        Array.isArray(pinnedIngredients) ? pinnedIngredients : [],
        { calories: weeklyCalories, protein_g: weeklyProtein, fat_g: weeklyFat, carbs_g: weeklyCarbs },
      ));
      return logicErrors;
    };

    let lastErrors: string[] = [];
    let previousPlan: unknown[] = [];
    for (let attempt = 0; attempt < MAX_VALIDATION_ATTEMPTS; attempt++) {
      const repairIndices = attempt > 0 && previousPlan.length === requestedSlots.length
        ? repairIndicesFromErrors(lastErrors, previousPlan.length)
        : [];
      const targetedRepair = repairIndices.length > 0 && repairIndices.length < previousPlan.length;
      const repairEntries = targetedRepair ? repairIndices.map((index) => previousPlan[index]) : [];
      const attemptPrompt = attempt === 0
        ? prompt
        : `${prompt}
${buildValidationRetryNote(lastErrors)}
【最終修正指示（上記の出力件数指定よりこちらを優先）】
前回案は次のJSONです。
${JSON.stringify({ plan: previousPlan })}
${targetedRepair
  ? `品質検証に合格済みの料理は変更せず、次の${repairEntries.length}食だけを修正してください。前回案全体との料理ジャンル・主材料・PFCのバランスも保ってください。\n修正対象: ${JSON.stringify(repairEntries.map((entry) => ({ date: (entry as Record<string, unknown>)?.date, meal_slot: (entry as Record<string, unknown>)?.meal_slot })))}\n出力するplan配列には修正対象の${repairEntries.length}食だけを、同じdateとmeal_slotで格納してください。合格済みの料理は出力しないでください。\n各修正レシピは提出前に、(1)材料欄の全食材名が手順内に明記されている、(2)各加熱工程に火加減・時間・見た目の完了条件がある、(3)肉類には中心75℃で1分以上または同等の安全確認がある、(4)塩味だけに頼らず酸味または自然な甘味・香り・食感の設計がある、の4点を一つずつ照合してください。`
  : `前回案全体を、上記の不採用理由をすべて解消するよう修正してください。出力するplan配列には依頼された${requestedSlots.length}食すべてを格納してください。`}`;

      const models = [...WEEKLY_PLAN_MODEL_ORDER[attempt]];
      const thinkingLevel = attempt === 0 ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW;
      const response = await generateWithRetry(ai, {
        contents: [{ role: 'user', parts: [{ text: attemptPrompt }] }],
        config: {
          responseMimeType: 'application/json',
          maxOutputTokens: 24576,
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

      let planArray: unknown[] = Array.isArray(json.plan) ? json.plan : [];

      if (attempt > 0 && targetedRepair) {
        const requestedRepairKeys = new Set(repairEntries.map((entry) => slotKey(entry as Record<string, unknown>)));
        const repairBySlot = new Map(
          planArray.map((entry) => [slotKey(entry as Record<string, unknown>), entry] as const)
        );
        const hasExactRepairSet = planArray.length === requestedRepairKeys.size
          && repairBySlot.size === requestedRepairKeys.size
          && [...requestedRepairKeys].every((key) => repairBySlot.has(key));

        if (hasExactRepairSet) {
          planArray = previousPlan.map((entry) =>
            repairBySlot.get(slotKey(entry as Record<string, unknown>)) || entry
          );
        } else if (planArray.length !== requestedSlots.length) {
          lastErrors = ['repair response must contain exactly the requested repair slots'];
          continue;
        }
      }

      planArray = planArray.map((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;
        const recipe = entry as Partial<ValidatedRecipe>;
        if (typeof recipe.time !== 'string' || !Array.isArray(recipe.steps) || !recipe.steps.every((step) => typeof step === 'string')) {
          return entry;
        }
        return reconcileRecipeTime(entry as ValidatedRecipe);
      });

      const validationErrors = validateCandidatePlan(planArray);
      if (validationErrors.length > 0) {
        previousPlan = planArray;
        lastErrors = validationErrors;
        console.warn('[WEEKLY_PLAN_VALIDATION]', JSON.stringify({
          attempt: attempt + 1,
          repairedRecipes: targetedRepair ? repairIndices.length : 0,
          errors: validationErrors,
        }));
        continue;
      }

      return NextResponse.json({
        plan: planArray.map((entry) => ({
          ...(entry as Record<string, unknown>),
          servings: targetServings,
        })),
        weeklyTargets: { calories: weeklyCalories, protein_g: weeklyProtein, fat_g: weeklyFat, carbs_g: weeklyCarbs },
      });
    }

    console.error('Weekly plan validation failed after retries:', lastErrors);
    return NextResponse.json({
      code: 'validation_failed',
      error: language === 'en'
        ? 'The AI could not produce a plan that satisfies your conditions. Retry or review the selected meals.'
        : '条件を満たす献立を生成できませんでした。同じ条件で再試行するか、選択する食事枠を見直してください。',
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
