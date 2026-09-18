import { isCommunityRecipe, sanitizeCommunityRecipe, type CommunityRecipe, type CommunityRecipeTranslation } from './communityRecipeSchema.ts';

export function recipeLanguage(recipe: CommunityRecipe): 'ja' | 'en' {
  return /[ぁ-んァ-ヶ一-龯]/u.test(recipe.title + recipe.steps.join('')) ? 'ja' : 'en';
}

export function needsCommunityTranslation(recipe: CommunityRecipe, language: 'ja' | 'en'): boolean {
  return !recipe.translations?.[language] && recipeLanguage(recipe) !== language;
}

export function translationSourceKey(recipe: CommunityRecipe): string {
  // Comments and tips may change without changing the canonical recipe identity.
  const source = sanitizeCommunityRecipe(recipe);
  delete source.translations;
  return JSON.stringify(source);
}

const numbers = (value: string) => (value.normalize('NFKC').match(/\d+(?:\.\d+)?/g) || []).join('|');

/** Reject structural or numeric changes: translation must never redesign a recipe. */
export function validateCommunityTranslation(source: CommunityRecipe, value: unknown, language: 'ja' | 'en'): CommunityRecipeTranslation | null {
  if (!isCommunityRecipe(value)) return null;
  const translated = sanitizeCommunityRecipe(value);
  if (!translated.title || recipeLanguage(translated) !== language
    || translated.ingredients.length !== source.ingredients.length
    || translated.steps.length !== source.steps.length
    || numbers(translated.time) !== numbers(source.time)
    || translated.ingredients.some((item, index) => numbers(item.amount) !== numbers(source.ingredients[index].amount))
    || translated.steps.some((step, index) => numbers(step) !== numbers(source.steps[index]))
    || numbers(translated.tips) !== numbers(source.tips)
    || (translated.components?.length || 0) !== (source.components?.length || 0)
    || (Boolean(source.creator_comment?.trim()) && !translated.creator_comment?.trim())) return null;
  return {
    title: translated.title, time: translated.time,
    ingredients: translated.ingredients, steps: translated.steps, tips: translated.tips,
    genre: source.genre, dish_badge: translated.dish_badge,
    creator_comment: source.creator_comment ? translated.creator_comment : null,
    meal_format: source.meal_format,
    components: source.components?.map((component, index) => ({
      ...component, title: translated.components![index].title,
    })),
  };
}
