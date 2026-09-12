import { NextResponse } from 'next/server';
import { ThinkingLevel } from '@google/genai';
import {
  ai,
  generateWithRetry,
  getAiCallTelemetry,
  FAST_AI_MODEL,
  QUALITY_AI_MODEL,
  buildProfileSection,
  buildClimateSection,
  buildSeasoningSection,
  buildLanguageSection,
  buildTemplateConstraintSection,
  DISH_LOAD_INSTRUCTION,
  FLAVOR_INTENSITY_INSTRUCTION,
  Language,
} from '@/lib/ai';
import {
  validateRecipeShape,
  validateRecipeLogic,
  buildValidationRetryNote,
  ValidatedRecipe,
  FeasibilityContext,
  summarizeInventoryForFeasibility,
} from '@/lib/recipeValidation';
import { parseAiJson } from '@/lib/aiJson';
import { validateDietaryRestrictions, validateExcludedIngredients } from '@/lib/dietaryRules';
import { qualityGateErrors, sanitizeServings, validateRequiredIngredients, validateSetMeal } from '@/lib/recipeQuality';

// 初回生成は低遅延のFlash-Liteを使い、品質検証で不採用になった場合だけ
// Flashへ昇格する。無条件に重いモデルを複数回呼ばない。
const RECIPE_MODEL_ORDER = [
  [FAST_AI_MODEL, QUALITY_AI_MODEL],
  [QUALITY_AI_MODEL, FAST_AI_MODEL],
] as const;
const MAX_VALIDATION_ATTEMPTS = RECIPE_MODEL_ORDER.length;

type RecipeAttemptTelemetry = {
  attempt: number;
  model: string;
  aiDurationMs: number;
  transportFailures: number;
  outcome: 'accepted' | 'rejected' | 'infeasible';
  errors: string[];
};

function compactValidationErrors(errors: string[]): string[] {
  return errors.slice(0, 12).map((error) => error.slice(0, 220));
}

