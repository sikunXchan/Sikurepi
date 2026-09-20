"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bookmark, Check, Crown, Lightbulb, Minus, PlayCircle, Plus, X } from "lucide-react";
import CookedModal from "./CookedModal";
import CookingSession from "./CookingSession";
import IngredientIcon from "./IngredientIcon";
import NutritionChart from "./NutritionChart";
import RecipeThumbnail from "./RecipeThumbnail";
import UiIcon from "./UiIcon";
import PremiumPaywall from "./PremiumPaywall";
import RecipeConsiderationBadges from "./RecipeConsiderationBadges";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { usePremium } from "@/lib/premium/PremiumContext";
import {
  addLocalShoppingItem,
  CookedRecord,
  getLocalIngredients,
  getLocalSavedRecipes,
  getLocalUserProfile,
  isIngredientMissing,
  NutritionData,
  MealComponent,
  MealFormat,
  saveLocalRecipe,
} from "@/lib/storage";
import { recipeServings, scaleIngredientAmount } from "@/lib/servingScale";
import { getTrayTheme } from "@/lib/trayThemes";
import type { RecipeConsiderations } from "@/lib/recipeConsiderations";
import styles from "@/app/recipe/Recipe.module.css";

export type RecipeDetailData = {
  communityRecipeId?: string;
  translationNotice?: string;
  title: string;
  time: string;
  genre?: string | null;
  climate_badge?: string | null;
  dish_badge?: string | null;
  considerations?: RecipeConsiderations;
  course?: string | null;
  ingredients: { name: string; amount: string }[];
  steps: string[];
  tips: string;
  image_url?: string | null;
  nutrition?: NutritionData | null;
  servings?: number;
  source?: NonNullable<CookedRecord["source"]>;
  sourceRecipeId?: string;
  meal_format?: MealFormat;
  components?: MealComponent[];
};

const COURSE_ICON_SLUGS: Record<string, string> = {
  "主菜": "main_dish",
  "副菜": "side_dish",
  "汁物": "soup_course",
  "ご飯・主食": "rice_staple",
  "主食": "rice_staple",
};

const stripLeadingEmoji = (value: string) => value
  .replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D\s]+/gu, "")
  .trim();

function sameTitle(left: string, right: string): boolean {
  return left.normalize("NFKC").trim().toLocaleLowerCase()
    === right.normalize("NFKC").trim().toLocaleLowerCase();
}

