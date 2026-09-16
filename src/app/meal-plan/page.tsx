"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, Trash2, ShoppingCart, Check, AlertTriangle, SlidersHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import NutritionChart from "@/components/NutritionChart";
import IngredientIcon from "@/components/IngredientIcon";
import UiIcon from "@/components/UiIcon";
import PageHeader from "@/components/PageHeader";
import KitchenLoader from "@/components/KitchenLoader";
import RecipeThumbnail from "@/components/RecipeThumbnail";
import PremiumPaywall from "@/components/PremiumPaywall";
import RecipeDetailScreen, { type RecipeDetailData } from "@/components/RecipeDetailScreen";
import {
  getLocalIngredients,
  getLocalUserProfile,
  getLocalClimateState,
  getRecentLocalRecipeNames,
  getRecentFlavorFeedbackSummary,
  addLocalShoppingItem,
  getLocalWeekPlan,
  setLocalWeekPlanEntries,
  removeLocalWeekPlanEntry,
  getFreeGenerationsUsed,
  getFreeGenerationsRemaining,
  incrementFreeGenerationsUsed,
  saveLocalRecentRecipes,
  FREE_WEEKLY_PLAN_GENERATIONS,
  Ingredient,
  UserProfile,
  MealSlot,
  WeeklyPlanEntry,
} from "@/lib/storage";
import { usePremium } from "@/lib/premium/PremiumContext";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { recipeServings, scaleIngredientAmount } from "@/lib/servingScale";
import styles from "./MealPlan.module.css";
// レシピ生成ページ(recipe/page.tsx)と全く同じ見た目にするため、
// バッジ・材料・手順・コツの表示はそちらのスタイルを直接使い回す
import recipeStyles from "@/app/recipe/Recipe.module.css";

const SLOTS: MealSlot[] = ['lunch', 'dinner'];

type DayInfo = { date: string; monthDay: string; weekday: string };

function buildDays(weekday: string[]): DayInfo[] {
  const days: DayInfo[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const date = d.toISOString().split('T')[0];
    days.push({ date, monthDay: `${d.getMonth() + 1}/${d.getDate()}`, weekday: weekday[d.getDay()] });
  }
  return days;
}

