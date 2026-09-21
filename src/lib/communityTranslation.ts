import { isCommunityRecipe, sanitizeCommunityRecipe, type CommunityRecipe, type CommunityRecipeTranslation } from './communityRecipeSchema.ts';

export function recipeLanguage(recipe: CommunityRecipe): 'ja' | 'en' {
  // An English title does not imply that amounts, tips or badges were translated.
  // Genre/course identifiers stay canonical and are localized by the UI dictionary.
  const text = [recipe.title, recipe.time, recipe.tips, recipe.dish_badge, recipe.creator_comment,
    ...recipe.ingredients.flatMap(item => [item.name, item.amount]), ...recipe.steps,
    ...(recipe.components || []).map(component => component.title)].join(' ');
  return /[ぁ-んァ-ヶ一-龯]/u.test(text) ? 'ja' : 'en';
}

export function needsCommunityTranslation(recipe: CommunityRecipe, language: 'ja' | 'en'): boolean {
  return !recipe.translations?.[language] && !isDisplayLanguage(recipe, language);
}

function isDisplayLanguage(recipe: CommunityRecipe, language: 'ja' | 'en'): boolean {
  return language === 'en' ? recipeLanguage(recipe) === 'en'
    : /[ぁ-んァ-ヶ一-龯]/u.test(recipe.title + recipe.steps.join(''));
}

export function translationSourceKey(recipe: CommunityRecipe): string {
  // Comments and tips may change without changing the canonical recipe identity.
  const source = sanitizeCommunityRecipe(recipe);
  delete source.translations;
  return JSON.stringify(source);
}

const NUMBER = String.raw`\d+(?:\.\d+)?(?:\s*[/⁄]\s*\d+(?:\.\d+)?)?`;
const UNITS: [string, RegExp][] = [
  ['tbsp', /^(?:大さじ|tablespoons?\b|tbsp\b)/i],
  ['tsp', /^(?:小さじ|teaspoons?\b|tsp\b)/i],
  ['kg', /^(?:キログラム|kilograms?\b|kg\b)/i],
  ['mg', /^(?:ミリグラム|milligrams?\b|mg\b)/i],
  ['g', /^(?:グラム|grams?\b|g\b)/i],
  ['ml', /^(?:ミリリットル|millilit(?:er|re)s?\b|ml\b|cc\b)/i],
  ['l', /^(?:リットル|lit(?:er|re)s?\b|l\b)/i],
  ['min', /^(?:分|minutes?\b|mins?\b)/i],
  ['sec', /^(?:秒|seconds?\b|secs?\b)/i],
  ['hour', /^(?:時間|hours?\b|hrs?\b)/i],
  ['cm', /^(?:センチ(?:メートル)?|centimet(?:er|re)s?\b|cm\b)/i],
  ['mm', /^(?:ミリメートル|millimet(?:er|re)s?\b|mm\b)/i],
  ['celsius', /^(?:°\s*C\b|degrees?\s+Celsius\b)/i],
  ['fahrenheit', /^(?:°\s*F\b|degrees?\s+Fahrenheit\b)/i],
  ['percent', /^(?:%|percent\b)/i],
];

/** Compare quantities within each field, not their grammatical order.
 * Keep recognized units attached so swapping 75°C/1 minute still fails.
 */
function quantities(value: string, step = false): string {
  let text = value.normalize('NFKC');
  if (step) text = text.replace(/^\s*(?:step\s*)?\d+\s*[.):、]\s+/i, '');
  text = text
    .replace(/(\d+(?:\.\d+)?)\s*割/g, (_, n) => `${Number(n) * 10}%`)
    .replace(/(\d+(?:\.\d+)?)\s*(分|時間|秒)半/g, (_, n, unit) => `${Number(n) + 0.5}${unit}`)
    .replace(new RegExp(`(大さじ|小さじ)\\s*(${NUMBER})`, 'g'), '$2$1');
  return [...text.matchAll(new RegExp(NUMBER, 'g'))].map(match => {
    const parts = match[0].split(/[/⁄]/).map(Number);
    const amount = parts.length === 2 ? parts[0] / parts[1] : parts[0];
    const suffix = text.slice(match.index! + match[0].length).trimStart();
    const unit = UNITS.find(([, pattern]) => pattern.test(suffix))?.[0] || '';
    return `${amount}:${unit}`;
  }).sort().join('|');
}

/** Reject structural or numeric changes: translation must never redesign a recipe. */
export function validateCommunityTranslation(source: CommunityRecipe, value: unknown, language: 'ja' | 'en'): CommunityRecipeTranslation | null {
  if (!isCommunityRecipe(value)) return null;
  const translated = sanitizeCommunityRecipe(value);
  if (!translated.title || !isDisplayLanguage(translated, language)
    || translated.ingredients.length !== source.ingredients.length
    || translated.steps.length !== source.steps.length
    || quantities(translated.time) !== quantities(source.time)
    || translated.ingredients.some((item, index) => quantities(item.amount) !== quantities(source.ingredients[index].amount))
    || translated.steps.some((step, index) => quantities(step, true) !== quantities(source.steps[index], true))
    || quantities(translated.tips) !== quantities(source.tips)
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
