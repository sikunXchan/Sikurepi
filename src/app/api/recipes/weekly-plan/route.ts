import { NextResponse } from 'next/server';
import { ai, generateWithRetry, buildProfileSection, buildClimateSection, buildSeasoningSection, buildLanguageSection, DISH_LOAD_INSTRUCTION, RecipeProfile, Language } from '@/lib/ai';

const SLOT_LABEL: Record<string, string> = { lunch: '昼', dinner: '夜' };
const WEEKDAY_LABEL = ['日', '月', '火', '水', '木', '金', '土'];

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
    const seasoningSection = buildSeasoningSection(actualProfile?.assumeSeasoningsAvailable !== false);

    const targetServings = 2;
    const servingsSection = `\n【分量指定】\nすべてのレシピの材料・分量は ${targetServings}人分 で記載してください。\n`;

    const historyNote = Array.isArray(recentHistory) && recentHistory.length > 0
      ? `\n【直近の料理履歴（マンネリ防止のため、これらと異なる料理を提案してください）】\n${recentHistory.join('、')}\n`
      : '';

    const { dailyCalories, dailyProtein, dailyFat, dailyCarbs } = computeDailyTargets(actualProfile);
    const perMealCalories = Math.round(dailyCalories / 3);
    const perMealProtein = Math.round(dailyProtein / 3);
    const perMealFat = Math.round(dailyFat / 3);
    const perMealCarbs = Math.round(dailyCarbs / 3);
    const weeklyCalories = perMealCalories * slots.length;
    const weeklyProtein = perMealProtein * slots.length;
    const weeklyFat = perMealFat * slots.length;
    const weeklyCarbs = perMealCarbs * slots.length;

    const slotLines = slots.map((s: { date: string; mealSlot: string }) => {
      const d = new Date(s.date);
      const weekday = WEEKDAY_LABEL[d.getDay()];
      const slotLabel = SLOT_LABEL[s.mealSlot] || s.mealSlot;
      return `- ${s.date}(${weekday}) ${slotLabel}`;
    }).join('\n');

    const pfcSection = `\n【週間PFCバランス目標（最重要）】
1食あたりの目安: カロリー約${perMealCalories}kcal、タンパク質約${perMealProtein}g、脂質約${perMealFat}g、炭水化物約${perMealCarbs}g
今回生成する${slots.length}食の合計目安: カロリー約${weeklyCalories}kcal、タンパク質約${weeklyProtein}g、脂質約${weeklyFat}g、炭水化物約${weeklyCarbs}g
※ 個々のレシピは目安から前後してよいですが、指定された全レシピの栄養価の合計が、この週間合計目安のプラスマイナス15%程度に収まるように、各食の分量・内容を調整してください。夕食はやや多め、昼食はやや控えめ、など常識的な配分は問題ありません。\n`;
    const languageSection = buildLanguageSection(language);

    const prompt = `あなたは経験豊富なプロの管理栄養士兼シェフです。以下の日付・食事枠それぞれに1品ずつ、家庭で再現できる料理を提案し、1週間を通してPFCバランスの取れた献立プランを組んでください。

【生成が必要な日付・食事枠一覧（合計${slots.length}件）】
${slotLines}

${ingredientsSection}
${seasoningSection}${pinnedSection}${climateSection}${profileSection}${servingsSection}${historyNote}${pfcSection}${languageSection}
【重要・厳守事項】
1. 上記の日付・食事枠それぞれに必ず1品ずつ、過不足なくレシピを割り当ててください。
2. 同じ主菜・主要食材（例:鶏肉料理が連日続く等）が連続しないよう、1週間を通して献立にバリエーションを持たせてください。
3. ピン留め食材がある場合、1週間のどこかのレシピで必ず使用してください。
4. 気候や気温に合った最適な温度感・味付けを取り入れてください。
5. 【絶対除外食材】が指定されている場合は、該当食材やその類縁食材を一切使用しないでください。
6. 【栄養バランス】各レシピでPFCバランスを計算し、1人分あたりの推定栄養価を算出してください。
7. 【手順の具体性】各ステップには温度・火加減・時間・視覚的なキューを含めてください。
8. ${DISH_LOAD_INSTRUCTION}
9. 以下のJSON構造で、"plan"配列の中に上記の食事枠と同じ件数だけレシピデータを格納して返してください。"date"と"meal_slot"は依頼された値と完全に一致させてください（meal_slotは"lunch"または"dinner"）。これ以外のテキストは一切含めないでください。
{
  "plan": [
    {
      "date": "2026-09-02",
      "meal_slot": "dinner",
      "title": "料理名",
      "time": "調理時間目安（例：15分）",
      "genre": "和食",
      "dish_badge": "🍽️ 洗い物少なめ（2点）",
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

    const response = await generateWithRetry(ai, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 6000 },
      }
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || response.text || '';
    if (!text) throw new Error('AI output was empty');

    const json = JSON.parse(text);
    return NextResponse.json({
      ...json,
      weeklyTargets: { calories: weeklyCalories, protein_g: weeklyProtein, fat_g: weeklyFat, carbs_g: weeklyCarbs },
    });

  } catch (error: any) {
    console.error('Weekly Plan Gen Error:', error);
    const status = error?.status || error?.httpStatusCode || error?.code;
    if (status === 429 || status === 503 || status === 'UNAVAILABLE') {
      return NextResponse.json({
        error: language === 'en'
          ? 'The AI model is temporarily busy. Please try again in a moment.'
          : 'AIモデルが一時的に混雑しています。しばらく時間をおいてから再度お試しください。',
      }, { status: 503 });
    }
    return NextResponse.json({
      error: language === 'en'
        ? `Failed to generate weekly plan: ${error.message}`
        : `週間献立の生成に失敗しました: ${error.message}`,
    }, { status: 500 });
  }
}
