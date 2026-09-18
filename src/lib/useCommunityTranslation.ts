"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CommunityRecipe, CommunityRecipeTranslation } from './communityRecipeSchema';
import { needsCommunityTranslation, translationSourceKey, validateCommunityTranslation } from './communityTranslation';

type Entry = { key: string; source: string; translation: CommunityRecipeTranslation };
const STORAGE = 'sikurepi_community_translations_v1';
const pending = new Map<string, Promise<CommunityRecipeTranslation | null>>();
let running = 0;
const waiting: (() => void)[] = [];
function readCache(): Entry[] {
  try { const data = JSON.parse(localStorage.getItem(STORAGE) || '[]'); return Array.isArray(data) ? data.slice(-40) : []; }
  catch { return []; }
}

async function translate(id: string, recipe: CommunityRecipe, language: 'ja' | 'en'): Promise<CommunityRecipeTranslation | null> {
  const key = id + ':' + language;
  const source = translationSourceKey(recipe);
  const cached = readCache().find(entry => entry.key === key && entry.source === source);
  if (cached) return validateCommunityTranslation(recipe, cached.translation, language);
  const requestKey = key + source;
  if (pending.has(requestKey)) return pending.get(requestKey)!;
  const task = (async () => {
    if (running >= 2) await new Promise<void>(resolve => waiting.push(resolve));
    running += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);
    try {
      const response = await fetch(`/api/community-recipes/${encodeURIComponent(id)}/translate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }), signal: controller.signal,
      });
      if (!response.ok) return null;
      const data = await response.json();
      const translation = validateCommunityTranslation(recipe, data.translation, language);
      if (!translation) return null;
      try {
        localStorage.setItem(STORAGE, JSON.stringify([...readCache().filter(entry => entry.key !== key), { key, source, translation }].slice(-40)));
      } catch { /* Quota/private mode: keep the current screen usable. */ }
      return translation;
    } catch { return null; }
    finally { clearTimeout(timeout); running -= 1; waiting.shift()?.(); }
  })();
  pending.set(requestKey, task);
  void task.finally(() => pending.delete(requestKey));
  return task;
}

export function useCommunityTranslation(id: string, recipe: CommunityRecipe, language: 'ja' | 'en') {
  const [result, setResult] = useState<{ key: string; translation: CommunityRecipeTranslation | null } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const key = id + ':' + language + translationSourceKey(recipe);
  const currentKey = useRef(key);
  useEffect(() => { currentKey.current = key; }, [key]);
  const translation = result?.key === key ? result.translation : null;
  const localized = translation ? { ...recipe, translations: { ...recipe.translations, [language]: translation } } : recipe;
  const missing = needsCommunityTranslation(localized, language);
  const ensureTranslation = useCallback(async () => {
    if (!needsCommunityTranslation(recipe, language)) return recipe;
    setBusyKey(key);
    const translated = await translate(id, recipe, language);
    if (currentKey.current === key) {
      setResult({ key, translation: translated });
      setBusyKey(null);
    }
    return translated ? { ...recipe, translations: { ...recipe.translations, [language]: translated } } : recipe;
  }, [id, recipe, language, key]);
  return { recipe: localized, ensureTranslation, missing, busy: busyKey === key, failed: result?.key === key && !translation };
}
