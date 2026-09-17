"use client";

import { useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { BookOpen, ChevronRight, CircleHelp, X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { guideCopy } from '@/lib/i18n/guides';
import { GUIDE_KEYS, type GuideKey, type GuideProgress } from '@/lib/guideProgress';
import { dismissLocalGuide, getLocalGuideProgress, getLocalIngredients, getLocalShoppingItems, getLocalLastRecipeGeneration, getLocalWeekPlan, getLocalSavedRecipes, getLocalUserProfile, hasLocalData } from '@/lib/storage';
import HelpDialog from './HelpDialog';
import styles from './AppGuide.module.css';

const routeGuides: Record<string, GuideKey> = { '/': 'home', '/inventory': 'inventory', '/shopping': 'shopping', '/recipe': 'recipe', '/meal-plan': 'mealPlan', '/history': 'history', '/mypage': 'myPage', '/receipt': 'receipt' };
function subscribe(listener: () => void) {
  window.addEventListener('storage-updated', listener);
  window.addEventListener('storage', listener);
  return () => { window.removeEventListener('storage-updated', listener); window.removeEventListener('storage', listener); };
}
function snapshot() {
  return JSON.stringify({
    progress: getLocalGuideProgress(),
    experienced: hasLocalData(),
    completed: {
      inventory: getLocalIngredients().length > 0, receipt: getLocalIngredients().length > 0,
      shopping: getLocalShoppingItems().length > 0, recipe: !!getLocalLastRecipeGeneration(),
      mealPlan: getLocalWeekPlan().length > 0, history: getLocalSavedRecipes().length > 0,
      myPage: (getLocalUserProfile().dietaryRestrictions?.length || 0) + (getLocalUserProfile().allergies?.length || 0) > 0,
      home: hasLocalData(),
    },
  });
}
function useGuideState() {
  const value = useSyncExternalStore(subscribe, snapshot, () => '');
  return value ? JSON.parse(value) as { progress: GuideProgress; experienced: boolean; completed: Record<GuideKey, boolean> } : null;
}

function GuideContents({ selected, onSelect }: { selected: GuideKey | null; onSelect: (key: GuideKey | null) => void }) {
  const { language } = useLanguage();
  const copy = guideCopy[language];
  return selected ? <>
    <ol className={styles.steps}>{copy[selected].steps.map((step) => <li key={step}>{step}</li>)}</ol>
    <button type="button" className={styles.textButton} onClick={() => onSelect(null)}><BookOpen size={17} />{copy.back}</button>
  </> : <>
    <p className={styles.description}>{copy.allBody}</p>
    <div className={styles.topics}>{GUIDE_KEYS.map((key) => <button type="button" key={key} onClick={() => onSelect(key)}>{copy[key].name}<ChevronRight size={18} /></button>)}</div>
  </>;
}

export function GuideButton({ all = false }: { all?: boolean }) {
  const path = usePathname();
  const { language } = useLanguage();
  const copy = guideCopy[language];
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<GuideKey | null>(null);
  const key = routeGuides[path];
  if (!key && !all) return null;
  return <>
    <button type="button" className={all ? styles.directory : styles.helpButton} onClick={() => { setSelected(all ? null : key); setOpen(true); }}>
      {all ? <BookOpen size={20} /> : <CircleHelp size={17} />} {all ? copy.browse : copy.help}
      {all && <ChevronRight size={18} />}
    </button>
    {open && <HelpDialog title={selected ? copy[selected].name + ' · ' + copy.help : copy.allTitle} onClose={() => setOpen(false)}>
      <GuideContents selected={selected} onSelect={setSelected} />
    </HelpDialog>}
  </>;
}

export function TabGuide() {
  const path = usePathname();
  const state = useGuideState();
  const { language } = useLanguage();
  const copy = guideCopy[language];
  const key = routeGuides[path];
  if (!state || !key || key === 'home' || state.completed[key] || state.progress.dismissed.includes(key)) return null;
  return <aside className={styles.hint} aria-label={copy.help}>
    <CircleHelp size={19} aria-hidden="true" />
    <p>{copy[key].hint}</p>
    <button type="button" onClick={() => dismissLocalGuide(key)} aria-label={copy.dismiss}><X size={17} /></button>
  </aside>;
}

export function WelcomeGuide() {
  const state = useGuideState();
  const { language } = useLanguage();
  const copy = guideCopy[language];
  if (!state || state.progress.welcomeDismissed || state.experienced) return null;
  return <section className={styles.welcome}>
    <img src="/mascot/bear_wave.png" alt="" width={64} height={64} />
    <div><h2>{copy.welcomeTitle}</h2><p>{copy.welcomeBody}</p>
      <div className={styles.welcomeActions}>
        <button type="button" className={styles.primary} onClick={() => {
          dismissLocalGuide('welcome');
          requestAnimationFrame(() => {
            const target = document.getElementById('community-recipes');
            target?.focus({ preventScroll: true });
            target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
          });
        }}>{copy.start}<ChevronRight size={17} /></button>
        <button type="button" className={styles.textButton} onClick={() => dismissLocalGuide('welcome')}>{copy.skip}</button>
      </div>
    </div>
  </section>;
}
