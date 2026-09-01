import { NextResponse } from 'next/server';
import { ai, generateWithRetry } from '@/lib/ai';
import { getRecentRecipeNames } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/user';

export async function POST(req: Request) {
  try {
    const userId = getUserIdFromRequest(req);
    const body = await req.json();
    const {
      ingredients,
      pinnedIngredients,
      conditions,
      instruction,
      servings,
    } = body;

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return NextResponse.json({ error: 'Ingredients array required' }, { status: 400 });
    }

    const pinnedSection = pinnedIngredients && pinnedIngredients.length > 0
      ? `\n【ピン留め食材（これらを必ず主役・または必須で使用してください！）】\n${pinnedIngredients.join(', ')}\n`
      : '';

    const conditionsSection = conditions && conditions.length > 0
      ? `\n【重要：守るべき調理条件】\n${conditions.join('、')}\n`
      : '';

    const recentNames = await getRecentRecipeNames(5, userId);
    const historyNote = recentNames.length > 0
      ? `\n【直近の料理履歴（マンネリ防止のため、これらと異なる料理を提案してください）】\n${recentNames.join('、')}\n`
      : '';

    const servingsSection = servings
      ? `\n【分量指定】\nすべてのレシピの材料・分量は ${servings}人分 で記載してください。\n`
      : '';

    const seasoningSection = `\n【調味料・味付けの前提】\n塩・こしょう・砂糖・醤油・味噌・みりん・酒・酢・サラダ油・ごま油・バター・だし（顆粒和風だし/コンソメ/鶏がらスープの素）・ケチャップ・マヨネーズ・にんにく・しょうがなどの基本的な調味料は「常備されている」前提で自由に使用してください。これらは在庫食材に含まれていなくても構いません。\n`;

    const prompt = `あなたは経験豊富なプロの管理栄養士兼シェフです。以下の在庫食材を使い、家庭で再現できる「本当においしく、栄養バランスの取れた」レシピを複数提案してください。
【現在の在庫食材】
${ingredients.join(', ')}
${seasoningSection}${pinnedSection}${conditionsSection}${servingsSection}${instruction ? `\n【ユーザーからのカスタム指示】\n${instruction}\n` : ''}${historyNote}

【重要・厳守事項】
1. ピン留め食材がある場合、それらを「主役」として扱うか、レシピに「必ず」組み込んでください。
2. 調理条件（低カロリー、時短など）が指定されている場合、必ずその条件を満たすレシピにしてください。
3. 味付けは「ぼやけない・しっかりした美味しさ」を最優先してください。基本調味料を積極的に使い、すべての調味料について分量を「大さじ・小さじ・g」など具体的な数値で必ず明記してください（「適量」「少々」は塩・こしょうなど一部の仕上げ調味料のみ許可）。各レシピが料理として味が決まる仕上がりになるよう設計してください。
4. 【栄養バランス】すべてのレシピでPFCバランス（タンパク質・脂質・炭水化物）を計算し、1人分あたりの推定栄養価（カロリー, タンパク質g, 脂質g, 炭水化物g）を算出してください。
5. 【手順の具体性】各ステップには必ず「中火で3分」「表面がこんがりきつね色になるまで」など、温度・火加減・時間・視覚的なキューを含めてください。
6. 以下のJSON構造で、"recipes"配列の中に複数のレシピデータを格納して返してください。また"cooking_tips"配列に食材に関連するコツ・保存方法・栄養豆知識を3件含めてください。これ以外のテキストは一切含めないでください。
{
  "recipes": [
    {
      "title": "料理名",
      "time": "調理時間目安（例：15分）",
      "genre": "和食",
      "ingredients": [
        { "name": "使用する具材または調味料", "amount": "分量の目安（例：鶏もも肉200g、玉ねぎ1/2個、醤油 大さじ2、砂糖 小さじ1など）" }
      ],
      "steps": ["手順1", "手順2", "手順3..."],
      "tips": "調理のコツ・アドバイス",
      "nutrition": { "calories": 450, "protein_g": 30, "fat_g": 12, "carbs_g": 45 }
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
