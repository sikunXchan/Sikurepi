import { DIETARY_RESTRICTION_OPTIONS } from './dietaryRules.ts';

export type RecipeConsiderations = {
  dietaryRestrictions: string[];
  allergyAndExclusionChecked: boolean;
};

type ProfileLike = {
  dietaryRestrictions?: unknown;
  excludedIngredients?: unknown;
  allergies?: unknown;
} | null | undefined;

const ENGLISH_LABELS: Record<string, string> = {
  'ベジタリアン': 'Vegetarian',
  'ヴィーガン': 'Vegan',
  'ハラール（イスラム教）': 'Halal considered',
  'コーシャ（ユダヤ教）': 'Kosher considered',
  '豚肉不可': 'Pork-free',
  '牛肉不可': 'Beef-free',
  'アルコール不可': 'Alcohol-free',
  'グルテンフリー': 'Gluten-free',
  '乳製品不使用': 'Dairy-free',
  '卵不使用': 'Egg-free',
  '魚介類不使用': 'Seafood-free',
  'ナッツ不使用': 'Nut-free',
  '大豆不使用': 'Soy-free',
};

const JAPANESE_LABELS: Record<string, string> = {
  'ハラール（イスラム教）': 'ハラール配慮',
  'コーシャ（ユダヤ教）': 'コーシャ配慮',
  '豚肉不可': '豚肉不使用',
  '牛肉不可': '牛肉不使用',
  'アルコール不可': 'アルコール不使用',
};

function cleanStringList(value: unknown, allowed?: ReadonlyMap<string, string>): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const normalized = item.normalize('NFKC').trim();
    const canonical = allowed ? allowed.get(normalized) : normalized;
    if (!canonical || result.includes(canonical)) continue;
    result.push(canonical);
  }
  return result;
}

export function buildRecipeConsiderations(profile: ProfileLike): RecipeConsiderations | undefined {
  const allowed = new Map<string, string>(DIETARY_RESTRICTION_OPTIONS.map((option) => [option.normalize('NFKC'), option]));
  const dietaryRestrictions = cleanStringList(profile?.dietaryRestrictions, allowed);
  const allergyAndExclusionChecked = cleanStringList(profile?.excludedIngredients).length > 0
    || cleanStringList(profile?.allergies).length > 0;
  if (dietaryRestrictions.length === 0 && !allergyAndExclusionChecked) return undefined;
  return { dietaryRestrictions, allergyAndExclusionChecked };
}

export function sanitizeRecipeConsiderations(value: unknown): RecipeConsiderations | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  return buildRecipeConsiderations({
    dietaryRestrictions: source.dietaryRestrictions,
    excludedIngredients: source.allergyAndExclusionChecked === true ? ['checked'] : [],
  });
}

export function getConsiderationLabels(
  considerations: RecipeConsiderations | null | undefined,
  language: 'ja' | 'en',
): string[] {
  if (!considerations) return [];
  const dietary = considerations.dietaryRestrictions.map((restriction) => language === 'en'
    ? ENGLISH_LABELS[restriction] || restriction
    : JAPANESE_LABELS[restriction] || restriction);
  if (considerations.allergyAndExclusionChecked) {
    dietary.push(language === 'en' ? 'Allergies & exclusions checked' : 'アレルギー・除外食材に配慮');
  }
  return dietary;
}
