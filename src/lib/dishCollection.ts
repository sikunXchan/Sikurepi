import {
  DISH_ICON_BASE_PATH,
  DISH_ICON_SLUGS,
  getDishIconCategory,
  getDishIconDisplayName,
  getDishIconSlug,
  type DishIconCategory,
} from "./dishIcons";
import type { IngredientMasteryLevel, IngredientCollectionRecipe } from "./ingredientCollection";
import type { CookedRecord } from "./storage";

export const DISH_MASTERY_THRESHOLDS = [1, 3, 10] as const;

export type DishCollectionEntry = {
  key: string;
  slug: string | null;
  imageUrl: string | null;
  displayName: string;
  category: DishIconCategory;
  unlocked: boolean;
  usageCount: number;
  rescueCount: number;
  firstUsedAt: string | null;
  lastUsedAt: string | null;
  masteryLevel: IngredientMasteryLevel;
  nextMasteryAt: number | null;
  recipes: IngredientCollectionRecipe[];
};

export type DishCollectionSummary = {
  entries: DishCollectionEntry[];
  totalKnown: number;
  unlockedKnown: number;
  discoveredCount: number;
  completionPercent: number;
};

type MutableDishEntry = DishCollectionEntry & {
  seenNames: Map<string, number>;
};

function normalizeKey(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

function toTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getMastery(usageCount: number): Pick<DishCollectionEntry, "masteryLevel" | "nextMasteryAt"> {
  if (usageCount >= DISH_MASTERY_THRESHOLDS[2]) return { masteryLevel: 3, nextMasteryAt: null };
  if (usageCount >= DISH_MASTERY_THRESHOLDS[1]) {
    return { masteryLevel: 2, nextMasteryAt: DISH_MASTERY_THRESHOLDS[2] };
  }
  if (usageCount >= DISH_MASTERY_THRESHOLDS[0]) {
    return { masteryLevel: 1, nextMasteryAt: DISH_MASTERY_THRESHOLDS[1] };
  }
  return { masteryLevel: 0, nextMasteryAt: DISH_MASTERY_THRESHOLDS[0] };
}

function createEntry(slug: string | null, key: string, language: "ja" | "en", customName = ""): MutableDishEntry {
  return {
    key,
    slug,
    imageUrl: slug ? `${DISH_ICON_BASE_PATH}${slug}.png` : null,
    displayName: slug ? getDishIconDisplayName(slug, language) : customName,
    category: slug ? getDishIconCategory(slug) : "other",
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

export function buildDishCollection(
  records: CookedRecord[],
  language: "ja" | "en" = "ja",
): DishCollectionSummary {
  const entries = new Map<string, MutableDishEntry>();
  for (const slug of DISH_ICON_SLUGS) {
    entries.set(`slug:${slug}`, createEntry(slug, `slug:${slug}`, language));
  }

  for (const record of records) {
    const title = record.recipeTitle?.trim();
    if (!title) continue;
    const slug = getDishIconSlug(title);
    const key = slug ? `slug:${slug}` : `custom:${normalizeKey(title)}`;
    const entry = entries.get(key) || createEntry(null, key, language, title);
    const timestamp = toTimestamp(record.date);
    entry.unlocked = true;
    entry.usageCount += 1;
    entry.seenNames.set(title, (entry.seenNames.get(title) || 0) + 1);
    if (!entry.firstUsedAt || timestamp < toTimestamp(entry.firstUsedAt)) entry.firstUsedAt = record.date;
    if (!entry.lastUsedAt || timestamp > toTimestamp(entry.lastUsedAt)) entry.lastUsedAt = record.date;
    entry.recipes.push({ title, date: record.date, rescued: false });
    entries.set(key, entry);
  }

  const finalized = Array.from(entries.values()).map((entry): DishCollectionEntry => {
    const usedName = Array.from(entry.seenNames.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
    return {
      key: entry.key,
      slug: entry.slug,
      imageUrl: entry.imageUrl,
      displayName: usedName || entry.displayName,
      category: entry.category,
      unlocked: entry.unlocked,
      usageCount: entry.usageCount,
      rescueCount: 0,
      firstUsedAt: entry.firstUsedAt,
      lastUsedAt: entry.lastUsedAt,
      ...getMastery(entry.usageCount),
      recipes: entry.recipes.sort((a, b) => toTimestamp(b.date) - toTimestamp(a.date)),
    };
  }).sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount;
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.displayName.localeCompare(b.displayName, language === "ja" ? "ja" : "en");
  });

  const unlockedKnown = finalized.filter((entry) => entry.unlocked && entry.slug).length;
  const discoveredCount = finalized.filter((entry) => entry.unlocked).length;

  return {
    entries: finalized,
    totalKnown: DISH_ICON_SLUGS.length,
    unlockedKnown,
    discoveredCount,
    completionPercent: DISH_ICON_SLUGS.length > 0 && unlockedKnown > 0
      ? Math.max(1, Math.round((unlockedKnown / DISH_ICON_SLUGS.length) * 100))
      : 0,
  };
}
