import { validateDietaryRestrictions, validateExcludedIngredients } from './dietaryRules.ts';

export const COOKING_ISSUES = ['missing', 'salty', 'watery', 'burnt', 'heat', 'words'] as const;
export type CookingIssue = typeof COOKING_ISSUES[number];
type Ingredient = { name: string; amount?: string };
type Profile = { dietaryRestrictions?: string[]; excludedIngredients?: string[]; allergies?: string[] };
const SUBSTITUTIONS = [
  { aliases: /^(牛乳|ミルク|milk)$/i, candidates: [{ ja: '無調整豆乳', en: 'unsweetened soy milk' }], note: 'liquid' },
  { aliases: /^(ほうれん草|小松菜|spinach|komatsuna)$/i, candidates: [{ ja: '小松菜', en: 'komatsuna' }, { ja: 'ほうれん草', en: 'spinach' }], note: 'greens' },
  { aliases: /^(しめじ|ぶなしめじ|エリンギ|マッシュルーム|shimeji|king oyster mushroom|mushrooms?)$/i, candidates: [{ ja: 'しめじ', en: 'shimeji' }, { ja: 'マッシュルーム', en: 'mushrooms' }, { ja: 'エリンギ', en: 'king oyster mushroom' }], note: 'mushrooms' },
  { aliases: /^(ピーマン|パプリカ|green pepper|bell pepper)$/i, candidates: [{ ja: 'パプリカ', en: 'bell pepper' }, { ja: 'ピーマン', en: 'green pepper' }], note: 'peppers' },
  { aliases: /^(レモン汁|ライム汁|lemon juice|lime juice)$/i, candidates: [{ ja: 'レモン汁', en: 'lemon juice' }, { ja: 'ライム汁', en: 'lime juice' }], note: 'citrus' },
] as const;

const normalize = (name: string) => name.normalize('NFKC').trim().toLowerCase();
export function getSafeSubstitutions(missing: string, ingredients: Ingredient[], profile: Profile, title = '') {
  // 構造・凝固・発酵に関わる配合には、日常料理の置換ルールを流用しない。
  if (/ケーキ|パン|プリン|菓子|クッキー|ゼリー|発酵|cake|bread|pudding|cookie|pastry|jelly|ferment/i.test(title)) return [];
  const target = normalize(missing);
  const rule = SUBSTITUTIONS.find((entry) => entry.aliases.test(target));
  if (!rule) return [];
  if (rule.note === 'liquid' && !/スープ|シチュー|煮込|soup|stew/i.test(title)) return [];
  const exclusions = [...(profile.excludedIngredients || []), ...(profile.allergies || [])];
  return rule.candidates.filter((candidate) => {
    if ([candidate.ja, candidate.en].some((name) => normalize(name) === target)
      || (target === 'ぶなしめじ' && candidate.ja === 'しめじ')
      || (target === 'mushroom' && candidate.en === 'mushrooms')) return false;
    const replaced = { ingredients: [
      ...ingredients.filter((item) => normalize(item.name) !== target),
      { name: candidate.ja + ' / ' + candidate.en, amount: '' },
    ] };
    return validateDietaryRestrictions(replaced, profile.dietaryRestrictions || []).length === 0
      && validateExcludedIngredients(replaced, exclusions).length === 0;
  }).map((candidate) => ({ ...candidate, note: rule.note }));
}

export function getCookingContext(title: string, step: string, ingredients: Ingredient[]) {
  const text = title + ' ' + step;
  const deepFrying = /揚げ|揚油|フライ(?!パン)|天ぷら|deep.fry|deep.fried|tempura/i.test(text);
  const soup = !deepFrying && /スープ|汁|煮込|シチュー|カレー|soup|stew|broth|curry/i.test(text);
  const shellfish = ingredients.some(({ name }) => /牡蠣|かき(?!菜)|カキ(?!菜)|あさり|アサリ|はまぐり|ハマグリ|しじみ|ムール|oyster(?!\s+mushroom)|clam|mussel/i.test(name));
  return { deepFrying, soup, shellfish };
}
