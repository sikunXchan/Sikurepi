import type { Language } from './LanguageContext';

// English is the default for first launch and server-rendered HTML. A user's
// explicit choice still wins as soon as their saved setting is loaded.
export const DEFAULT_LANGUAGE: Language = 'en';

export function parseStoredLanguage(value: string | null): Language | null {
  return value === 'ja' || value === 'en' ? value : null;
}
