export type CommunityRecipe = {
  title: string;
  time: string;
  ingredients: { name: string; amount: string }[];
  steps: string[];
  tips: string;
  genre?: string | null;
  dish_badge?: string | null;
  nutrition?: {
    calories: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
  } | null;
  creator_comment?: string | null;
  servings?: number;
  translations?: Partial<Record<'ja' | 'en', CommunityRecipeTranslation>>;
};

export type CommunityRecipeTranslation = {
  title: string;
  time: string;
  ingredients: { name: string; amount: string }[];
  steps: string[];
  tips: string;
  genre?: string | null;
  dish_badge?: string | null;
  creator_comment?: string | null;
};

function isCommunityRecipeTranslation(value: unknown): value is CommunityRecipeTranslation {
  if (!value || typeof value !== 'object') return false;
  const translation = value as Partial<CommunityRecipeTranslation>;
  return typeof translation.title === 'string'
    && typeof translation.time === 'string'
    && Array.isArray(translation.ingredients)
    && Array.isArray(translation.steps)
    && typeof translation.tips === 'string';
}

function sanitizeTranslation(translation: CommunityRecipeTranslation): CommunityRecipeTranslation {
  return {
    title: translation.title.normalize('NFKC').trim().slice(0, 160),
    time: translation.time.normalize('NFKC').trim().slice(0, 40),
    ingredients: translation.ingredients.slice(0, 40).map((item) => ({
      name: String(item?.name || '').normalize('NFKC').trim().slice(0, 100),
      amount: String(item?.amount || '').normalize('NFKC').trim().slice(0, 80),
    })).filter((item) => item.name),
    steps: translation.steps.slice(0, 30).map((step) => String(step).normalize('NFKC').trim().slice(0, 800)).filter(Boolean),
    tips: translation.tips.normalize('NFKC').trim().slice(0, 1200),
    genre: typeof translation.genre === 'string' ? translation.genre.normalize('NFKC').trim().slice(0, 80) : null,
    dish_badge: typeof translation.dish_badge === 'string' ? translation.dish_badge.normalize('NFKC').trim().slice(0, 120) : null,
    creator_comment: typeof translation.creator_comment === 'string'
      ? translation.creator_comment.normalize('NFKC').trim().slice(0, 280)
      : null,
  };
}

export function isCommunityRecipe(value: unknown): value is CommunityRecipe {
  if (!value || typeof value !== 'object') return false;
  const recipe = value as Partial<CommunityRecipe>;
  return typeof recipe.title === 'string'
    && typeof recipe.time === 'string'
    && Array.isArray(recipe.ingredients)
    && Array.isArray(recipe.steps)
    && typeof recipe.tips === 'string';
}

export function sanitizeCommunityRecipe(recipe: CommunityRecipe): CommunityRecipe {
  const translations = Object.fromEntries(
    (['ja', 'en'] as const)
      .filter((language) => isCommunityRecipeTranslation(recipe.translations?.[language]))
      .map((language) => [language, sanitizeTranslation(recipe.translations![language]!)]),
  ) as CommunityRecipe['translations'];
  return {
    title: recipe.title.normalize('NFKC').trim().slice(0, 160),
    time: recipe.time.normalize('NFKC').trim().slice(0, 40),
    ingredients: recipe.ingredients.slice(0, 40).map((item) => ({
      name: String(item?.name || '').normalize('NFKC').trim().slice(0, 100),
      amount: String(item?.amount || '').normalize('NFKC').trim().slice(0, 80),
    })).filter((item) => item.name),
    steps: recipe.steps.slice(0, 30).map((step) => String(step).normalize('NFKC').trim().slice(0, 800)).filter(Boolean),
    tips: recipe.tips.normalize('NFKC').trim().slice(0, 1200),
    genre: typeof recipe.genre === 'string' ? recipe.genre.normalize('NFKC').trim().slice(0, 80) : null,
    dish_badge: typeof recipe.dish_badge === 'string' ? recipe.dish_badge.normalize('NFKC').trim().slice(0, 120) : null,
    nutrition: recipe.nutrition || null,
    servings: Math.max(1, Math.min(15, Math.round(Number(recipe.servings) || 2))),
    creator_comment: typeof recipe.creator_comment === 'string'
      ? recipe.creator_comment.normalize('NFKC').trim().slice(0, 280)
      : null,
    translations: Object.keys(translations || {}).length > 0 ? translations : undefined,
  };
}

export function localizeCommunityRecipe(recipe: CommunityRecipe, language: 'ja' | 'en'): CommunityRecipe {
  const translation = recipe.translations?.[language];
  if (!translation) return recipe;
  return {
    ...recipe,
    ...translation,
    nutrition: recipe.nutrition,
  };
}

// JSONBはキー順を保持しないため、照合対象を固定順の配列にして同じレシピを安定して識別する。
export function serializeCommunityRecipeIdentity(recipe: CommunityRecipe): string {
  const sanitized = sanitizeCommunityRecipe(recipe);
  return JSON.stringify([
    sanitized.title.toLocaleLowerCase(),
    sanitized.time.toLocaleLowerCase(),
    sanitized.ingredients.map((item) => [item.name.toLocaleLowerCase(), item.amount.toLocaleLowerCase()]),
    sanitized.steps.map((step) => step.toLocaleLowerCase()),
  ]);
}
