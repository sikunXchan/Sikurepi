export type CookingTipCategory = 'storage' | 'cooking' | 'nutrition' | 'other';

// Older backups and AI responses contain display labels, not stable IDs.
// Resolve them at render time so changing languages never rewrites saved tips.
export function getCookingTipCategory(category: string): CookingTipCategory {
  const key = category.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  switch (key) {
    case 'storage':
    case 'storagetip':
    case 'storagetips':
    case 'storageadvice':
    case 'storagemethod':
    case 'storagemethods':
    case 'foodstorage':
    case '保存方法':
    case '保存のコツ':
      return 'storage';
    case 'cooking':
    case 'cookingtip':
    case 'cookingtips':
    case 'cookingtipsandtricks':
    case 'cookingtechnique':
    case 'cookingtechniques':
    case '調理のコツ':
    case '料理のコツ':
      return 'cooking';
    case 'nutrition':
    case 'nutritiontip':
    case 'nutritiontips':
    case 'nutritiontrivia':
    case 'nutritionfacts':
    case 'nutritionfact':
    case 'nutritionaltrivia':
    case 'nutritionalfact':
    case 'nutritionalfacts':
    case '栄養豆知識':
    case '栄養の豆知識':
      return 'nutrition';
    default:
      return 'other';
  }
}

/** Optional trivia must not cause an otherwise validated meal to be regenerated. */
export function normalizeCookingTips(value: unknown): { category: string; tip: string }[] {
  if (!Array.isArray(value)) return [];
  const clean = (text: string) => text.replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu, '').trim();
  return value.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const entry = item as Record<string, unknown>;
    if (typeof entry.category !== 'string' || typeof entry.tip !== 'string') return [];
    const category = clean(entry.category);
    const tip = clean(entry.tip);
    return category && tip ? [{ category, tip }] : [];
  }).slice(0, 3);
}
