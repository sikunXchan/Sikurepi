import {
  ICON_THUMB_BASE_PATH,
  ICON_SLUGS,
  getIngredientIconCategory,
  getIngredientCategoryForName,
  getIngredientIconDisplayName,
  getIngredientIconSlug,
  type IngredientIconCategory,
} from './ingredientIcons';
import type { CookedRecord } from './storage';

export const INGREDIENT_MASTERY_THRESHOLDS = [1, 5, 15] as const;
export const STREAK_BADGE_MILESTONES = [3, 7, 14, 30] as const;

export type IngredientMasteryLevel = 0 | 1 | 2 | 3;

export type IngredientCollectionRecipe = {
  title: string;
  date: string;
  rescued: boolean;
};

export type IngredientCollectionEntry = {
  key: string;
  slug: string | null;
  imageUrl: string | null;
  displayName: string;
  category: IngredientIconCategory;
  unlocked: boolean;
  usageCount: number;
  rescueCount: number;
  firstUsedAt: string | null;
  lastUsedAt: string | null;
  masteryLevel: IngredientMasteryLevel;
  nextMasteryAt: number | null;
  recipes: IngredientCollectionRecipe[];
};

export type IngredientCollectionSummary = {
  entries: IngredientCollectionEntry[];
  totalKnown: number;
  unlockedKnown: number;
  discoveredCount: number;
  rescuedCount: number;
  completionPercent: number;
  bestStreak: number;
  nextStreakMilestone: number | null;
};

type MutableEntry = IngredientCollectionEntry & {
  seenNames: Map<string, number>;
};

function normalizeCustomKey(name: string): string {
  return name.normalize('NFKC').trim().toLocaleLowerCase();
}

function toTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getMastery(usageCount: number): Pick<IngredientCollectionEntry, 'masteryLevel' | 'nextMasteryAt'> {
  if (usageCount >= INGREDIENT_MASTERY_THRESHOLDS[2]) return { masteryLevel: 3, nextMasteryAt: null };
  if (usageCount >= INGREDIENT_MASTERY_THRESHOLDS[1]) {
    return { masteryLevel: 2, nextMasteryAt: INGREDIENT_MASTERY_THRESHOLDS[2] };
  }
  if (usageCount >= INGREDIENT_MASTERY_THRESHOLDS[0]) {
    return { masteryLevel: 1, nextMasteryAt: INGREDIENT_MASTERY_THRESHOLDS[1] };
  }
  return { masteryLevel: 0, nextMasteryAt: INGREDIENT_MASTERY_THRESHOLDS[0] };
}