function generationHeaders(
  startedAt: number,
  attempt: RecipeAttemptTelemetry,
): HeadersInit {
  return {
    'Server-Timing': `ai;dur=${attempt.aiDurationMs}, total;dur=${Date.now() - startedAt}`,
    'X-Sikurepi-AI-Model': attempt.model.replace(/^models\//, ''),
    'X-Sikurepi-AI-Rescue': String(attempt.attempt > 1 || attempt.model === QUALITY_AI_MODEL),
    'X-Sikurepi-Validation-Attempts': String(attempt.attempt),
  };
}

function logRecipeGeneration(
  requestId: string,
  startedAt: number,
  outcome: 'success' | 'infeasible' | 'validation_failed' | 'request_failed',
  attempts: RecipeAttemptTelemetry[],
) {
  console.info('[RECIPE_GENERATION]', JSON.stringify({
    requestId,
    outcome,
    totalDurationMs: Date.now() - startedAt,
    usedFlashRescue: attempts.some((attempt) =>
      attempt.attempt > 1 || attempt.model === QUALITY_AI_MODEL
    ),
    attempts,
  }));
}

export async function POST(req: Request) {
  const generationStartedAt = Date.now();
  const requestId = `${generationStartedAt.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const generationAttempts: RecipeAttemptTelemetry[] = [];
  let language: Language = 'ja';
  try {
    const body = await req.json();
    const {
      ingredients = [],
      pinnedIngredients = [],
      conditions,
      instruction,
      templateKey,
      servings,
      climate,
      profile,
      userProfile,
      recentHistory,
      likedRecipeSummary,
      mode,
      mealStyle,
    } = body;
    language = body.language === 'en' ? 'en' : 'ja';

    const actualProfile = userProfile || profile;
    const isFreeMode = mode === 'free';
    const isSetMeal = mealStyle === 'set';
    const assumeSeasoningsAvailable = actualProfile?.assumeSeasoningsAvailable !== false;
    const dietaryRestrictions: string[] = Array.isArray(actualProfile?.dietaryRestrictions) ? actualProfile.dietaryRestrictions : [];
    const excludedIngredients: string[] = [...new Set([
      ...(Array.isArray(actualProfile?.excludedIngredients) ? actualProfile.excludedIngredients : []),
      ...(Array.isArray(actualProfile?.allergies) ? actualProfile.allergies : []),
    ])];

    if (templateKey === 'meaty' && dietaryRestrictions.some((value) => value === 'ベジタリアン' || value === 'ヴィーガン')) {
      return NextResponse.json({
        recipes: [],
        cooking_tips: [],
        feasibility: {
          feasible: false,
          reason: language === 'en'
            ? 'The meat-focused template conflicts with your vegetarian or vegan restriction.'
            : '「ガッツリ肉」テンプレートは、選択中のベジタリアン／ヴィーガン設定と両立しません。',
          missingKeyIngredients: [],
        },
      });
    }

    if (Array.isArray(pinnedIngredients) && pinnedIngredients.length > 0) {
      const pinnedRecipe = { ingredients: pinnedIngredients.map((name: string) => ({ name, amount: '' })) };
      const pinnedViolations = [
        ...validateDietaryRestrictions(pinnedRecipe, dietaryRestrictions),
        ...validateExcludedIngredients(pinnedRecipe, excludedIngredients),
      ];
      if (pinnedViolations.length > 0) {
        return NextResponse.json({
          recipes: [],
          cooking_tips: [],
          feasibility: {
            feasible: false,
            reason: language === 'en'
              ? 'A selected ingredient conflicts with your dietary restrictions or excluded ingredients.'
              : '使いたい食材に、食事制限または除外食材と両立しないものが含まれています。',
            missingKeyIngredients: [],
          },
        });
      }
    }

    // 在庫モードを、在庫が空という理由だけで自由作成へ暗黙変換しない。
    // 先に理由を示して止めることで「在庫から」と指定したユーザーの意図を守る。
    if (!isFreeMode && (!Array.isArray(ingredients) || ingredients.length === 0)) {
      return NextResponse.json({
        recipes: [],
        cooking_tips: [],
        feasibility: {
          feasible: false,
          reason: language === 'en'
            ? 'There are no ingredients in stock to build a recipe from. Add at least one main ingredient, or switch to free creation.'
            : '在庫にレシピの軸になる食材がありません。食材を1つ以上追加するか、自由作成に切り替えてください。',
          missingKeyIngredients: [],
        },
      });
    }

    if (!isFreeMode) {
      const inventorySummary = summarizeInventoryForFeasibility(ingredients, true);
      if (inventorySummary.nonStapleCount === 0) {
        return NextResponse.json({
          recipes: [],
          cooking_tips: [],
          feasibility: {
            feasible: false,
            reason: language === 'en'
              ? 'Only seasonings are available. Add at least one substantive ingredient before generating from your pantry.'
              : '在庫が調味料だけのため料理として成立しません。肉・魚・野菜・卵・主食など、軸になる食材を1つ以上追加してください。',
            missingKeyIngredients: [],
          },
        });
      }
    }

    const ingredientsSection = isFreeMode
      ? `【作成方針】\n冷蔵庫の在庫に縛られず、自由でおいしく栄養バランスの良いレシピを提案してください。\n`
      : `【現在の在庫食材(これが全てです)】\n${ingredients.join(', ')}\n\n【最優先で厳守：在庫食材だけで完成させる】ユーザーは「今ある食材だけで作れるレシピ」を求めています。上記リストに無い食材を、肉・魚・野菜・主食・卵・乳製品などの主要な具材として勝手に追加するのは絶対にやめてください。品数が少なく見えても、在庫食材の分量調整・切り方・調理法の工夫だけで1品を完成させてください。\n・追加してよいのは、下記【調味料・味付けの前提】で許可された基本調味料だけです。それ以外の食材(在庫にない野菜・肉・魚・加工品・薬味・トッピングを含む)は、少量・彩り・栄養調整という理由でも一切追加しないでください。成立しない場合は無理に生成せず、検証で不採用になります。\n`;

    const pinnedSection = !isFreeMode && pinnedIngredients && pinnedIngredients.length > 0
      ? `\n【ピン留め食材（これらを必ず主役・または必須で使用してください！）】\n${pinnedIngredients.join(', ')}\n`
      : '';

    const conditionsSection = conditions && conditions.length > 0
      ? `\n【重要：選択された調理条件】\n${conditions.join('、')}\n`
      : '';

    const templateSection = buildTemplateConstraintSection(templateKey);

    // 気候・環境連動セクション
    const climateSection = buildClimateSection(climate);

    // ユーザープロファイル（マイ一括設定）セクション
    const profileSection = buildProfileSection(actualProfile);
    const seasoningSection = buildSeasoningSection(assumeSeasoningsAvailable, dietaryRestrictions);

    const historyNote = Array.isArray(recentHistory) && recentHistory.length > 0
      ? `\n【直近の料理履歴（マンネリ防止のため、これらと異なる料理を提案してください）】\n${recentHistory.join('、')}\n`
      : '';

    // ユーザーが「気に入って保存した」レシピの履歴から、好みの傾向をAIに学習させる。
    // 同じ料理を繰り返させるのではなく、傾向（ジャンル・味付けの系統）を汲み取って
    // 新しい提案の精度を上げるための参考情報として渡す。
    const tasteLearningSection = Array.isArray(likedRecipeSummary) && likedRecipeSummary.length > 0
      ? `\n【このユーザーが過去に気に入って保存したレシピ（好みの学習用の参考情報）】\n${likedRecipeSummary
          .map((r: { title?: string; genre?: string | null }) => `・${r.title}${r.genre ? `（${r.genre}）` : ''}`)
          .join('\n')}\nこれらから読み取れる味付け・ジャンル・食材選びの傾向をくみ取り、同じ料理を繰り返すのではなく「この人がきっと美味しいと感じるであろう」新しい一皿の精度を高めるための参考にしてください。\n`
      : '';

    const targetServings = sanitizeServings(servings ?? actualProfile?.servings, 2);
    const targetCaloriesPerMeal = typeof actualProfile?.targetCalories === 'number' && actualProfile.targetCalories > 0
      ? actualProfile.targetCalories / 3
      : null;
    const targetProteinPerMeal = typeof actualProfile?.targetProtein === 'number' && actualProfile.targetProtein > 0
      ? actualProfile.targetProtein / 3
      : null;
    const servingsSection = `\n【分量指定】\nすべてのレシピの材料・分量は ${targetServings}人分 で記載してください。\n`;
    const languageSection = buildLanguageSection(language);
    const feasibilityLanguageSection = language === 'en'
      ? '\n【成立可否の出力言語】"feasibility.reason"と"feasibility.missingKeyIngredients"も自然な英語で出力してください。\n'
      : '';
    const mealStyleSection = isSetMeal
      ? `\n【重要：定食セット構成】\n単品の料理候補を複数出すのではなく、主菜1品・副菜1〜2品・汁物1品（和食以外のジャンルなら、それに相当する主菜・副菜・スープ等の構成でよい）からなる、レストランの定食のような統一感のある「1組のセット」を提案してください。全体で1食分として栄養バランスが良くなるよう調整してください。各レシピの"course"には「主菜」「副菜」「汁物」「ご飯・主食」のいずれかを必ず指定してください${language === 'en' ? '（courseの値は必ずこの日本語表記のまま出力し、翻訳しないでください。表示側で翻訳します）' : ''}。\n【最優先で厳守：セット内の変化・メリハリ】「統一感」は食卓としての相性の良さを指すのであって、似た味・似た食材を繰り返すことではありません。以下を必ず守ってください。\n・主菜で使うメインの調味料・味の系統（醤油ベース、味噌ベース、塩・酸味系、スパイシー系など）を、副菜・汁物ではそのまま繰り返さず、意図的に変えてください（例：主菜が醤油だれの照り焼きなら、副菜は塩味や酢の物、汁物は味噌汁ではなく澄まし汁や別の出汁にするなど）。\n・主菜で使うメイン食材（肉・魚など）を副菜・汁物でそのまま主役として重複させないでください。食感も、主菜がジューシー・こってり系なら副菜はシャキシャキ・さっぱり系にするなど、セット全体で単調にならないようにしてください。\n・こうすることで、一口ごとに違う美味しさが感じられる「メリハリのある定食」に仕上げてください。\n`
      : '';

    const basePrompt = `あなたは経験豊富なプロの管理栄養士兼シェフです。${isFreeMode ? 'おすすめの絶品料理' : '以下の在庫食材を使った料理'}を、現在の気候やユーザーの好みにぴったりな形で家庭で再現できるよう提案してください。
${ingredientsSection}
${seasoningSection}${FLAVOR_INTENSITY_INSTRUCTION}${templateSection}${pinnedSection}${climateSection}${profileSection}${conditionsSection}${servingsSection}${instruction ? `\n【ユーザーからの追加指示】\n${instruction}\n` : ''}${historyNote}${tasteLearningSection}${languageSection}${feasibilityLanguageSection}${mealStyleSection}

【重要・厳守事項】
${isFreeMode ? '' : '0. 【最優先】"ingredients"配列に載せてよいのは、在庫食材リストにある食材と、常備調味料の前提で許可されている基本調味料だけです。在庫にない主要な具材(肉・魚・野菜・主食・卵・乳製品など)を1つでも追加した場合、それはユーザーの意図に反する失敗作とみなされます。\n'}1. ピン留め食材がある場合、それらを「主役」として扱うか、レシピに「必ず」組み込んでください。
2. 気候や気温（猛暑、寒さ、雨など）に合った最適な温度感・味付け（さっぱり、温まるなど）を取り入れてください。
3. 【絶対除外食材】が指定されている場合は、該当食材やその類縁食材を一切使用しないでください。
4. 【栄養バランス】すべてのレシピでPFCバランス（タンパク質・脂質・炭水化物）を計算し、1人分あたりの推定栄養価（カロリー, タンパク質g, 脂質g, 炭水化物g）を算出してください。
5. 【手順の具体性】各ステップには必ず「中火で3分」「表面がこんがりきつね色になるまで」など、温度・火加減・時間・視覚的なキューを含めてください。
6. 【本当に美味しい仕上がりへのこだわり】提案する前に、実際に味見したときの味を頭の中で具体的に想像してください。甘味・塩味・酸味・苦味・旨味のバランス、香りの立たせ方（仕上げのひと振り・香味油・薬味など）、食感のコントラスト（カリカリ×とろとろ等）のうち最低1つは意識的に取り入れ、単に食材を組み合わせただけの平凡な一皿ではなく「これは美味しそう」と一目で伝わる工夫を必ず盛り込んでください。
7. ${DISH_LOAD_INSTRUCTION}
8. 【提出前の自己監査】材料の全てが手順内で使われているか、人数分の分量が具体的か、調理時間と各工程の時間が矛盾しないか、PFCから計算される熱量とcaloriesが大きく矛盾しないかを確認してください。鶏肉・豚肉・ひき肉・内臓は中心75℃で1分以上または同等に十分加熱する指示を含めてください。味は塩分量だけに頼らず、旨味・酸味・香り・食感を確認してからJSONを確定してください。
9. ${isSetMeal
        ? '以下のJSON構造で、"recipes"配列の中に定食セットを構成する各品(主菜・副菜・汁物など、通常3〜4品)のレシピデータを格納して返してください。'
        : '以下のJSON構造で、"recipes"配列の中に最もおすすめする料理を1品だけ格納して返してください。候補を複数生成しないでください。'
      }"climate_badge"には気候マッチ度を示す文字だけの短いタグ（例：「猛暑に最適」「体ポカポカ」など）を記載してください。"climate_badge"と"dish_badge"には絵文字や装飾記号を含めないでください。また"cooking_tips"配列に食材や気候に関連するコツ・保存方法・栄養豆知識を3件含めてください。
10. 【成立可否も同時判定】在庫モードで、在庫食材の系統と指定カテゴリが明らかに噛み合わない、または主要食材が足りず条件どおりの料理が成立しない場合は、無理なレシピを作らず"feasibility.feasible"をfalse、"recipes"と"cooking_tips"を空配列にしてください。成立する場合と自由作成モードでは"feasibility.feasible"をtrueにしてください。これ以外のテキストは一切含めないでください。
{
  "feasibility": {
    "feasible": true,
    "reason": "作れない場合だけ理由を1〜2文で記載。作れる場合は空文字",
    "missingKeyIngredients": ["成立に不足する主要食材。作れる場合は空配列"]
  },
  "recipes": [
    {
      "title": "料理名",
      "time": "調理時間目安（例：15分）",
      "genre": "和食",
      "climate_badge": "猛暑に最適",
      "dish_badge": "洗い物少なめ（2点）",${isSetMeal ? '\n      "course": "主菜（または副菜・汁物・ご飯・主食）",' : ''}
      "ingredients": [
        { "name": "使用する具材または調味料", "amount": "分量の目安（例：豚バラ肉200g、トマト1個、ポン酢 大さじ2など）" }
      ],
      "steps": ["手順1", "手順2", "手順3..."],
      "tips": "調理のコツ・アドバイス",
      "nutrition": { "calories": 420, "protein_g": 28, "fat_g": 14, "carbs_g": 35 }
    }
  ],
  "cooking_tips": [
    { "category": "保存方法", "tip": "食材の保存に関するアドバイス" },
    { "category": "調理のコツ", "tip": "料理をおいしくするコツ" },
    { "category": "栄養豆知識", "tip": "食材や栄養に関する豆知識" }
  ]
}
genreは「和食」「洋食」「中華」「アジア料理」「韓国料理」「タイ料理」「インド料理」「メキシコ料理」「中東料理」「イタリアン」「フレンチ」「スペイン料理」「ギリシャ料理」「ドイツ・中欧料理」「北欧料理」「ロシア・東欧料理」「ベトナム料理」「台湾料理」「インドネシア・マレーシア料理」「アメリカ南部料理」「モロッコ・北アフリカ料理」「エチオピア料理」「ジャマイカ・カリブ料理」「ペルー料理」「ブラジル料理」「シンガポール料理」「その他」から選んでください。${language === 'en' ? '（genreの値は必ずこの日本語表記のまま出力し、翻訳しないでください）' : ''}`;

    // --- 生成 + 生成後検証(JSON構造 + 料理としての論理検証)。要件10 ---
    const feasibilityContext: FeasibilityContext = {
      mode: isFreeMode ? 'free' : 'inventory',
      inventoryNames: ingredients,
      assumeSeasoningsAvailable,
      dietaryRestrictions,
      excludedIngredients,
      templateKey: templateKey || null,
    };

    let lastErrors: string[] = [];
    for (let attempt = 0; attempt < MAX_VALIDATION_ATTEMPTS; attempt++) {
      const prompt = attempt === 0 ? basePrompt : `${basePrompt}\n${buildValidationRetryNote(lastErrors)}`;

      const models = [...RECIPE_MODEL_ORDER[attempt]];
      const thinkingLevel = attempt === 0 ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW;
      const response = await generateWithRetry(ai, {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel },
        }
      }, models, 2);
      const aiTelemetry = getAiCallTelemetry(response);
      const attemptBase = {
        attempt: attempt + 1,
        model: aiTelemetry?.model || models[0],
        aiDurationMs: aiTelemetry?.durationMs || 0,
        transportFailures: aiTelemetry?.failedAttempts.length || 0,
      };

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || response.text || '';
      if (!text) throw new Error('AI output was empty');

      let json: Record<string, unknown>;
      try {
        json = parseAiJson<Record<string, unknown>>(text);
      } catch (parseError) {
        lastErrors = [
          `response was not valid JSON: ${parseError instanceof Error ? parseError.message : 'unknown parse error'}`,
        ];
        generationAttempts.push({
          ...attemptBase,
          outcome: 'rejected',
          errors: compactValidationErrors(lastErrors),
        });
        continue;
      }

      const rawFeasibility = json.feasibility;
      if (
        !isFreeMode
        && rawFeasibility
        && typeof rawFeasibility === 'object'
        && !Array.isArray(rawFeasibility)
        && (rawFeasibility as Record<string, unknown>).feasible === false
      ) {
        const feasibility = rawFeasibility as Record<string, unknown>;
        const attemptTelemetry: RecipeAttemptTelemetry = {
          ...attemptBase,
          outcome: 'infeasible',
          errors: [],
        };
        generationAttempts.push(attemptTelemetry);
        logRecipeGeneration(requestId, generationStartedAt, 'infeasible', generationAttempts);
        return NextResponse.json({
          recipes: [],
          cooking_tips: [],
          feasibility: {
            feasible: false,
            reason: typeof feasibility.reason === 'string' ? feasibility.reason : '',
            missingKeyIngredients: Array.isArray(feasibility.missingKeyIngredients)
              ? feasibility.missingKeyIngredients.filter((name): name is string => typeof name === 'string')
              : [],
          },
        }, { headers: generationHeaders(generationStartedAt, attemptTelemetry) });
      }

      const recipeArray: unknown[] = Array.isArray(json.recipes) ? json.recipes : [];
      const shapeErrors = recipeArray.length > 0
        ? recipeArray.flatMap((r: unknown, i: number) => validateRecipeShape(r, `recipes[${i}]`))
        : ['recipes must be a non-empty array'];

      if (isSetMeal && (recipeArray.length < 3 || recipeArray.length > 4)) {
        shapeErrors.push('set meal recipes must contain 3 or 4 dishes');
      }
      if (!isSetMeal && recipeArray.length !== 1) {
        shapeErrors.push('single-dish suggestions must contain exactly 1 recipe');
      }
      if (!Array.isArray(json.cooking_tips) || json.cooking_tips.length !== 3) {
        shapeErrors.push('cooking_tips must contain exactly 3 items');
      } else {
        json.cooking_tips.forEach((tip, index) => {
          if (!tip || typeof tip !== 'object') {
            shapeErrors.push(`cooking_tips[${index}] must be an object`);
            return;
          }
          const entry = tip as Record<string, unknown>;
          if (typeof entry.category !== 'string' || !entry.category.trim()) {
            shapeErrors.push(`cooking_tips[${index}].category is missing`);
          }
          if (typeof entry.tip !== 'string' || !entry.tip.trim()) {
            shapeErrors.push(`cooking_tips[${index}].tip is missing`);
          }
          if (/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F]/u.test(`${entry.category || ''} ${entry.tip || ''}`)) {
            shapeErrors.push(`cooking_tips[${index}] must not contain emoji`);
          }
        });
      }

      if (shapeErrors.length > 0) {
        lastErrors = shapeErrors;
        generationAttempts.push({
          ...attemptBase,
          outcome: 'rejected',
          errors: compactValidationErrors(lastErrors),
        });
        continue;
      }

      const logicErrors = (recipeArray as ValidatedRecipe[]).flatMap((r) => validateRecipeLogic(r, feasibilityContext));
      logicErrors.push(...(recipeArray as ValidatedRecipe[]).flatMap((recipe, index) =>
        qualityGateErrors(recipe, {
          servings: targetServings,
          mealStyle: isSetMeal ? 'set' : 'single',
          targetCaloriesPerServing: isSetMeal ? null : targetCaloriesPerMeal,
          targetProteinPerServing: isSetMeal ? null : targetProteinPerMeal,
        }, `recipes[${index}]`)
      ));
      logicErrors.push(...validateRequiredIngredients(
        recipeArray as ValidatedRecipe[],
        Array.isArray(pinnedIngredients) ? pinnedIngredients : [],
        !isSetMeal,
      ));
      if (isSetMeal) logicErrors.push(...validateSetMeal(
        recipeArray as ValidatedRecipe[],
        targetCaloriesPerMeal,
        targetProteinPerMeal,
      ));
      if (logicErrors.length > 0) {
        lastErrors = logicErrors;
        generationAttempts.push({
          ...attemptBase,
          outcome: 'rejected',
          errors: compactValidationErrors(lastErrors),
        });
        continue;
      }

      // 検証OK: 採用
      const attemptTelemetry: RecipeAttemptTelemetry = {
        ...attemptBase,
        outcome: 'accepted',
        errors: [],
      };
      generationAttempts.push(attemptTelemetry);
      logRecipeGeneration(requestId, generationStartedAt, 'success', generationAttempts);
      return NextResponse.json(json, {
        headers: generationHeaders(generationStartedAt, attemptTelemetry),
      });
    }

    // 規定回数リトライしても検証を通らなかった場合は、不正確なレシピを
    // そのまま出すよりも明示的にエラーにする
    console.error('Recipe validation failed after retries:', lastErrors);
    logRecipeGeneration(requestId, generationStartedAt, 'validation_failed', generationAttempts);
    return NextResponse.json({
      error: language === 'en'
        ? 'The AI could not produce a recipe that satisfies your conditions after multiple attempts. Please try again or adjust your request.'
        : '条件を満たすレシピをAIが生成できませんでした。条件を変えるか、もう一度お試しください。',
    }, { status: 422 });

  } catch (error: unknown) {
    console.error('Recipe Gen Error:', error);
    logRecipeGeneration(requestId, generationStartedAt, 'request_failed', generationAttempts);
    const details = typeof error === 'object' && error !== null
      ? error as { status?: number | string; httpStatusCode?: number | string; code?: number | string; message?: string }
      : {};
    const status = details.status || details.httpStatusCode || details.code;
    const message = details.message || '';
    const isTemporaryFailure = status === 429
      || status === 503
      || status === 'UNAVAILABLE'
      || /temporar|unavailable|一時的|利用不可|混雑/i.test(message);
    if (isTemporaryFailure) {
      return NextResponse.json({
        error: language === 'en'
          ? 'The AI model is temporarily busy. Please try again in a moment.'
          : 'AIモデルが一時的に混雑しています。しばらく時間をおいてから再度お試しください。',
      }, { status: 503 });
    }
    return NextResponse.json({
      error: language === 'en'
        ? 'Failed to generate recipes. Please try again in a moment.'
        : 'レシピの生成に失敗しました。しばらく時間をおいてもう一度お試しください。',
    }, { status: 500 });
  }
}
