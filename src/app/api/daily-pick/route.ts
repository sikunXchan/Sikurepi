import { NextResponse } from 'next/server';
import { ai, generateWithRetry } from '@/lib/ai';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// ホームタブ「今日のおすすめ」用のAPI。
// 全ユーザー共通で1日1件のレシピを見せたいので、ユーザーごとの在庫には
// 縛られない一般的な家庭料理をAIに考案させ、Supabase(daily_picksテーブル)に
// 日付をキーにキャッシュする。同日2回目以降のアクセスは生成せずキャッシュを返す。
// Supabase未設定の環境でも、同一サーバーインスタンスがwarmな間はメモリキャッシュで
// 同じ日付なら同じ内容を返す(下のmemoryCache参照)。さらに生成自体もその日の日付を
// seedにしているため、何らかの理由でキャッシュを飛ばして複数回生成が走っても
// 内容が大きくは変わらないようにしている。

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

// サーバーレス環境では複数のインスタンス/呼び出しでモジュールスコープが
// 共有されないことがあるため、これだけで「1日1件」を保証できるわけではない
// (本命の保証はSupabaseのdaily_picksテーブル)。ただし同一インスタンスが
// warmなまま複数リクエストを捌く場合や、Supabase未設定のローカル/簡易環境では
// これだけでも「タブ切り替えのたびに内容が変わる」体感を大きく減らせるため、
// 軽量な追加の安全策として保持しておく。
const memoryCache = new Map<string, DailyPickRecipe>();

// Gemini呼び出しに日付由来のseedを渡すことで、キャッシュが何らかの理由で
// (端末のlocalStorage書き込み失敗、Supabase未設定など)効かず複数回生成が
// 走ってしまった場合でも、同じ日には可能な限り同じ内容が返るようにする
// (seedは「ほぼ決定的」であり100%の保証ではない点に注意)。
function seedFromDate(date: string): number {
  return Number(date.replace(/-/g, ''));
}

async function generateDailyPickRecipe(date: string): Promise<DailyPickRecipe> {
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
    config: { responseMimeType: 'application/json', seed: seedFromDate(date) },
  });
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || response.text || '';
  if (!text) throw new Error('AI output was empty');
  return JSON.parse(text);
}

export async function GET() {
  const date = todayDateString();
  // 日付が変わったら前日以前のエントリは不要なので捨てる(無限にメモリを食わないように)
  for (const key of memoryCache.keys()) {
    if (key !== date) memoryCache.delete(key);
  }

  try {
    if (isSupabaseConfigured && supabase) {
      const { data: existing } = await supabase
        .from('daily_picks')
        .select('recipe')
        .eq('pick_date', date)
        .maybeSingle();
      if (existing?.recipe) {
        memoryCache.set(date, existing.recipe);
        return NextResponse.json({ date, recipe: existing.recipe });
      }

      const recipe = memoryCache.get(date) || await generateDailyPickRecipe(date);
      // 同時アクセスで既に他クライアントが挿入していた場合はpick_dateのunique制約で
      // 競合するが、ここではエラーを無視して常に最終的な行を読み直す
      // (先に挿入できた方の内容に全員揃えるため、この端末の生成結果を捨てることがある)。
      await supabase.from('daily_picks').insert({ pick_date: date, recipe });
      const { data: finalRow } = await supabase
        .from('daily_picks')
        .select('recipe')
        .eq('pick_date', date)
        .maybeSingle();
      const finalRecipe = finalRow?.recipe || recipe;
      memoryCache.set(date, finalRecipe);
      return NextResponse.json({ date, recipe: finalRecipe });
    }

    // Supabase未設定: このサーバーインスタンスがwarmな間だけ、日付キーでメモリキャッシュする
    const cached = memoryCache.get(date);
    if (cached) {
      return NextResponse.json({ date, recipe: cached });
    }
    const recipe = await generateDailyPickRecipe(date);
    memoryCache.set(date, recipe);
    return NextResponse.json({ date, recipe });
  } catch (error: any) {
    console.error('Daily Pick Error:', error);
    return NextResponse.json({ error: `今日のおすすめの取得に失敗しました: ${error.message}` }, { status: 500 });
  }
}
