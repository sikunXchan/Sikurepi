export const GUIDE_KEYS = ['home', 'inventory', 'shopping', 'recipe', 'mealPlan', 'history', 'myPage', 'receipt'] as const;
export type GuideKey = typeof GUIDE_KEYS[number];
export type GuideProgress = { welcomeDismissed: boolean; dismissed: GuideKey[] };

export function normalizeGuideProgress(value: unknown): GuideProgress {
  const entry = value && typeof value === 'object' ? value as Partial<GuideProgress> : {};
  return {
    welcomeDismissed: entry.welcomeDismissed === true,
    dismissed: Array.isArray(entry.dismissed)
      ? [...new Set(entry.dismissed.filter((key): key is GuideKey => GUIDE_KEYS.includes(key)))] : [],
  };
}

export function mergeGuideProgress(local: unknown, remote: unknown): GuideProgress {
  const a = normalizeGuideProgress(local);
  const b = normalizeGuideProgress(remote);
  return { welcomeDismissed: a.welcomeDismissed || b.welcomeDismissed, dismissed: [...new Set([...a.dismissed, ...b.dismissed])] };
}
