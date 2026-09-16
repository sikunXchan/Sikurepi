import { isCommunityRecipe, serializeCommunityRecipeIdentity, type CommunityRecipe } from './communityRecipeSchema.ts';

export type FeedbackSyncStatus = 'saved' | 'local-only' | 'pending' | 'service-unavailable' | 'failed';
export type CommunityFeedbackPayload = {
  recipe: CommunityRecipe;
  deviceId: string;
  rating: 1 | -1;
  note: string;
  source: 'generation' | 'completion';
  publish: boolean;
};
type Entry = { id: string; key: string; payload: CommunityFeedbackPayload; status: FeedbackSyncStatus };
const KEY = 'sikurepi_community_feedback_outbox_v1';
export const COMMUNITY_FEEDBACK_SYNC_EVENT = 'community-feedback-sync-updated';
const receipts = new Map<string, FeedbackSyncStatus>();
let active: Promise<boolean> | null = null;

function identity(payload: CommunityFeedbackPayload): string {
  return JSON.stringify([payload.deviceId, serializeCommunityRecipeIdentity(payload.recipe)]);
}

function read(): Entry[] {
  if (typeof window === 'undefined') return [];
  try {
    const items: unknown = JSON.parse(window.localStorage.getItem(KEY) || '[]');
    return Array.isArray(items) ? items.filter(item =>
      item?.id && item?.key && isCommunityRecipe(item?.payload?.recipe)
      && typeof item.payload.deviceId === 'string' && [1, -1].includes(item.payload.rating),
    ) : [];
  } catch { return []; }
}

function write(items: Entry[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
    return true;
  } catch { return false; }
}

function notify(): void {
  window.dispatchEvent(new Event(COMMUNITY_FEEDBACK_SYNC_EVENT));
}

export function getFeedbackSyncStatus(recipe: CommunityRecipe, deviceId: string): FeedbackSyncStatus | null {
  const key = identity({ recipe, deviceId } as CommunityFeedbackPayload);
  return read().find(item => item.key === key)?.status || receipts.get(key) || null;
}

async function post(payload: CommunityFeedbackPayload): Promise<FeedbackSyncStatus> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('/api/community-recipes/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (['COMMUNITY_NOT_CONFIGURED', 'COMMUNITY_SCHEMA_MISSING', 'COMMUNITY_ACCESS_DENIED'].includes(data?.code)) {
        return 'service-unavailable';
      }
      return response.status === 400 ? 'failed' : 'pending';
    }
    // 旧APIの「設定がなくてもaccepted=true」は送信完了として扱わない。
    if (data?.reason === 'local-only') return 'service-unavailable';
    if (data?.accepted !== true) return 'pending';
    if (data.rankingUpdated === false) return 'local-only';
    return data.rankingUpdated === true && typeof data.recipeId === 'string' ? 'saved' : 'pending';
  } catch { return 'pending'; }
  finally { clearTimeout(timeout); }
}

export function flushCommunityFeedbackOutbox(): Promise<boolean> {
  if (active) return active;
  // Promiseを先に設定し、同期イベント・同時投稿でも送信ループは一本にする。
  active = Promise.resolve().then(async () => {
    while (true) {
      const entry = read()[0];
      if (!entry) return true;
      const result = await post(entry.payload);
      const latest = read();
      const stillCurrent = latest.some(item => item.id === entry.id);
      if (!stillCurrent) continue; // 送信中の評価変更を古い結果で消さない。
      if (result === 'saved' || result === 'local-only') {
        if (!write(latest.filter(item => item.id !== entry.id))) return false;
        receipts.set(entry.key, result);
        if (result === 'saved') window.dispatchEvent(new Event('community-recipes-changed'));
      } else {
        write(latest.map(item => item.id === entry.id ? { ...item, status: result } : item));
        notify();
        return false;
      }
      notify();
    }
  }).finally(() => { active = null; });
  return active;
}

export async function queueCommunityFeedback(payload: CommunityFeedbackPayload): Promise<FeedbackSyncStatus> {
  const key = identity(payload);
  const entry: Entry = { id: crypto.randomUUID(), key, payload, status: 'pending' };
  const previous = read().filter(item => item.key !== key);
  // 同じ端末・同じ料理の連打や再送は、最新の評価だけを残す。
  if (!write([...previous, entry])) return 'failed';
  receipts.delete(key);
  notify();
  await flushCommunityFeedbackOutbox();
  return getFeedbackSyncStatus(payload.recipe, payload.deviceId) || 'pending';
}
