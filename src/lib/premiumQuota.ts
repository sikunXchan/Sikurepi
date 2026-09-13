export const FREE_WEEKLY_PLAN_GENERATIONS = 1;
export const FREE_DAILY_RECIPE_CREDITS = 3;
export const SINGLE_RECIPE_GENERATION_COST = 1;
export const SET_RECIPE_GENERATION_COST = 3;
export const FREE_DAILY_RECEIPT_SCANS = 1;
export const FREE_HISTORY_ITEMS = 3;
export const FREE_COMMUNITY_RECIPE_ITEMS = 1;

export type FreeGenerationUsage = {
  weekStart: string;
  count: number;
};

export type DailyFeatureUsage = {
  date: string;
  count: number;
};

export function getLocalDateKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 端末の現地時間で月曜日を週の開始日にする。
export function getGenerationWeekKey(now: Date = new Date()): string {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  const year = start.getFullYear();
  const month = String(start.getMonth() + 1).padStart(2, "0");
  const day = String(start.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeFreeGenerationUsage(
  stored: unknown,
  now: Date = new Date(),
): FreeGenerationUsage {
  const currentWeek = getGenerationWeekKey(now);

  // 旧版の累積数値を現在週の利用回数として一度だけ移行する。
  if (typeof stored === "number") {
    return { weekStart: currentWeek, count: Math.max(0, Math.floor(stored)) };
  }

  if (stored && typeof stored === "object") {
    const candidate = stored as Partial<FreeGenerationUsage>;
    if (candidate.weekStart === currentWeek && typeof candidate.count === "number") {
      return { weekStart: currentWeek, count: Math.max(0, Math.floor(candidate.count)) };
    }
  }

  return { weekStart: currentWeek, count: 0 };
}

export function normalizeDailyFeatureUsage(
  stored: unknown,
  now: Date = new Date(),
): DailyFeatureUsage {
  const today = getLocalDateKey(now);
  if (stored && typeof stored === "object") {
    const candidate = stored as Partial<DailyFeatureUsage>;
    if (candidate.date === today && typeof candidate.count === "number") {
      return { date: today, count: Math.max(0, Math.floor(candidate.count)) };
    }
  }
  return { date: today, count: 0 };
}

export function getRecipeGenerationCost(mealStyle: "single" | "set"): number {
  return mealStyle === "set" ? SET_RECIPE_GENERATION_COST : SINGLE_RECIPE_GENERATION_COST;
}
