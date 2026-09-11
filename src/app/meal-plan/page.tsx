"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Trash2, ChevronDown, ChevronUp, ShoppingCart, Crown, X, Check, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import NutritionChart from "@/components/NutritionChart";
import IngredientIcon from "@/components/IngredientIcon";
import UiIcon from "@/components/UiIcon";
import PageHeader from "@/components/PageHeader";
import CookedModal from "@/components/CookedModal";
import KitchenLoader from "@/components/KitchenLoader";
import RecipeThumbnail from "@/components/RecipeThumbnail";
import KitchenFlowBar from "@/components/KitchenFlowBar";
import {
  getLocalIngredients,
  getLocalUserProfile,
  getLocalClimateState,
  getRecentLocalRecipeNames,
  addLocalShoppingItem,
  getLocalWeekPlan,
  setLocalWeekPlanEntries,
  removeLocalWeekPlanEntry,
  getFreeGenerationsUsed,
  incrementFreeGenerationsUsed,
  isIngredientMissing,
  FREE_WEEKLY_PLAN_GENERATIONS,
  Ingredient,
  UserProfile,
  MealSlot,
  WeeklyPlanEntry,
} from "@/lib/storage";
import { isNativeApp, hasPremiumEntitlement, purchasePremium } from "@/lib/purchases";
import { useLanguage } from "@/lib/i18n/LanguageContext";
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
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [weeklyTargets, setWeeklyTargets] = useState<{ calories: number; protein_g: number; fat_g: number; carbs_g: number } | null>(null);
  const [pinnedToShoppingSet, setPinnedToShoppingSet] = useState<Set<string>>(new Set());
  // 献立から生成された料理も、レシピ生成画面(recipe/page.tsx)と同じ
  // CookedModal(在庫消費・自炊記録への連携)を使って「料理完了」できるようにする
  const [cookedModalEntry, setCookedModalEntry] = useState<WeeklyPlanEntry | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener("storage-updated", handleUpdate);
    if (isNativeApp()) {
      hasPremiumEntitlement().then(setIsPremium);
    }
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
      },
      climate: profile.enableClimate !== false ? currentClimate : undefined,
      recentHistory,
      mode: ingredients.length > 0 ? 'inventory' : 'free',
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
    },
  });

  const handleGenerate = async () => {
    const slots = activeSlots();
    if (slots.length === 0) {
      setErrorMsg(t.mealPlan.errorNoSlots);
      return;
    }
    if (isNativeApp() && !isPremium && getFreeGenerationsUsed() >= FREE_WEEKLY_PLAN_GENERATIONS) {
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
      setLocalWeekPlanEntries(entries);
      setWeeklyTargets(data.weeklyTargets || null);
      if (isNativeApp() && !isPremium) incrementFreeGenerationsUsed();
      loadData();
      showToast(t.mealPlan.generatedToast(entries.length));
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : t.mealPlan.errorGeneric);
    } finally {
      setGenerating(false);
    }
  };

  const handlePurchasePremium = async () => {
    setPurchasing(true);
    setPurchaseError("");
    try {
      const result = await purchasePremium();
      if (result.success) {
        setIsPremium(true);
        setShowPaywall(false);
        showToast(t.mealPlan.premiumWelcomeToast);
      } else if (result.error) {
        setPurchaseError(result.error);
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRegenerateSlot = async (date: string, mealSlot: MealSlot) => {
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
      setLocalWeekPlanEntries([mapPlanItem(r)]);
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

  const handlePinToShopping = (slotKey: string, ingredientName: string) => {
    const pinKey = `${slotKey}-${ingredientName}`;
    if (pinnedToShoppingSet.has(pinKey)) return;
    addLocalShoppingItem(ingredientName);
    setPinnedToShoppingSet(prev => new Set(prev).add(pinKey));
    showToast(t.mealPlan.pinnedToShoppingToast(ingredientName));
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
        actions={
          isNativeApp() && isPremium ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 800, color: '#b45309', background: 'rgba(245, 158, 11, 0.14)', padding: '5px 11px', borderRadius: 20 }}>
              <Crown size={13} /> {t.mealPlan.premiumBadge}
            </span>
          ) : undefined
        }
      />
      <KitchenFlowBar active="mealPlan" />
      <section className={`${styles.planner} ${generating ? styles.plannerBusy : ''}`} aria-busy={generating}>
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
        {isNativeApp() && !isPremium && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>
            {t.mealPlan.freeRemaining(Math.max(0, FREE_WEEKLY_PLAN_GENERATIONS - getFreeGenerationsUsed()))}
          </p>
        )}
      </section>

      {generating && (
        <KitchenLoader variant="cooking" text={t.mealPlan.generatingText} />
      )}

      {errorMsg && (
        <div className={styles.errorCard} role="alert">
          {errorMsg}
        </div>
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
                  const isExpanded = expandedKey === key;
                  return (
                    <div key={key} className={`${recipeStyles.recipeCard} ${styles.planRecipeCard}`}>
                          <div className={`${recipeStyles.cardHeader} ${styles.planRecipeHeader}`} onClick={() => setExpandedKey(isExpanded ? null : key)}>
                            <div className={styles.planDish}>
                              <RecipeThumbnail genre={entry.recipe.genre} fallbackIngredientName={entry.recipe.title} size={74} />
                            </div>
                            <div className={`${recipeStyles.titleInfo} ${styles.planTitleInfo}`}>
                              <div className={recipeStyles.badgeRow}>
                                <span className={recipeStyles.genreBadge}>{SLOT_LABEL[slot]}</span>
                                {entry.recipe.genre && <span className={recipeStyles.genreBadge}>{t.tagLabel[entry.recipe.genre] || entry.recipe.genre}</span>}
                                {entry.recipe.dish_badge && <span className={recipeStyles.climateBadge}>{entry.recipe.dish_badge}</span>}
                              </div>
                              <h2 className={recipeStyles.recipeTitle}>{entry.recipe.title}</h2>
                              <span className={recipeStyles.recipeTime}>
                                <UiIcon slug="timer_clock" collection="core" size={16} alt="" />
                                {entry.recipe.time}{entry.recipe.nutrition ? ` ・ ${entry.recipe.nutrition.calories}kcal` : ''}
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
                              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </div>
                          </div>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                style={{ overflow: 'hidden' }}
                              >
                                <div className={`${recipeStyles.cardContent} ${styles.planCardContent}`}>
                                  {entry.recipe.nutrition && (
                                    <div className={recipeStyles.nutritionSection}>
                                      <NutritionChart nutrition={entry.recipe.nutrition} />
                                    </div>
                                  )}
                                  <div className={recipeStyles.section}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                      <h3>{t.mealPlan.ingredientsTitle}</h3>
                                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.mealPlan.ingredientsHint}</span>
                                    </div>
                                    <ul className={recipeStyles.ingredientList}>
                                      {(entry.recipe.ingredients || []).map((it, i) => {
                                        const missing = isIngredientMissing(it.name, ingredients, profile.assumeSeasoningsAvailable);
                                        const pinKey = `${key}-${it.name}`;
                                        const isPinned = pinnedToShoppingSet.has(pinKey);
                                        return (
                                          <li key={i} className={missing ? recipeStyles.ingredientMissing : undefined}>
                                            <span className={recipeStyles.ingredientName}>
                                              <IngredientIcon name={it.name} size={30} />
                                              <span style={{ color: missing ? '#d92b3f' : 'var(--foreground)', fontWeight: missing ? 800 : 600 }}>
                                                {it.name}
                                              </span>
                                            </span>
                                            <span className={recipeStyles.ingredientRight}>
                                              <span className={recipeStyles.ingredientAmount}>{it.amount}</span>
                                              {missing && (
                                                <button
                                                  type="button"
                                                  onClick={() => handlePinToShopping(key, it.name)}
                                                  className={isPinned ? recipeStyles.addedBtn : recipeStyles.addToCartBtn}
                                                  disabled={isPinned}
                                                >
                                                  {isPinned ? <Check size={15} /> : <Plus size={15} />}
                                                  {isPinned ? t.mealPlan.added : t.mealPlan.addShort}
                                                </button>
                                              )}
                                            </span>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                  <div className={recipeStyles.section}>
                                    <h3>{t.mealPlan.stepsTitle}</h3>
                                    <ol className={recipeStyles.stepList}>
                                      {(entry.recipe.steps || []).map((s, i) => (
                                        <li key={i}>
                                          <span className={recipeStyles.stepNumber}>{i + 1}</span>
                                          <span className={recipeStyles.stepText}>{s}</span>
                                        </li>
                                      ))}
                                    </ol>
                                  </div>
                                  {entry.recipe.tips && (
                                    <div className={recipeStyles.tipsBox} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                      <UiIcon slug="tips_idea" size={32} alt="" />
                                      <span>{entry.recipe.tips}</span>
                                    </div>
                                  )}

                                  {/* 料理完了ボタン (在庫消費 & PFC累積) : レシピ生成画面と同じ導線・見た目にする */}
                                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                                    <button
                                      type="button"
                                      style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 8,
                                        background: 'linear-gradient(135deg, #ff6f91 0%, #ff4f7d 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 12,
                                        padding: '12px 14px',
                                        fontSize: 14,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        boxShadow: '0 3px 10px rgba(255, 111, 145, 0.25)',
                                      }}
                                      onClick={(e) => { e.stopPropagation(); setCookedModalEntry(entry); }}
                                    >
                                      {t.recipe.cookedButton}
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </section>
      )}

      {/* 調理完了モーダル: 在庫消費・自炊記録への連携をレシピ生成画面と共通化する */}
      <AnimatePresence>
        {cookedModalEntry && (
          <CookedModal
            recipe={cookedModalEntry.recipe}
            onClose={() => setCookedModalEntry(null)}
            onCompleted={() => {
              loadData();
              showToast(t.recipe.cookedCompletedToast);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPaywall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 20 }}
            onClick={() => !purchasing && setShowPaywall(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              style={{ position: 'relative', background: 'var(--card-bg-solid, #fff)', borderRadius: 20, padding: 24, maxWidth: 360, width: '100%', textAlign: 'center' }}
            >
              <button
                type="button"
                onClick={() => setShowPaywall(false)}
                disabled={purchasing}
                style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
              <Crown size={40} color="#f59e0b" style={{ marginBottom: 8 }} />
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px' }}>{t.mealPlan.paywallTitle}</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 16 }}>
                {t.mealPlan.paywallText(FREE_WEEKLY_PLAN_GENERATIONS)}
              </p>
              {purchaseError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 12 }}>
                  {purchaseError}
                </div>
              )}
              <button
                type="button"
                onClick={handlePurchasePremium}
                disabled={purchasing}
                className="btn-primary"
                style={{ width: '100%', padding: 12, fontSize: 14, fontWeight: 700 }}
              >
                {purchasing ? (<><Loader2 className="spinner" size={16} />{t.mealPlan.purchaseProcessing}</>) : (<><Crown size={16} />{t.mealPlan.purchaseButton}</>)}
              </button>
              <button
                type="button"
                onClick={() => setShowPaywall(false)}
                disabled={purchasing}
                style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', padding: 8 }}
              >
                {t.mealPlan.purchaseLater}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
