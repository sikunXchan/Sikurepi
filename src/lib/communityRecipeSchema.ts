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
};

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
