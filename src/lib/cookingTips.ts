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