export default function MealPlanPage() {
  const { t, language } = useLanguage();
  const { isPremium } = usePremium();
  const SLOT_LABEL: Record<MealSlot, string> = { lunch: t.mealPlan.slotLunch, dinner: t.mealPlan.slotDinner };
  const days = useMemo(() => buildDays(t.mealPlan.weekdayShort), [t.mealPlan.weekdayShort]);
  const [active, setActive] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    buildDays(t.mealPlan.weekdayShort).forEach(d => {
      init[`${d.date}_lunch`] = false;
      init[`${d.date}_dinner`] = true;
    });
    return init;
  });
  const [plan, setPlan] = useState<WeeklyPlanEntry[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [profile, setProfile] = useState<UserProfile>(getLocalUserProfile());
  const [generating, setGenerating] = useState(false);
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [weeklyTargets, setWeeklyTargets] = useState<{ calories: number; protein_g: number; fat_g: number; carbs_g: number } | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [previewRecipe, setPreviewRecipe] = useState<RecipeDetailData | null>(null);
  const plannerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener("storage-updated", handleUpdate);
    return () => window.removeEventListener("storage-updated", handleUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = () => {
    setIngredients(getLocalIngredients());
    setProfile(getLocalUserProfile());
    const dateSet = new Set(days.map(d => d.date));
    setPlan(getLocalWeekPlan().filter(e => dateSet.has(e.date)));
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const toggleSlot = (date: string, slot: MealSlot) => {
    setActive(prev => ({ ...prev, [`${date}_${slot}`]: !prev[`${date}_${slot}`] }));
  };

  const toggleDay = (date: string, on: boolean) => {
    setActive(prev => ({ ...prev, [`${date}_lunch`]: on, [`${date}_dinner`]: on }));
  };

  const activeSlots = () => {
    const list: { date: string; mealSlot: MealSlot }[] = [];
    days.forEach(d => {
      SLOTS.forEach(slot => {
        if (active[`${d.date}_${slot}`]) list.push({ date: d.date, mealSlot: slot });
      });
    });
    return list;
  };

  const buildPayload = (slots: { date: string; mealSlot: MealSlot }[]) => {
    const currentClimate = getLocalClimateState();
    const recentHistory = getRecentLocalRecipeNames(10);
    return {
      slots,
      ingredients: ingredients.map(i => i.name),
      pinnedIngredients: ingredients.filter(i => i.is_pinned).map(i => i.name),
      userProfile: {
        ...profile,
        tastePreferences: profile.tastePreferences || [],
        excludedIngredients: profile.excludedIngredients || [],
        cookingStyles: profile.cookingStyles || [],
        dietaryRestrictions: profile.dietaryRestrictions || [],
        preferredGenres: profile.preferredGenres || [],
        flavorFeedback: getRecentFlavorFeedbackSummary(12),
      },
      climate: profile.enableClimate !== false ? currentClimate : undefined,
      recentHistory,
      mode: 'free',
      language,
    };
  };

  type ApiPlanItem = {
    date: string;
    meal_slot: MealSlot;
    title: string;
    time: string;
    genre?: string | null;
    dish_badge?: string | null;
    ingredients: { name: string; amount: string }[];
    steps: string[];
    tips: string;
    nutrition?: { calories: number; protein_g: number; fat_g: number; carbs_g: number } | null;
    servings?: number;
    meal_format?: 'single' | 'set';
    components?: { course: string; title: string; genre?: string | null }[];
  };

  const mapPlanItem = (r: ApiPlanItem): WeeklyPlanEntry => ({
    date: r.date,
    mealSlot: r.meal_slot,
    recipe: {
      title: r.title,
      time: r.time,
      genre: r.genre,
      dish_badge: r.dish_badge,
      ingredients: r.ingredients,
      steps: r.steps,
      tips: r.tips,
      nutrition: r.nutrition,
      servings: recipeServings(r.servings),
      meal_format: r.meal_format,
      components: Array.isArray(r.components) ? r.components : undefined,
    },
  });

  const rememberRecentPlanEntries = (entries: WeeklyPlanEntry[]) => {
    saveLocalRecentRecipes(entries.map((entry) => ({
      ...entry.recipe,
      image_url: null,
      nutrition: entry.recipe.nutrition || null,
      genre: entry.recipe.genre || null,
      dish_badge: entry.recipe.dish_badge || null,
      source: 'meal-plan',
      sourceRecipeId: `${entry.date}_${entry.mealSlot}`,
    })));
  };

  const handleGenerate = async () => {
    const slots = activeSlots();
    if (slots.length === 0) {
      setErrorMsg(t.mealPlan.errorNoSlots);
      return;
    }
    if (!isPremium && getFreeGenerationsUsed() >= FREE_WEEKLY_PLAN_GENERATIONS) {
      setShowPaywall(true);
      return;
    }
    setGenerating(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/recipes/weekly-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(slots)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.mealPlan.errorGenerateFailed);

      const entries: WeeklyPlanEntry[] = (data.plan || []).map(mapPlanItem);
      if (entries.length === 0) throw new Error(t.mealPlan.errorNoRecipeFound);
      setLocalWeekPlanEntries(entries);
      rememberRecentPlanEntries(entries);
      setWeeklyTargets(data.weeklyTargets || null);
      if (!isPremium) incrementFreeGenerationsUsed();
      loadData();
      showToast(t.mealPlan.generatedToast(entries.length));
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : t.mealPlan.errorGeneric);
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateSlot = async (date: string, mealSlot: MealSlot) => {
    if (!isPremium && getFreeGenerationsUsed() >= FREE_WEEKLY_PLAN_GENERATIONS) {
      setShowPaywall(true);
      return;
    }
    const key = `${date}_${mealSlot}`;
    setRegeneratingKey(key);
    setErrorMsg("");
    try {
      const res = await fetch("/api/recipes/weekly-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload([{ date, mealSlot }])),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.mealPlan.errorRegenFailed);
      const r = (data.plan || [])[0];
      if (!r) throw new Error(t.mealPlan.errorNoRecipeFound);
      const entry = mapPlanItem(r);
      setLocalWeekPlanEntries([entry]);
      rememberRecentPlanEntries([entry]);
      if (!isPremium) incrementFreeGenerationsUsed();
      loadData();
      showToast(t.mealPlan.regeneratedToast);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : t.mealPlan.errorRegenFailed);
    } finally {
      setRegeneratingKey(null);
    }
  };

  const handleRemoveSlot = (date: string, mealSlot: MealSlot) => {
    removeLocalWeekPlanEntry(date, mealSlot);
    loadData();
  };

  const handleAddMissingToShopping = () => {
    const haveNames = ingredients.map(i => i.name.trim().toLowerCase());
    const needed = new Map<string, string>();
    plan.forEach(entry => {
      (entry.recipe.ingredients || []).forEach(item => {
        const key = item.name.trim().toLowerCase();
        if (!key) return;
        const already = haveNames.some(h => key.includes(h) || h.includes(key));
        if (!already) needed.set(key, item.name.trim());
      });
    });
    if (needed.size === 0) {
      showToast(t.mealPlan.allInStockToast);
      return;
    }
    needed.forEach(name => addLocalShoppingItem(name));
    showToast(t.mealPlan.addedMissingToast(needed.size));
  };

  const weeklyNutritionSum = () => {
    let calories = 0, protein_g = 0, fat_g = 0, carbs_g = 0;
    plan.forEach(e => {
      const n = e.recipe.nutrition;
      if (n) { calories += n.calories || 0; protein_g += n.protein_g || 0; fat_g += n.fat_g || 0; carbs_g += n.carbs_g || 0; }
    });
    return { calories, protein_g, fat_g, carbs_g };
  };

  const findEntry = (date: string, mealSlot: MealSlot) => plan.find(e => e.date === date && e.mealSlot === mealSlot);

  const selectedMealCount = activeSlots().length;

  const reviewMealSlots = () => {
    setErrorMsg("");
    plannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className={styles.container}>
      {toastMessage && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(31, 41, 55, 0.95)', color: 'white', padding: '8px 18px',
          borderRadius: 9999, fontSize: 13, fontWeight: 700, boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
          zIndex: 9999, pointerEvents: 'none',
        }}>
          {toastMessage}
        </div>
      )}

      <PageHeader
        title={t.mealPlan.title}
        subtitle={t.mealPlan.subtitle}
        mascot="bear_itadakimasu"
      />
      <section ref={plannerRef} className={`${styles.planner} ${generating ? styles.plannerBusy : ''}`} aria-busy={generating}>
        <div className={styles.plannerTopline}>
          <div>
            <span className={styles.plannerEyebrow}>WEEKLY TABLE</span>
            <h2 className={styles.plannerTitle}>{days[0].monthDay} — {days[days.length - 1].monthDay}</h2>
          </div>
          <div className={styles.selectionCount} title={t.mealPlan.selectedMeals(selectedMealCount)}>
            <UiIcon slug="calendar_date" size={34} alt="" />
            <span>{t.mealPlan.selectedMeals(selectedMealCount)}</span>
          </div>
        </div>
        <p className={styles.plannerHint}>{t.mealPlan.description}</p>
        <div className={styles.dayRail}>
          {days.map(d => {
            const lunchOn = !!active[`${d.date}_lunch`];
            const dinnerOn = !!active[`${d.date}_dinner`];
            return (
              <article key={d.date} className={`${styles.dayCard} ${lunchOn || dinnerOn ? styles.dayCardActive : styles.dayCardOff}`}>
                <div className={styles.dayCardHeader}>
                  <span className={styles.dayLabel}>{d.monthDay}</span>
                  <span className={styles.dayWeek}>{d.weekday}</span>
                </div>
                <div className={styles.mealSlots}>
                  <button type="button" onClick={() => toggleSlot(d.date, 'lunch')} className={`${styles.mealSlot} ${lunchOn ? styles.mealSlotActive : ''}`}>
                    <UiIcon slug="clear" size={22} alt="" />
                    <span>{t.mealPlan.slotLunch}</span>
                    <i className={styles.slotCheck}>{lunchOn && <Check size={11} />}</i>
                  </button>
                  <button type="button" onClick={() => toggleSlot(d.date, 'dinner')} className={`${styles.mealSlot} ${dinnerOn ? styles.mealSlotActive : ''}`}>
                    <span className={styles.moonMark} aria-hidden="true" />
                    <span>{t.mealPlan.slotDinner}</span>
                    <i className={styles.slotCheck}>{dinnerOn && <Check size={11} />}</i>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => toggleDay(d.date, !(lunchOn || dinnerOn))}
                  className={styles.dayToggle}
                >
                  {lunchOn || dinnerOn ? t.mealPlan.skipDay : `${t.mealPlan.slotLunch} + ${t.mealPlan.slotDinner}`}
                </button>
              </article>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className={styles.generateButton}
        >
          {generating ? (
            <>
              <Loader2 className="spinner" size={18} />
              {t.mealPlan.generateLoading}
            </>
          ) : (
            <>
              <UiIcon slug="cooking_pot" size={24} alt="" />
              {t.mealPlan.generateButton}
            </>
          )}
        </button>
        {!isPremium && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>
            {t.mealPlan.freeRemaining(getFreeGenerationsRemaining())}
          </p>
        )}
      </section>

      {generating && (
        <KitchenLoader
          variant="cooking"
          text={t.mealPlan.generatingText}
          phaseMessages={t.mealPlan.loadingPhases}
        />
      )}

      {errorMsg && (
        <section className={styles.errorCard} role="alert">
          <div className={styles.errorHeading}>
            <AlertTriangle size={20} />
            <span><strong>{t.mealPlan.errorGuideTitle}</strong><small>{t.mealPlan.errorGuideBody}</small></span>
          </div>
          <p>{errorMsg}</p>
          <div className={styles.errorActions}>
            <button type="button" onClick={() => void handleGenerate()} disabled={generating}>
              <RefreshCw size={15} />{t.mealPlan.retryGenerate}
            </button>
            <button type="button" onClick={reviewMealSlots}>
              <SlidersHorizontal size={15} />{t.mealPlan.reviewSelection}
            </button>
          </div>
        </section>
      )}

      {plan.length > 0 && (
        <section className={styles.summaryCard}>
          <div className={styles.summaryHeading}>
            <UiIcon slug="healthy" size={30} alt="" />
            <span>{t.mealPlan.weeklySummaryTitle}</span>
          </div>
          <NutritionChart nutrition={weeklyNutritionSum()} />
          {weeklyTargets && (
            <p className={styles.summaryTarget}>
              {t.mealPlan.weeklyTargetText(weeklyTargets.calories, weeklyTargets.protein_g, weeklyTargets.fat_g, weeklyTargets.carbs_g)}
            </p>
          )}
          <button
            type="button"
            onClick={handleAddMissingToShopping}
            className={styles.shoppingButton}
          >
            <ShoppingCart size={15} /> {t.mealPlan.addMissingButton}
          </button>
        </section>
      )}

      {plan.length > 0 && (
        <section className={styles.planResults}>
          {days.map(d => {
            const slotsToShow = SLOTS.filter(s => findEntry(d.date, s));
            if (slotsToShow.length === 0) return null;
            return (
              <div key={d.date} className={styles.planDay}>
                <div className={styles.planDayHeading}>
                  <span>{d.monthDay}</span>
                  <small>{d.weekday}</small>
                </div>
                {slotsToShow.map(slot => {
                  const entry = findEntry(d.date, slot)!;
                  const key = `${d.date}_${slot}`;
                  const baseServings = recipeServings(entry.recipe.servings);
                  const displayServings = baseServings;
                  const displayedRecipe = {
                    ...entry.recipe,
                    servings: displayServings,
                    ingredients: entry.recipe.ingredients.map((item) => ({
                      ...item,
                      amount: scaleIngredientAmount(item.amount, baseServings, displayServings),
                    })),
                  };
                  return (
                    <div key={key} className={`${recipeStyles.recipeCard} ${styles.planRecipeCard}`}>
                          <div
                            className={`${recipeStyles.cardHeader} ${styles.planRecipeHeader}`}
                            role="button"
                            tabIndex={0}
                            aria-label={t.mealPlan.openRecipeLabel(entry.recipe.title)}
                            onClick={() => setPreviewRecipe({
                              ...displayedRecipe,
                              source: 'meal-plan',
                              sourceRecipeId: key,
                            })}
                            onKeyDown={(event) => {
                              if (event.target !== event.currentTarget) return;
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                setPreviewRecipe({
                                  ...displayedRecipe,
                                  source: 'meal-plan',
                                  sourceRecipeId: key,
                                });
                              }
                            }}
                          >
                            <button
                              type="button"
                              className={styles.planDish}
                              aria-label={t.mealPlan.openRecipeLabel(entry.recipe.title)}
                              onClick={(event) => {
                                event.stopPropagation();
                                setPreviewRecipe({
                                  ...displayedRecipe,
                                  source: 'meal-plan',
                                  sourceRecipeId: key,
                                });
                              }}
                            >
                              <RecipeThumbnail genre={entry.recipe.genre} fallbackIngredientName={entry.recipe.title} size={74} />
                            </button>
                            <div className={`${recipeStyles.titleInfo} ${styles.planTitleInfo}`}>
                              <div className={recipeStyles.badgeRow}>
                                <span className={recipeStyles.genreBadge}>{SLOT_LABEL[slot]}</span>
                                {entry.recipe.genre && <span className={recipeStyles.genreBadge}>{t.tagLabel[entry.recipe.genre] || entry.recipe.genre}</span>}
                                {entry.recipe.dish_badge && <span className={recipeStyles.climateBadge}>{entry.recipe.dish_badge}</span>}
                              </div>
                              <h2 className={recipeStyles.recipeTitle}>{entry.recipe.title}</h2>
                              <span className={recipeStyles.recipeTime}>
                                <UiIcon slug="timer_clock" collection="core" size={16} alt="" />
                                {entry.recipe.time} ・ {t.recipe.servingsUnit(displayServings)}{entry.recipe.nutrition ? ` ・ ${entry.recipe.nutrition.calories}kcal` : ''}
                              </span>
                              {(entry.recipe.ingredients || []).length > 0 && (
                                <div className={recipeStyles.ingredientIconRow}>
                                  {entry.recipe.ingredients.map((item, i) => (
                                    <IngredientIcon key={i} name={item.name} size={24} />
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className={`${recipeStyles.headerActions} ${styles.planHeaderActions}`}>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleRegenerateSlot(d.date, slot); }}
                                disabled={regeneratingKey === key}
                                title={t.mealPlan.regenerateTitle}
                                className={styles.iconButton}
                              >
                                {regeneratingKey === key ? <Loader2 className="spinner" size={14} /> : <RefreshCw size={14} />}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleRemoveSlot(d.date, slot); }}
                                title={t.mealPlan.removeTitle}
                                className={styles.iconButton}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </section>
      )}

      <RecipeDetailScreen
        recipe={previewRecipe}
        onClose={() => setPreviewRecipe(null)}
        onCompleted={() => {
          loadData();
          showToast(t.recipe.cookedCompletedToast);
        }}
      />

      <PremiumPaywall
        open={showPaywall}
        onClose={() => setShowPaywall(false)}
        onActivated={() => showToast(t.mealPlan.premiumWelcomeToast)}
      />
    </div>
  );
}
