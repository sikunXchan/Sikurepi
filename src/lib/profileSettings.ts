import type { UserProfile } from './storage';

export type ProfileChange = Partial<UserProfile> | ((latest: UserProfile) => Partial<UserProfile>);

/** Merge only the edited fields into the latest settings, not a stale screen draft. */
export function applyProfileChange(latest: UserProfile, change: ProfileChange): UserProfile {
  return { ...latest, ...(typeof change === 'function' ? change(latest) : change) };
}

export function parseExcludedIngredients(value: string): string[] {
  // Spaces within English ingredient names (e.g. "soy sauce") must remain intact.
  return [...new Set(value.split(/[,、，\n\r]+/).map((name) => name.trim()).filter(Boolean))];
}