function localDateKey(value: string): string | null {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateBestCookingStreak(records: CookedRecord[]): number {
  const dates = Array.from(new Set(records.map((record) => localDateKey(record.date)).filter(Boolean) as string[])).sort();
  let best = 0;
  let current = 0;
  let previous: number | null = null;

  for (const dateKey of dates) {
    const timestamp = Date.parse(`${dateKey}T00:00:00Z`);
    current = previous !== null && Math.round((timestamp - previous) / 86_400_000) === 1 ? current + 1 : 1;
    best = Math.max(best, current);
    previous = timestamp;
  }
  return best;
}

function createMutableEntry(slug: string | null, key: string, language: 'ja' | 'en'): MutableEntry {
  return {
    key,
    slug,
    imageUrl: slug ? `${ICON_THUMB_BASE_PATH}${slug}.webp` : null,
    displayName: slug ? getIngredientIconDisplayName(slug, language) : '',
    category: slug ? getIngredientIconCategory(slug) : 'other',
    unlocked: false,
    usageCount: 0,
    rescueCount: 0,
    firstUsedAt: null,
    lastUsedAt: null,
    masteryLevel: 0,
    nextMasteryAt: 1,
    recipes: [],
    seenNames: new Map(),
  };
}

export function buildIngredientCollection(
  records: CookedRecord[],
  language: 'ja' | 'en' = 'ja',
): IngredientCollectionSummary {
  const entries = new Map<string, MutableEntry>();
  for (const slug of ICON_SLUGS) entries.set(`slug:${slug}`, createMutableEntry(slug, `slug:${slug}`, language));

  for (const record of records) {
    const recordIngredients = new Map<string, { name: string; rescued: boolean }>();
    const rescuedKeys = new Set<string>();

    for (const item of record.rescuedIngredients || []) {
      const name = item.name.trim();
      if (!name) continue;
      const slug = getIngredientIconSlug(name);
      const key = slug ? `slug:${slug}` : `custom:${normalizeCustomKey(name)}`;
      rescuedKeys.add(key);
      recordIngredients.set(key, { name, rescued: true });
    }

    const usedNames = record.ingredientNames?.length ? record.ingredientNames : record.consumedIngredientNames || [];
    for (const rawName of usedNames) {
      const name = rawName.trim();
      if (!name) continue;
      const slug = getIngredientIconSlug(name);
      const key = slug ? `slug:${slug}` : `custom:${normalizeCustomKey(name)}`;
      if (!recordIngredients.has(key)) recordIngredients.set(key, { name, rescued: rescuedKeys.has(key) });
    }

    for (const [key, occurrence] of recordIngredients) {
      const slug = key.startsWith('slug:') ? key.slice(5) : null;
      const entry = entries.get(key) || createMutableEntry(slug, key, language);
      if (!slug && entry.category === 'other') entry.category = getIngredientCategoryForName(occurrence.name);
      const timestamp = toTimestamp(record.date);
      entry.unlocked = true;
      entry.usageCount += 1;
      entry.rescueCount += occurrence.rescued ? 1 : 0;
      entry.seenNames.set(occurrence.name, (entry.seenNames.get(occurrence.name) || 0) + 1);
      if (!entry.firstUsedAt || timestamp < toTimestamp(entry.firstUsedAt)) entry.firstUsedAt = record.date;
      if (!entry.lastUsedAt || timestamp > toTimestamp(entry.lastUsedAt)) entry.lastUsedAt = record.date;
      entry.recipes.push({ title: record.recipeTitle, date: record.date, rescued: occurrence.rescued });
      entries.set(key, entry);
    }
  }

  const finalized = Array.from(entries.values()).map((entry): IngredientCollectionEntry => {
    const displayName = Array.from(entry.seenNames.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || entry.displayName;
    return {
      key: entry.key,
      slug: entry.slug,
      imageUrl: entry.imageUrl,
      displayName,
      category: entry.category,
      unlocked: entry.unlocked,
      usageCount: entry.usageCount,
      rescueCount: entry.rescueCount,
      firstUsedAt: entry.firstUsedAt,
      lastUsedAt: entry.lastUsedAt,
      ...getMastery(entry.usageCount),
      recipes: entry.recipes.sort((a, b) => toTimestamp(b.date) - toTimestamp(a.date)),
    };
  }).sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    if (a.rescueCount !== b.rescueCount) return b.rescueCount - a.rescueCount;
    if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount;
    return a.key.localeCompare(b.key);
  });

  const unlockedKnown = finalized.filter((entry) => entry.unlocked && entry.slug).length;
  const discoveredCount = finalized.filter((entry) => entry.unlocked).length;
  const rescuedCount = finalized.filter((entry) => entry.rescueCount > 0).length;
  const bestStreak = calculateBestCookingStreak(records);

  return {
    entries: finalized,
    totalKnown: ICON_SLUGS.length,
    unlockedKnown,
    discoveredCount,
    rescuedCount,
    completionPercent: ICON_SLUGS.length > 0 && unlockedKnown > 0
      ? Math.max(1, Math.round((unlockedKnown / ICON_SLUGS.length) * 100))
      : 0,
    bestStreak,
    nextStreakMilestone: STREAK_BADGE_MILESTONES.find((milestone) => bestStreak < milestone) || null,
  };
}
