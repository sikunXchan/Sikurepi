import { NextResponse } from 'next/server';
import { ai, generateWithRetry } from '@/lib/ai';
import { CATEGORY_RULES } from '@/lib/storage';
import { ICON_SLUGS } from '@/lib/ingredientIcons';

// CATEGORY_RULES / ICON_KEYWORDS / PANTRY_STAPLES は日本語キーワードの正規表現・
// 文字列一致のみで判定しているため、英語などそれ以外の言語で食材名を入力すると
// 一切マッチしない(必ず「その他」・プレースホルダーアイコン・常備調味料扱い外になる)。
// この静的判定が外れた場合にだけ、この軽量なAPIを1回呼び、既存のカテゴリ・アイコン
// slug一覧の中から最も近いものをAIに選ばせる。
//
// (経緯) 当初はブラウザ上で完全オフライン動作する埋め込みモデル(EmbeddingGemma +
// Transformers.js)を試したが、実機で300Mパラメータのモデルをロードした際にメモリ
// 不足でタブがクラッシュする不具合が発生したため撤回し、軽量・低コストなAPI呼び出し
// (Gemini Flash-Lite)方式に切り替えた。

const CLASSIFY_MODELS = ['models/gemini-2.5-flash-lite', 'models/gemini-2.5-flash'];

const CATEGORY_OPTIONS = [...new Set(CATEGORY_RULES.map((r) => r.category))].concat('その他');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const prompt = `以下の食材名(日本語以外の表記の場合があります)について、既存の分類システムに合わせて判定してください。

食材名: "${name}"

以下のJSON形式のみで回答してください（他のテキストは一切含めないでください）:
{
  "category": "以下の日本語カテゴリから最も近いものを1つ（該当なしは"その他"）: ${CATEGORY_OPTIONS.join('、')}",
  "iconSlug": "以下のアイコンID一覧から最も近いものを1つ（該当なしはnull）: ${ICON_SLUGS.join(', ')}",
  "isStaple": "塩・こしょう・砂糖・醤油・味噌・みりん・酒・酢・油・だし・ケチャップ・マヨネーズ・にんにく・しょうが等、家庭に常備されている基本調味料に該当するか(true/false)"
}`;

    const response = await generateWithRetry(
      ai,
      {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
        },
      },
      CLASSIFY_MODELS
    );

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || response.text || '';
    if (!text) throw new Error('AI output was empty');

    const json = JSON.parse(text);
    const category = typeof json.category === 'string' && CATEGORY_OPTIONS.includes(json.category) ? json.category : null;
    const iconSlug = typeof json.iconSlug === 'string' && ICON_SLUGS.includes(json.iconSlug) ? json.iconSlug : null;
    const isStaple = json.isStaple === true;

    return NextResponse.json({ category, iconSlug, isStaple });
  } catch (error: any) {
    console.error('Ingredient Classify Error:', error);
    return NextResponse.json({ error: `食材の判定に失敗しました: ${error.message}` }, { status: 500 });
  }
}
