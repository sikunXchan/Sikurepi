import { NextResponse } from 'next/server';
import { ai, generateWithRetry, buildProfileSection, buildClimateSection, buildSeasoningSection, DISH_LOAD_INSTRUCTION } from '@/lib/ai';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      ingredients = [],
      pinnedIngredients = [],
      conditions,
      instruction,
      servings,
      climate,
      profile,
      userProfile,
      recentHistory,
      mode,
    } = body;

    const actualProfile = userProfile || profile;
    const isFreeMode = mode === 'free' || !ingredients || ingredients.length === 0;

    const ingredientsSection = isFreeMode
      ? `【作成方針】\n冷蔵庫の在庫に縛られず、自由でおいしく栄養バランスの良いレシピを提案してください。\n`
      : `【現在の在庫食材】\n${ingredients.join(', ')}\n`;

    const pinnedSection = !isFreeMode && pinnedIngredients && pinnedIngredients.length > 0
      ? `\n【ピン留め食材（これらを必ず主役・または必須で使用してください！）】\n${pinnedIngredients.join(', ')}\n`
      : '';

    const conditionsSection = conditions && conditions.length > 0
      ? `\n【重要：選択された調理条件】\n${conditions.join('、')}\n`
      : '';

    // 気候・環境連動セクション
    const climateSection = buildClimateSection(climate);

    // ユーザープロファイル（マイ一括設定）セクション
    const profileSection = buildProfileSection(actualProfile);
    const seasoningSection = buildSeasoningSection(actualProfile?.assumeSeasoningsAvailable !== false);

    const historyNote = Array.isArray(recentHistory) && recentHistory.length > 0
      ? `\n【直近の料理履歴（マンネリ防止のため、これらと異なる料理を提案してください）】\n${recentHistory.join('、')}\n`
      : '';

    const targetServings = servings || actualProfile?.servings || 2;
    const servingsSection = `\n【分量指定】\nすべてのレシピの材料・分量は ${targetServings}人分 で記載してください。\n`;

    const prompt = `あなたは経験豊富なプロの管理栄養士兼シェフです。${isFreeMode ? 'おすすめの絶品料理' : '以下の在庫食材を使った料理'}を、現在の気候やユーザーの好みにぴったりな形で家庭で再現できるよう提案してください。
${ingredientsSection}
${seasoningSection}${pinnedSection}${climateSection}${profileSection}${conditionsSection}${servingsSection}${instruction ? `\n【ユーザーからの追加指示】\n${instruction}\n` : ''}${historyNote}

【重要・厳守事項】
1. ピン留め食材がある場合、それらを「主役」として扱うか、レシピに「必ず」組み込んでください。
2. 気候や気温（猛暑、寒さ、雨など）に合った最適な温度感・味付け（さっぱり、温まるなど）を取り入れてください。
3. 【絶対除外食材】が指定されている場合は、該当食材やその類縁食材を一切使用しないでください。
4. 【栄養バランス】すべてのレシピでPFCバランス（タンパク質・脂質・炭水化物）を計算し、1人分あたりの推定栄養価（カロリー, タンパク質g, 脂質g, 炭水化物g）を算出してください。
5. 【手順の具体性】各ステップには必ず「中火で3分」「表面がこんがりきつね色になるまで」など、温度・火加減・時間・視覚的なキューを含めてください。
6. ${DISH_LOAD_INSTRUCTION}
7. 以下のJSON構造で、"recipes"配列の中に複数のレシピデータを格納して返してください。"climate_badge"には気候マッチ度を示す短いタグ（例：「☀️ 猛暑に最適」「🌧️ 体ポカポカ」など）を記載してください。また"cooking_tips"配列に食材や気候に関連するコツ・保存方法・栄養豆知識を3件含めてください。これ以外のテキストは一切含めないでください。
{
  "recipes": [
    {
      "title": "料理名",
      "time": "調理時間目安（例：15分）",
      "genre": "和食",
      "climate_badge": "☀️ 猛暑に最適",
      "dish_badge": "🍽️ 洗い物少なめ（2点）",
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
genreは「和食」「洋食」「中華」「アジア料理」「イタリアン」「フレンチ」「その他」から選んでください。`;

    const response = await generateWithRetry(ai, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 4000 },
      }
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || response.text || '';
    if (!text) throw new Error('AI output was empty');

    const json = JSON.parse(text);
    return NextResponse.json(json);

  } catch (error: any) {
    console.error('Recipe Gen Error:', error);
    const status = error?.status || error?.httpStatusCode || error?.code;
    if (status === 429 || status === 503 || status === 'UNAVAILABLE') {
      return NextResponse.json({ error: 'AIモデルが一時的に混雑しています。しばらく時間をおいてから再度お試しください。' }, { status: 503 });
    }
    return NextResponse.json({ error: `レシピの生成に失敗しました: ${error.message}` }, { status: 500 });
  }
}
