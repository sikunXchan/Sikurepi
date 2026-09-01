import { NextResponse } from 'next/server';
import { ai, generateWithRetry } from '@/lib/ai';

export async function POST(req: Request) {
  try {
    const { recipe } = await req.json();
    
    if (!recipe) {
      return NextResponse.json({ error: 'Original recipe required' }, { status: 400 });
    }

    const prompt = `あなたは残り物を絶品料理に変えることで定評のあるプロシェフです。以下の既存レシピ（残り物）をベースに、全く別の料理に生まれ変わらせる「アレンジ（リメイク）」レシピを提案してください。
例：肉じゃが → コロッケ、ポトフ → カレー、野菜炒め → あんかけ焼きそば など。

【元のレシピ】
料理名: ${recipe.title}
材料: ${recipe.ingredients.map((i: any) => `${i.name} (${i.amount})`).join(', ')}

【調味料・味付けの前提】
塩・こしょう・砂糖・醤油・味噌・みりん・酒・酢・サラダ油・ごま油・バター・だし（顆粒和風だし/コンソメ/鶏がらスープの素）・ケチャップ・マヨネーズ・にんにく・しょうがなどの基本的な調味料は「常備されている」前提で自由に使用してください。

【要件】
1. 元の料理の面影を残しつつ、全く新しい料理の名前にしてください。
2. 味付けは「ぼやけない・しっかりした美味しさ」を最優先し、すべての調味料の分量を「大さじ・小さじ・g」など具体的な数値で必ず明記してください。
3. 【質のポイント】食感のコントラスト（サクサク×とろとろなど）、旨み・酸味・甘み・塩味のバランスを意識して設計してください。
4. 【手順の具体性】各ステップには「中火で3分」「表面がこんがりきつね色になるまで」など、温度・火加減・時間・視覚的なキューを必ず含めてください。
5. 【栄養価】リメイク後1人分あたりのPFC栄養素（calories, protein_g, fat_g, carbs_g）を算出してください。
6. 以下のJSON構造で返してください。これ以外のテキストは一切含めないでください。
{
  "title": "リメイク後の料理名",
  "time": "調理時間目安（例：15分）",
  "genre": "和食",
  "ingredients": [
    { "name": "具材名または調味料", "amount": "分量（例：醤油 大さじ2、砂糖 小さじ1など）" }
  ],
  "steps": ["手順1", "手順2..."],
  "tips": "リメイクのポイント",
  "nutrition": { "calories": 400, "protein_g": 25, "fat_g": 10, "carbs_g": 40 }
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
    console.error('Remake Gen Error:', error);
    const status = error?.status || error?.httpStatusCode || error?.code;
    if (status === 429 || status === 503 || status === 'UNAVAILABLE') {
      return NextResponse.json({ error: 'AIモデルが一時的に混雑しています。しばらく時間をおいてから再度お試しください。' }, { status: 503 });
    }
    return NextResponse.json({ error: `リメイクレシピの生成に失敗しました: ${error.message}` }, { status: 500 });
  }
}