export default function RecipeDetailScreen({
  recipe,
  onClose,
  onCompleted,
}: {
  recipe: RecipeDetailData | null;
  onClose: () => void;
  onCompleted?: () => void;
}) {
  const { t, language } = useLanguage();
  const { isPremium } = usePremium();
  const [servings, setServings] = useState(2);
  const [saved, setSaved] = useState(false);
  const [pinnedNames, setPinnedNames] = useState<Set<string>>(new Set());
  const [cooking, setCooking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  useEffect(() => {
    if (!recipe) return;
    // この画面は同じインスタンスで別レシピへ切り替わるため、外部propに追従して
    // 操作中の人数・保存表示・サブ画面を初期化する必要がある。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setServings(recipeServings(recipe.servings));
    setSaved(getLocalSavedRecipes().some((item) => sameTitle(item.title, recipe.title)));
    setPinnedNames(new Set());
    setCooking(false);
    setRecording(false);
    setShowPaywall(false);
  }, [recipe]);

  useEffect(() => {
    if (!recipe) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !cooking && !recording) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [cooking, onClose, recipe, recording]);

  const baseServings = recipeServings(recipe?.servings);
  const displayedRecipe = useMemo<RecipeDetailData | null>(() => recipe ? {
    ...recipe,
    servings,
    ingredients: recipe.ingredients.map((item) => ({
      ...item,
      amount: scaleIngredientAmount(item.amount, baseServings, servings),
    })),
  } : null, [baseServings, recipe, servings]);

  if (!mounted || typeof document === "undefined") return null;

  const handleSave = () => {
    if (!displayedRecipe || saved) return;
    saveLocalRecipe({
      communityRecipeId: displayedRecipe.communityRecipeId,
      title: displayedRecipe.title,
      time: displayedRecipe.time,
      ingredients: displayedRecipe.ingredients,
      steps: displayedRecipe.steps,
      tips: displayedRecipe.tips,
      image_url: displayedRecipe.image_url || null,
      nutrition: displayedRecipe.nutrition || null,
      genre: displayedRecipe.genre || null,
      dish_badge: displayedRecipe.dish_badge || null,
      considerations: displayedRecipe.considerations,
      servings: displayedRecipe.servings,
      meal_format: displayedRecipe.meal_format,
      components: displayedRecipe.components,
    });
    setSaved(true);
  };

  const handleAddToShopping = (name: string) => {
    if (pinnedNames.has(name)) return;
    addLocalShoppingItem(name);
    setPinnedNames((current) => new Set(current).add(name));
  };

  const profile = getLocalUserProfile();
  const inventory = getLocalIngredients();
  const tray = getTrayTheme(isPremium ? profile.trayTheme : "wood");

  return createPortal(
    <>
      <AnimatePresence>
        {displayedRecipe && !cooking && !recording && (
          <motion.div
            className={styles.recipeDetailOverlay}
            role="dialog"
            aria-modal="true"
            aria-label={displayedRecipe.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className={styles.recipeDetailTopbar}>
              <button type="button" className={styles.recipeDetailClose} onClick={onClose} aria-label={language === "ja" ? "閉じる" : "Close"}>
                <X size={22} />
              </button>
              <strong>{displayedRecipe.title}</strong>
              <button type="button" className={saved ? styles.savedBtn : styles.saveBtn} onClick={handleSave} disabled={saved}>
                {saved ? <Check size={15} /> : <Bookmark size={15} />}
                {saved ? t.recipe.saved : t.recipe.save}
              </button>
            </div>

            <div className={styles.recipeDetailScroll}>
              <div
                className={`${styles.recipeDetailHero} ${displayedRecipe.meal_format === "set" && displayedRecipe.components?.length ? styles.recipeDetailHeroSet : ""}`}
                style={{ backgroundImage: `url("${tray.asset}")`, backgroundSize: tray.backgroundSize }}
              >
                {displayedRecipe.meal_format === "set" && displayedRecipe.components?.length ? (
                  <div className={styles.recipeDetailSetGrid}>
                    {displayedRecipe.components.slice(0, 4).map((component, index) => (
                      <div className={styles.recipeDetailSetDish} key={`${component.course}-${component.title}-${index}`}>
                        <RecipeThumbnail
                          genre={component.genre || displayedRecipe.genre || undefined}
                          fallbackIngredientName={component.title}
                          size={150}
                          className={styles.recipeDetailSetDishIcon}
                        />
                        <span className={styles.recipeDetailSetDishCourse}>
                          <UiIcon slug={COURSE_ICON_SLUGS[component.course] || "other"} size={13} alt="" />
                          {t.recipe.courseLabel[component.course] || component.course}
                        </span>
                        <strong>{component.title}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <RecipeThumbnail genre={displayedRecipe.genre || undefined} fallbackIngredientName={displayedRecipe.title} size={320} className={styles.recipeDetailDishIcon} />
                )}
              </div>

              <div className={styles.recipeDetailSummary}>
                <div className={styles.badgeRow}>
                  {displayedRecipe.course && (
                    <span className={styles.genreBadge}><UiIcon slug={COURSE_ICON_SLUGS[displayedRecipe.course] || "other"} size={16} alt="" /> {t.recipe.courseLabel[displayedRecipe.course] || displayedRecipe.course}</span>
                  )}
                  {displayedRecipe.genre && <span className={styles.genreBadge}>{t.tagLabel[displayedRecipe.genre] || displayedRecipe.genre}</span>}
                  {displayedRecipe.translationNotice && <p role="status">{displayedRecipe.translationNotice}</p>}
                  {displayedRecipe.climate_badge && <span className={styles.climateBadge}><UiIcon slug="clear" size={15} alt="" />{stripLeadingEmoji(displayedRecipe.climate_badge)}</span>}
                  {displayedRecipe.dish_badge && <span className={styles.climateBadge}><UiIcon slug="dishwashing" size={15} alt="" />{stripLeadingEmoji(displayedRecipe.dish_badge)}</span>}
                </div>
                <RecipeConsiderationBadges considerations={displayedRecipe.considerations} />
                <h2 className={styles.recipeTitle}>{displayedRecipe.title}</h2>
                <span className={styles.recipeTime}><UiIcon slug="timer_clock" collection="core" size={16} alt="" />{displayedRecipe.time}<span aria-hidden="true">・</span>{t.recipe.servingsUnit(servings)}</span>
                <div className={styles.ingredientIconRow}>
                  {displayedRecipe.ingredients.slice(0, 9).map((item, index) => <IngredientIcon key={`${item.name}-${index}`} name={item.name} size={25} />)}
                </div>
              </div>

              <div className={styles.recipeDetailContent}>
                {displayedRecipe.nutrition && <div className={styles.nutritionSection}><NutritionChart nutrition={displayedRecipe.nutrition} /></div>}

                <div className={styles.section}>
                  <div className={styles.detailSectionHeading}>
                    <h3>{t.recipe.ingredientsSectionTitle}</h3>
                    <div className={styles.detailServingsControl} aria-label={t.recipe.servingsLabel}>
                      <button type="button" disabled={servings <= 1} onClick={() => setServings((value) => Math.max(1, value - 1))} aria-label={language === "ja" ? "人数を減らす" : "Decrease servings"}><Minus size={17} strokeWidth={3} /></button>
                      <strong>{t.recipe.servingsUnit(servings)}</strong>
                      <button type="button" disabled={servings >= 15} onClick={() => setServings((value) => Math.min(15, value + 1))} aria-label={language === "ja" ? "人数を増やす" : "Increase servings"}><Plus size={17} strokeWidth={3} /></button>
                    </div>
                  </div>
                  {servings !== baseServings && <p className={styles.servingScaleNotice}>{language === "ja" ? "分量は目安です。卵など分けにくい食材や調味料は、作りやすい量と味見で調整してください。" : "Amounts are estimates. Round indivisible ingredients and adjust seasonings to taste."}</p>}
                  <ul className={styles.ingredientList}>
                    {displayedRecipe.ingredients.map((item, index) => {
                      const missing = isIngredientMissing(item.name, inventory, profile.assumeSeasoningsAvailable);
                      const pinned = pinnedNames.has(item.name);
                      return (
                        <li key={`${item.name}-${index}`} className={missing ? styles.ingredientMissing : undefined}>
                          <span className={styles.ingredientName}><IngredientIcon name={item.name} size={30} /><span style={{ color: missing ? "#d92b3f" : "var(--foreground)", fontWeight: missing ? 800 : 600 }}>{item.name}</span></span>
                          <span className={styles.ingredientRight}>
                            <span className={styles.ingredientAmount}>{item.amount}</span>
                            {missing && <button type="button" onClick={() => handleAddToShopping(item.name)} className={pinned ? styles.addedBtn : styles.addToCartBtn} disabled={pinned}>{pinned ? <Check size={15} /> : <Plus size={15} />}{pinned ? t.recipe.addedToShopping : t.recipe.addToShopping}</button>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h3>{t.recipe.stepsSectionTitle}</h3>
                    <button type="button" className={styles.startCookingBtn} onClick={() => setCooking(true)}><PlayCircle size={16} />{t.recipe.cookingModeButton}</button>
                  </div>
                  <ol className={styles.stepList}>{displayedRecipe.steps.map((step, index) => <li key={index}><span className={styles.stepNumber}>{index + 1}</span><span className={styles.stepText}>{step}</span></li>)}</ol>
                </div>

                {displayedRecipe.tips && isPremium && <div className={styles.tipsBox}><strong>{t.recipe.tipsPrefix}</strong> {displayedRecipe.tips}</div>}
                {displayedRecipe.tips && !isPremium && <button type="button" className={styles.premiumTipsGate} onClick={() => setShowPaywall(true)}><Lightbulb size={20} /><span><strong>{t.recipe.tipsPlusTitle}</strong>{t.recipe.tipsPlusBody}</span><Crown size={15} /></button>}
                <button type="button" className={styles.cookedDetailBtn} onClick={() => setRecording(true)}>{t.recipe.cookedButton}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {displayedRecipe && cooking && <CookingSession title={displayedRecipe.title} steps={displayedRecipe.steps} ingredients={displayedRecipe.ingredients} completionRecipe={displayedRecipe} source={displayedRecipe.source || "generated"} sourceRecipeId={displayedRecipe.sourceRecipeId} onClose={() => setCooking(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {displayedRecipe && recording && <CookedModal recipe={displayedRecipe} source={displayedRecipe.source || "generated"} sourceRecipeId={displayedRecipe.sourceRecipeId} onClose={() => setRecording(false)} onCompleted={onCompleted} />}
      </AnimatePresence>
      <PremiumPaywall open={showPaywall} onClose={() => setShowPaywall(false)} />
    </>,
    document.body,
  );
}
