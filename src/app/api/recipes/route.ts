import { NextResponse } from 'next/server';
import { ai, generateWithRetry, buildProfileSection, buildClimateSection, buildSeasoningSection, buildLanguageSection, DISH_LOAD_INSTRUCTION, FLAVOR_INTENSITY_INSTRUCTION, Language } from '@/lib/ai';

export async function POST(req: Request) {
  let language: Language = 'ja';
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
      likedRecipeSummary,
      mode,
      mealStyle,
    } = body;
    language = body.language === 'en' ? 'en' : 'ja';

    const actualProfile = userProfile || profile;
    const isFreeMode = mode === 'free' || !ingredients || ingredients.length === 0;
    const isSetMeal = mealStyle === 'set';

    const ingredientsSection = isFreeMode
      ? `【作成方針】\n冷蔵庫の在庫に縛られず、自由でおいしく栄養バランスの良いレシピを提案してください。\n`
      : `【現在の在庫食材】\n${ingredients.join(', ')}\n【重要：在庫優先の原則】これらの在庫食材をできるだけ中心に据えて構成し、在庫にない食材の追加は「その料理を成立させるために本当に必要なもの」に限定してください。在庫食材だけでは品数が少なく完全な一皿になりにくい場合も、無関係な食材を大量に追加するのではなく、在庫食材の分量を増やしたり調理法を工夫したりして対応することを優先してください。\n`;

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

    // ユーザーが「気に入って保存した」レシピの履歴から、好みの傾向をAIに学習させる。
    // 同じ料理を繰り返させるのではなく、傾向（ジャンル・味付けの系統）を汲み取って
    // 新しい提案の精度を上げるための参考情報として渡す。
    const tasteLearningSection = Array.isArray(likedRecipeSummary) && likedRecipeSummary.length > 0
      ? `\n【このユーザーが過去に気に入って保存したレシピ（好みの学習用の参考情報）】\n${likedRecipeSummary
          .map((r: { title?: string; genre?: string | null }) => `・${r.title}${r.genre ? `（${r.genre}）` : ''}`)
          .join('\n')}\nこれらから読み取れる味付け・ジャンル・食材選びの傾向をくみ取り、同じ料理を繰り返すのではなく「この人がきっと美味しいと感じるであろう」新しい一皿の精度を高めるための参考にしてください。\n`
      : '';

    const targetServings = servings || 2;
    const servingsSection = `\n【分量指定】\nすべてのレシピの材料・分量は ${targetServings}人分 で記載してください。\n`;
    const languageSection = buildLanguageSection(language);
    const mealStyleSection = isSetMeal
      ? `\n【重要：定食セット構成】\n単品の料理候補を複数出すのではなく、主菜1品・副菜1〜2品・汁物1品（和食以外のジャンルなら、それに相当する主菜・副菜・スープ等の構成でよい）からなる、レストランの定食のような統一感のある「1組のセット」を提案してください。全体で1食分として栄養バランスが良くなるよう調整してください。各レシピの"course"には「主菜」「副菜」「汁物」「ご飯・主食」のいずれかを必ず指定してください${language === 'en' ? '（courseの値は必ずこの日本語表記のまま出力し、翻訳しないでください。表示側で翻訳します）' : ''}。\n【最優先で厳守：セット内の変化・メリハリ】「統一感」は食卓としての相性の良さを指すのであって、似た味・似た食材を繰り返すことではありません。以下を必ず守ってください。\n・主菜で使うメインの調味料・味の系統（醤油ベース、味噌ベース、塩・酸味系、スパイシー系など）を、副菜・汁物ではそのまま繰り返さず、意図的に変えてください（例：主菜が醤油だれの照り焼きなら、副菜は塩味や酢の物、汁物は味噌汁ではなく澄まし汁や別の出汁にするなど）。\n・主菜で使うメイン食材（肉・魚など）を副菜・汁物でそのまま主役として重複させないでください。食感も、主菜がジューシー・こってり系なら副菜はシャキシャキ・さっぱり系にするなど、セット全体で単調にならないようにしてください。\n・こうすることで、一口ごとに違う美味しさが感じられる「メリハリのある定食」に仕上げてください。\n`
      : '';

    const prompt = `あなたは経験豊富なプロの管理栄養士兼シェフです。${isFreeMode ? 'おすすめの絶品料理' : '以下の在庫食材を使った料理'}を、現在の気候やユーザーの好みにぴったりな形で家庭で再現できるよう提案してください。
${ingredientsSection}
${seasoningSection}${FLAVOR_INTENSITY_INSTRUCTION}${pinnedSection}${climateSection}${profileSection}${conditionsSection}${servingsSection}${instruction ? `\n【ユーザーからの追加指示】\n${instruction}\n` : ''}${historyNote}${tasteLearningSection}${languageSection}${mealStyleSection}

【重要・厳守事項】
1. ピン留め食材がある場合、それらを「主役」として扱うか、レシピに「必ず」組み込んでください。
2. 気候や気温（猛暑、寒さ、雨など）に合った最適な温度感・味付け（さっぱり、温まるなど）を取り入れてください。
3. 【絶対除外食材】が指定されている場合は、該当食材やその類縁食材を一切使用しないでください。
4. 【栄養バランス】すべてのレシピでPFCバランス（タンパク質・脂質・炭水化物）を計算し、1人分あたりの推定栄養価（カロリー, タンパク質g, 脂質g, 炭水化物g）を算出してください。
5. 【手順の具体性】各ステップには必ず「中火で3分」「表面がこんがりきつね色になるまで」など、温度・火加減・時間・視覚的なキューを含めてください。
6. 【本当に美味しい仕上がりへのこだわり】提案する前に、実際に味見したときの味を頭の中で具体的に想像してください。甘味・塩味・酸味・苦味・旨味のバランス、香りの立たせ方（仕上げのひと振り・香味油・薬味など）、食感のコントラスト（カリカリ×とろとろ等）のうち最低1つは意識的に取り入れ、単に食材を組み合わせただけの平凡な一皿ではなく「これは美味しそう」と一目で伝わる工夫を必ず盛り込んでください。
7. ${DISH_LOAD_INSTRUCTION}
8. ${isSetMeal
        ? '以下のJSON構造で、"recipes"配列の中に定食セットを構成する各品(主菜・副菜・汁物など、通常3〜4品)のレシピデータを格納して返してください。'
        : '以下のJSON構造で、"recipes"配列の中に複数の独立した料理の候補データを格納して返してください。'
      }"climate_badge"には気候マッチ度を示す短いタグ（例：「☀️ 猛暑に最適」「🌧️ 体ポカポカ」など）を記載してください。また"cooking_tips"配列に食材や気候に関連するコツ・保存方法・栄養豆知識を3件含めてください。これ以外のテキストは一切含めないでください。
{
  "recipes": [
    {
      "title": "料理名",
      "time": "調理時間目安（例：15分）",
      "genre": "和食",
      "climate_badge": "☀️ 猛暑に最適",
      "dish_badge": "🍽️ 洗い物少なめ（2点）",${isSetMeal ? '\n      "course": "主菜（または副菜・汁物・ご飯・主食）",' : ''}
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

    const response = await generateWithRetry(ai, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        // 「本当に美味しい一皿」への工夫を考えさせる分、思考の余地を少し広げる
        thinkingConfig: { thinkingBudget: 6000 },
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
      return NextResponse.json({
        error: language === 'en'
          ? 'The AI model is temporarily busy. Please try again in a moment.'
          : 'AIモデルが一時的に混雑しています。しばらく時間をおいてから再度お試しください。',
      }, { status: 503 });
    }
    return NextResponse.json({
      error: language === 'en'
        ? `Failed to generate recipes: ${error.message}`
        : `レシピの生成に失敗しました: ${error.message}`,
    }, { status: 500 });
  }
}
