"use client";

// 食材名のAI判定(API方式)
//
// CATEGORY_RULES / ICON_KEYWORDS / PANTRY_STAPLES は日本語キーワードの正規表現・
// 文字列一致のみで判定しているため、英語などそれ以外の言語で食材名を入力すると
// 一切マッチしない(必ず「その他」・プレースホルダーアイコン・常備調味料扱い外になる)。
// この静的判定が外れた場合にだけ、/api/classify-ingredient を1回呼び、AIに
// 既存のカテゴリ・アイコンslug一覧の中から最も近いものを選ばせる。
//
// (経緯) 当初はブラウザ上で完全オフライン動作する埋め込みモデル(EmbeddingGemma +
// Transformers.js + Web Worker)を実装したが、実機で300Mパラメータのモデルをロード
// した際にメモリ不足でタブがクラッシュする不具合が実機検証で判明したため撤回し、
// 軽量なAPI呼び出し(Gemini Flash-Lite、1回あたり1円未満)方式に切り替えた。

export type IngredientSemanticMatch = {
  category: string | null;
  iconSlug: string | null;
  isStaple: boolean;
};

export async function matchIngredientSemantic(name: string): Promise<IngredientSemanticMatch | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  try {
    const res = await fetch('/api/classify-ingredient', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      category: data.category ?? null,
      iconSlug: data.iconSlug ?? null,
      isStaple: data.isStaple === true,
    };
  } catch (err) {
    // オフライン・通信エラー等、理由を問わず失敗したら静的判定のみへフォールバックする
    console.warn('Ingredient classify request failed, falling back to static rules only:', err);
    return null;
  }
}

// --- アイコン専用の軽量ラッパー: IngredientIcon.tsx から呼び出す ---
// 同じ食材名について何度もAPIを呼ばないよう、解決済み結果をメモリ内キャッシュし、
// 未解決の間は他の呼び出し元にも「解決中」であることを共有する(多重リクエスト防止)。
const resolvedIconCache = new Map<string, string | null>();
const iconInFlight = new Map<string, Promise<string | null>>();
const iconListeners = new Set<() => void>();

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function getResolvedIconSlug(name: string): string | null | undefined {
  return resolvedIconCache.get(normalizeName(name));
}

export function subscribeIconResolved(fn: () => void): () => void {
  iconListeners.add(fn);
  return () => iconListeners.delete(fn);
}

// fire-and-forget: 呼び出し側はPromiseを待たず、後からsubscribeIconResolvedの通知を
// 受けて再レンダリングする想定(在庫追加のUIを一切ブロックしないため)。
export function requestIconMatch(name: string): void {
  const key = normalizeName(name);
  if (!key || resolvedIconCache.has(key) || iconInFlight.has(key)) return;

  const task = matchIngredientSemantic(name)
    .then((result) => {
      resolvedIconCache.set(key, result?.iconSlug ?? null);
      iconInFlight.delete(key);
      iconListeners.forEach((fn) => fn());
      return result?.iconSlug ?? null;
    })
    .catch(() => {
      resolvedIconCache.set(key, null);
      iconInFlight.delete(key);
      return null;
    });
  iconInFlight.set(key, task);
}
