import { NextResponse } from 'next/server';
import { ai, generateWithRetry } from '@/lib/ai';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// ホームタブ「今日のおすすめ」用のAPI。
// 全ユーザー共通で1日1件のレシピを見せたいので、ユーザーごとの在庫には
// 縛られない一般的な家庭料理をAIに考案させ、Supabase(daily_picksテーブル)に
// 日付をキーにキャッシュする。同日2回目以降のアクセスは生成せずキャッシュを返す。
// (Supabase未設定のローカルのみの利用環境では、キャッシュせずその場で生成するだけ
// になる = 呼び出すたびに違う提案になる)

type BilingualText = { ja: string; en: string };

export type DailyPickRecipe = {
  title: BilingualText;
  tagline: BilingualText;
  time: string;
  genre: string;
  dish_badge?: string;
  ingredients: { name: BilingualText; amount: BilingualText }[];
  steps: BilingualText[];
  tips: BilingualText;
};

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

async function generateDailyPickRecipe(): Promise<DailyPickRecipe> {
  const prompt = `あなたはプロの管理栄養士兼シェフです。特定のユーザーの在庫には縛られず、アプリの「今日のおすすめ」として誰にでもおすすめできる、季節感があり作りやすい家庭料理を1品だけ考案してください。

JSON形式のみで、日本語(ja)と英語(en)の両方の文言を必ず含めて返してください（他のテキストは一切含めないでください）:
{
  "title": { "ja": "料理名", "en": "Dish name" },
  "tagline": { "ja": "短いキャッチコピー（例：旬の食材でおいしく！）", "en": "short catchy blurb" },
  "time": "調理時間目安（例：20分）",
  "genre": "和食",
  "dish_badge": "🍽️ 洗い物少なめ（2点）",
  "ingredients": [
    { "name": { "ja": "食材名", "en": "ingredient name" }, "amount": { "ja": "分量（例：200g）", "en": "amount (e.g. 200g)" } }
  ],
  "steps": [
    { "ja": "手順1", "en": "Step 1" }
  ],
  "tips": { "ja": "調理のコツ・豆知識", "en": "cooking tip" }
}
genreは「和食」「洋食」「中華」「アジア料理」「韓国料理」「タイ料理」「インド料理」「メキシコ料理」「中東料理」「イタリアン」「フレンチ」「スペイン料理」「ギリシャ料理」「ドイツ・中欧料理」「北欧料理」「ロシア・東欧料理」「ベトナム料理」「台湾料理」「インドネシア・マレーシア料理」「アメリカ南部料理」「モロッコ・北アフリカ料理」「エチオピア料理」「ジャマイカ・カリブ料理」「ペルー料理」「ブラジル料理」「シンガポール料理」「その他」から選び、値は必ず日本語表記のまま出力してください。`;

  const response = await generateWithRetry(ai, {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseMimeType: 'application/json' },
  });
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || response.text || '';
  if (!text) throw new Error('AI output was empty');
  return JSON.parse(text);
}

export async function GET() {
  const date = todayDateString();

  try {
    if (isSupabaseConfigured && supabase) {
      const { data: existing } = await supabase
        .from('daily_picks')
        .select('recipe')
        .eq('pick_date', date)
        .maybeSingle();
      if (existing?.recipe) {
        return NextResponse.json({ date, recipe: existing.recipe });
      }

      const recipe = await generateDailyPickRecipe();
      // 同時アクセスで既に他クライアントが挿入していた場合はpick_dateのunique制約で
      // 競合するが、ここではエラーを無視して常に最終的な行を読み直す
      // (先に挿入できた方の内容に全員揃えるため、この端末の生成結果を捨てることがある)。
      await supabase.from('daily_picks').insert({ pick_date: date, recipe });
      const { data: finalRow } = await supabase
        .from('daily_picks')
        .select('recipe')
        .eq('pick_date', date)
        .maybeSingle();
      return NextResponse.json({ date, recipe: finalRow?.recipe || recipe });
    }

    // Supabase未設定: キャッシュせずその場で生成するだけ
    const recipe = await generateDailyPickRecipe();
    return NextResponse.json({ date, recipe });
  } catch (error: any) {
    console.error('Daily Pick Error:', error);
    return NextResponse.json({ error: `今日のおすすめの取得に失敗しました: ${error.message}` }, { status: 500 });
  }
}
