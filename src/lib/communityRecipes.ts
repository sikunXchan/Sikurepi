export type ShareableRecipe = {
  title: string;
  time: string;
  ingredients: { name: string; amount: string }[];
  steps: string[];
  tips: string;
  genre?: string | null;
  dish_badge?: string | null;
  nutrition?: {
    calories: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
  } | null;
};

type QueuedCommunityRecipe = {
  id: string;
  recipe: ShareableRecipe;
};

const OUTBOX_KEY = 'sikurepi_community_recipe_outbox_v1';
let activeFlush: Promise<boolean> | null = null;

function readOutbox(): QueuedCommunityRecipe[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(OUTBOX_KEY) || '[]');
    return Array.isArray(value)
      ? value.filter((item): item is QueuedCommunityRecipe => Boolean(item?.id && item?.recipe?.title))
      : [];
  } catch {
    return [];
  }
}

function writeOutbox(items: QueuedCommunityRecipe[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

function createQueueId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function postRecipes(recipes: ShareableRecipe[]): Promise<boolean> {
  const response = await fetch('/api/community-recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipes }),
  });
  return response.ok;
}

/** 保存済みの送信待ちレシピを古い順に再送する。重複flushは1本にまとめる。 */
export function flushCommunityRecipeOutbox(): Promise<boolean> {
  if (activeFlush) return activeFlush;
  activeFlush = (async () => {
    try {
      // APIの一括上限に合わせ、成功した塊だけをキューから除去する。
      // 送信中に別の生成が完了して追加された項目も、空になるまで続けて扱う。
      while (true) {
        const batch = readOutbox().slice(0, 14);
        if (batch.length === 0) return true;
        if (!(await postRecipes(batch.map((item) => item.recipe)))) return false;
        const sentIds = new Set(batch.map((item) => item.id));
        if (!writeOutbox(readOutbox().filter((item) => !sentIds.has(item.id)))) return false;
      }
    } catch {
      return false;
    }
  })().finally(() => {
    activeFlush = null;
  });
  return activeFlush;
}

// 自由記述・在庫・アレルギー設定などは送らず、AIが完成させたレシピ本文だけを共有する。
// 共有失敗は生成自体を失敗扱いにせず、端末内の送信待ちキューから次回再送する。
export async function shareGeneratedRecipes(recipes: ShareableRecipe[]): Promise<boolean> {
  if (recipes.length === 0) return true;

  const queued = recipes.map((recipe) => ({ id: createQueueId(), recipe }));
  if (!writeOutbox([...readOutbox(), ...queued])) {
    try {
      return await postRecipes(recipes);
    } catch {
      return false;
    }
  }
  return flushCommunityRecipeOutbox();
}
