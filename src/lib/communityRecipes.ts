import { getOrCreateDeviceId, type RecipeFeedbackRating } from './storage';
import { serializeCommunityRecipeIdentity, type CommunityRecipe } from './communityRecipeSchema';
import { queueCommunityFeedback, type FeedbackSyncStatus } from './communityFeedbackQueue';

export type ShareableRecipe = CommunityRecipe;

type QueuedCommunityRecipe = {
  id: string;
  recipe: ShareableRecipe;
};

const OUTBOX_KEY = 'sikurepi_community_recipe_outbox_v1';
const LOCAL_MIRROR_KEY = 'sikurepi_community_recipe_mirror_v1';
export const COMMUNITY_RECIPE_OUTBOX_EVENT = 'community-recipe-outbox-updated';
export const COMMUNITY_RECIPES_CHANGED_EVENT = 'community-recipes-changed';
let activeFlush: Promise<boolean> | null = null;
let flushRequestedWhileActive = false;

export type CommunityRecipeRowData = {
  id: string;
  likes_count: number;
  positive_ratings_count?: number;
  negative_ratings_count?: number;
  ranking_score?: number;
  created_at?: string;
  recipe: CommunityRecipe;
  sync_status?: 'pending' | 'synced';
};

type LocalCommunityRecipe = {
  queueId: string;
  serverId?: string;
  createdAt: string;
  syncStatus: 'pending' | 'synced';
  recipe: ShareableRecipe;
};

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
    window.dispatchEvent(new Event(COMMUNITY_RECIPE_OUTBOX_EVENT));
    return true;
  } catch {
    return false;
  }
}

function readLocalMirror(): LocalCommunityRecipe[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(LOCAL_MIRROR_KEY) || '[]');
    return Array.isArray(value)
      ? value.filter((item): item is LocalCommunityRecipe => Boolean(
          item?.queueId
          && item?.createdAt
          && (item?.syncStatus === 'pending' || item?.syncStatus === 'synced')
          && item?.recipe?.title,
        ))
      : [];
  } catch {
    return [];
  }
}

function writeLocalMirror(items: LocalCommunityRecipe[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // 公開した自分の料理を一覧で即座に確認するための端末内ミラー。
    // DB本体の代用にはせず、表示用に直近50件だけ保持する。
    window.localStorage.setItem(LOCAL_MIRROR_KEY, JSON.stringify(items.slice(0, 50)));
    window.dispatchEvent(new Event(COMMUNITY_RECIPES_CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

function mirrorQueuedRecipes(items: QueuedCommunityRecipe[]): void {
  if (items.length === 0) return;
  const current = readLocalMirror();
  const identities = new Set(current.map((item) => serializeCommunityRecipeIdentity(item.recipe)));
  const additions = items
    .filter((item) => {
      const identity = serializeCommunityRecipeIdentity(item.recipe);
      if (identities.has(identity)) return false;
      identities.add(identity);
      return true;
    })
    .map((item): LocalCommunityRecipe => ({
      queueId: item.id,
      createdAt: new Date().toISOString(),
      syncStatus: 'pending',
      recipe: item.recipe,
    }));
  if (additions.length > 0) writeLocalMirror([...additions, ...current]);
}

function markMirrorSynced(batch: QueuedCommunityRecipe[], serverIds: string[]): void {
  const idByIdentity = new Map(
    batch.map((item, index) => [serializeCommunityRecipeIdentity(item.recipe), serverIds[index]]),
  );
  const current = readLocalMirror();
  let changed = false;
  const next = current.map((item) => {
    const identity = serializeCommunityRecipeIdentity(item.recipe);
    if (!idByIdentity.has(identity)) return item;
    const serverId = idByIdentity.get(identity);
    changed = changed || item.syncStatus !== 'synced' || item.serverId !== serverId;
    return { ...item, syncStatus: 'synced' as const, serverId: serverId || item.serverId };
  });
  if (changed) writeLocalMirror(next);
}

/**
 * サーバーのランキング一覧に、この端末から公開した直近の料理を合成する。
 * 送信直後でも自分の料理が見え、ランキング上位20件から外れた場合も確認できる。
 */
export function mergeCommunityRecipesWithLocal(
  serverRows: CommunityRecipeRowData[],
): CommunityRecipeRowData[] {
  const validRows = serverRows.filter((row) => row?.id && row?.recipe?.title);
  if (typeof window === 'undefined') return validRows;

  const serverByIdentity = new Map(
    validRows.map((row) => [serializeCommunityRecipeIdentity(row.recipe), row]),
  );
  const localRows = readLocalMirror()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((item): CommunityRecipeRowData => {
      const identity = serializeCommunityRecipeIdentity(item.recipe);
      const serverRow = serverByIdentity.get(identity);
      serverByIdentity.delete(identity);
      return {
        id: serverRow?.id || item.serverId || `local-${item.queueId}`,
        likes_count: serverRow?.likes_count || 0,
        positive_ratings_count: serverRow?.positive_ratings_count || 0,
        negative_ratings_count: serverRow?.negative_ratings_count || 0,
        ranking_score: serverRow?.ranking_score || 0,
        created_at: serverRow?.created_at || item.createdAt,
        recipe: serverRow?.recipe || item.recipe,
        sync_status: item.syncStatus,
      };
    });

  const remainingServerRows = validRows.filter((row) =>
    serverByIdentity.has(serializeCommunityRecipeIdentity(row.recipe)),
  );
  return [...localRows, ...remainingServerRows];
}

function createQueueId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function postRecipes(recipes: ShareableRecipe[]): Promise<{ ok: boolean; ids: string[] }> {
  const response = await fetch('/api/community-recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipes }),
  });
  if (!response.ok) return { ok: false, ids: [] };
  const data = await response.json().catch(() => null);
  const ids: string[] = Array.isArray(data?.ids)
    ? data.ids.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
    : [];
  // HTTP 200だけではキューを消さない。全件のDB保存IDが返ったときだけ完了扱い。
  if (ids.length !== recipes.length) return { ok: false, ids: [] };
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(COMMUNITY_RECIPES_CHANGED_EVENT));
  return { ok: true, ids };
}

/** 保存済みの送信待ちレシピを古い順に再送する。重複flushは1本にまとめる。 */
export function flushCommunityRecipeOutbox(): Promise<boolean> {
  if (activeFlush) {
    // 既存flushが空判定を済ませた直後に新規料理が追加される競合を記録し、
    // finallyで必ずもう一度キューを確認する。
    flushRequestedWhileActive = true;
    return activeFlush;
  }
  flushRequestedWhileActive = false;
  activeFlush = (async () => {
    try {
      // APIの一括上限に合わせ、成功した塊だけをキューから除去する。
      // 送信中に別の生成が完了して追加された項目も、空になるまで続けて扱う。
      while (true) {
        const batch = readOutbox().slice(0, 14);
        if (batch.length === 0) return true;
        // 旧バージョンで既に送信待ちになっていた料理も、再送時に一覧へ復元する。
        mirrorQueuedRecipes(batch);
        const result = await postRecipes(batch.map((item) => item.recipe));
        if (!result.ok) return false;
        markMirrorSynced(batch, result.ids);
        const sentIds = new Set(batch.map((item) => item.id));
        if (!writeOutbox(readOutbox().filter((item) => !sentIds.has(item.id)))) return false;
      }
    } catch {
      return false;
    }
  })().finally(() => {
    activeFlush = null;
    if (flushRequestedWhileActive) {
      flushRequestedWhileActive = false;
      void flushCommunityRecipeOutbox();
    }
  });
  return activeFlush;
}

// 自由記述・在庫・アレルギー設定などは送らず、ユーザーが実際に作ったレシピ本文だけを共有する。
// 共有失敗は調理記録自体を失敗扱いにせず、端末内の送信待ちキューから次回再送する。
export async function shareCookedRecipes(recipes: ShareableRecipe[]): Promise<boolean> {
  if (recipes.length === 0) return true;

  const current = readOutbox();
  const queuedIdentities = new Set(current.map((item) => serializeCommunityRecipeIdentity(item.recipe)));
  const queued = recipes
    .filter((recipe) => {
      const identity = serializeCommunityRecipeIdentity(recipe);
      if (queuedIdentities.has(identity)) return false;
      queuedIdentities.add(identity);
      return true;
    })
    .map((recipe) => ({ id: createQueueId(), recipe }));
  if (queued.length === 0) return flushCommunityRecipeOutbox();
  // 通信より先に一覧へ反映し、公開操作が無反応に見えないようにする。
  mirrorQueuedRecipes(queued);
  if (!writeOutbox([...current, ...queued])) {
    try {
      const result = await postRecipes(queued.map((item) => item.recipe));
      if (result.ok) markMirrorSynced(queued, result.ids);
      return result.ok;
    } catch {
      return false;
    }
  }
  return flushCommunityRecipeOutbox();
}

export type RecipeFeedbackSubmission = {
  recipe: CommunityFeedbackRecipe;
  rating: RecipeFeedbackRating;
  note?: string;
  source: 'generation' | 'completion';
};

export type CommunityFeedbackRecipe = {
  title: string;
  time?: string;
  ingredients: { name: string; amount?: string }[];
  steps?: string[];
  tips?: string;
  genre?: string | null;
  dish_badge?: string | null;
  nutrition?: ShareableRecipe['nutrition'];
};

export type RecipeFeedbackSubmissionResult = FeedbackSyncStatus;

// タイトルだけの古い履歴など、公開レシピとして成立する本文を持たない場合も
// 個人の好み学習は端末内で継続し、ランキング送信だけを安全に省略する。
export async function submitCommunityRecipeFeedback({
  recipe,
  rating,
  note = '',
  source,
}: RecipeFeedbackSubmission): Promise<RecipeFeedbackSubmissionResult> {
  if (!recipe.time || !Array.isArray(recipe.steps) || typeof recipe.tips !== 'string') return 'local-only';
  const deviceId = getOrCreateDeviceId();
  if (!deviceId) return 'local-only';

  return queueCommunityFeedback({
    recipe: {
      ...recipe,
      time: recipe.time,
      steps: recipe.steps,
      tips: recipe.tips,
      ingredients: recipe.ingredients.map((item) => ({ name: item.name, amount: item.amount || '' })),
    },
    deviceId,
    rating: rating === 'positive' ? 1 : -1,
    note: note.slice(0, 500),
    source,
    publish: rating === 'positive',
  });
}
