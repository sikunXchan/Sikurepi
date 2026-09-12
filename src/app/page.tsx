"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings, Heart, ChevronRight } from "lucide-react";
import ProfileSettingsModal from "@/components/ProfileSettingsModal";
import ChefProfileBadge from "@/components/ChefProfileBadge";
import RecipeThumbnail from "@/components/RecipeThumbnail";
import UiIcon from "@/components/UiIcon";
import KitchenLoader from "@/components/KitchenLoader";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import {
  getLocalShoppingItems,
  getLocalSavedRecipes,
  getLocalIngredients,
  getLocalUserProfile,
  getOrCreateDeviceId,
  getCachedDailyPick,
  getTodayLocalDateKey,
  setCachedDailyPick,
  setPendingDailyPickHandoff,
  getRecentFlavorFeedbackSummary,
  ShoppingItem,
  SavedRecipe,
} from "@/lib/storage";
import styles from "./Home.module.css";
import { buildDietaryConstraintKey } from "@/lib/dietaryRules";

type BilingualText = { ja: string; en: string };
type DailyPickRecipe = {
  title: BilingualText;
  tagline: BilingualText;
  time: string;
  genre: string;
  dish_badge?: string;
  ingredients: { name: BilingualText; amount: BilingualText }[];
  steps: BilingualText[];
  tips: BilingualText;
  nutrition: { calories: number; protein_g: number; fat_g: number; carbs_g: number };
};

type CommunityRecipeRow = {
  id: string;
  likes_count: number;
  recipe: { title: string; time?: string; genre?: string | null; dish_badge?: string | null };
};

function pickText(value: BilingualText | undefined, language: "ja" | "en"): string {
  if (!value) return "";
  return (language === "en" ? value.en : value.ja) || value.ja || value.en || "";
}

const subscribeToHydration = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

export default function HomePage() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [recentRecipes, setRecentRecipes] = useState<SavedRecipe[]>([]);

  const [dailyPickResult, setDailyPickResult] = useState<{
    constraintKey: string;
    recipe: DailyPickRecipe;
  } | null>(null);
  const [dailyPickSettledKey, setDailyPickSettledKey] = useState<string | null>(null);
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );
  const todayDate = getTodayLocalDateKey();
  const currentProfile = isHydrated ? getLocalUserProfile() : null;
  const dailyPickConstraintKey = currentProfile
    ? buildDietaryConstraintKey(
        currentProfile.dietaryRestrictions,
        currentProfile.excludedIngredients,
        currentProfile.allergies,
      )
    : '';
  const cachedDailyPick = isHydrated
    ? getCachedDailyPick<DailyPickRecipe>(todayDate, dailyPickConstraintKey)
    : null;
  const generatedDailyPick = dailyPickResult?.constraintKey === dailyPickConstraintKey
    ? dailyPickResult.recipe
    : null;
  const visibleDailyPick = generatedDailyPick ?? cachedDailyPick;
  const dailyPickLoading = !visibleDailyPick && dailyPickSettledKey !== dailyPickConstraintKey;

  const [communityRecipes, setCommunityRecipes] = useState<CommunityRecipeRow[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadLocal = () => {
      setShoppingItems(getLocalShoppingItems().filter(i => !i.is_completed));
      setRecentRecipes([...getLocalSavedRecipes()].sort((a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime()).slice(0, 6));
    };
    loadLocal();
    window.addEventListener("storage-updated", loadLocal);
    return () => window.removeEventListener("storage-updated", loadLocal);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    // 今日のパーソナライズ結果が端末にあれば通信もローディング表示も発生させない。
    const cached = getCachedDailyPick<DailyPickRecipe>(todayDate, dailyPickConstraintKey);
    if (cached) return;

    const profile = getLocalUserProfile();
    const hasHardConstraints = Boolean(
      profile.dietaryRestrictions?.length || profile.excludedIngredients?.length || profile.allergies?.length
    );
    const controller = new AbortController();
    let cancelled = false;
    fetch("/api/daily-pick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        date: todayDate,
        personalization: {
          inventory: getLocalIngredients().map(item => item.name),
          tastePreferences: profile.tastePreferences,
          excludedIngredients: profile.excludedIngredients,
          allergies: profile.allergies,
          cookingStyles: profile.cookingStyles,
          dietaryRestrictions: profile.dietaryRestrictions,
          preferredGenres: profile.preferredGenres,
          kitchenAppliances: profile.kitchenAppliances,
          targetCalories: profile.targetCalories,
          targetProtein: profile.targetProtein,
          flavorFeedback: getRecentFlavorFeedbackSummary(12),
        },
      }),
    })
      .then(async res => {
        if (res.ok) return res.json();
        // 食事制限・アレルギー・除外食材がある場合、条件未検証の共通枠へは
        // フォールバックしない。安全性を優先して明示的に空のままにする。
        if (hasHardConstraints) return null;
        const fallback = await fetch("/api/daily-pick", { signal: controller.signal });
        return fallback.ok ? fallback.json() : null;
      })
      .then(data => {
        if (cancelled) return;
        const recipe = data?.recipe || null;
        if (recipe) setDailyPickResult({ constraintKey: dailyPickConstraintKey, recipe });
        if (recipe) setCachedDailyPick(todayDate, recipe, dailyPickConstraintKey);
      })
      .catch(error => {
        if (!cancelled && error?.name !== "AbortError") {
          setDailyPickSettledKey(dailyPickConstraintKey);
        }
      })
      .finally(() => {
        if (!cancelled) setDailyPickSettledKey(dailyPickConstraintKey);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [dailyPickConstraintKey, isHydrated, todayDate]);

  useEffect(() => {
    fetch("/api/community-recipes")
      .then(res => res.ok ? res.json() : null)
      .then(data => setCommunityRecipes(Array.isArray(data?.recipes) ? data.recipes : []))
      .catch(() => setCommunityRecipes([]));
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 5 || hour >= 18 ? t.home.greetingEvening : hour < 11 ? t.home.greetingMorning : t.home.greetingAfternoon;

  // 「今日のおすすめ」をタップしたら、専用の簡易表示ではなくレシピタブの通常の
  // レシピカードと同じ見た目・機能(材料の不足表示・クッキングモード・保存・
  // 料理完了ボタン等)で開けるようにする。言語に応じた文言をここで確定させてから
  // レシピタブへ1回きりの受け渡しをし、遷移する。
  const handleOpenDailyPick = () => {
    if (!visibleDailyPick) return;
    setPendingDailyPickHandoff({
      title: pickText(visibleDailyPick.title, language),
      time: visibleDailyPick.time,
      genre: visibleDailyPick.genre,
      dish_badge: visibleDailyPick.dish_badge,
      ingredients: visibleDailyPick.ingredients.map(ing => ({
        name: pickText(ing.name, language),
        amount: pickText(ing.amount, language),
      })),
      steps: visibleDailyPick.steps.map(step => pickText(step, language)),
      tips: pickText(visibleDailyPick.tips, language),
      nutrition: visibleDailyPick.nutrition,
    });
    router.push("/recipe");
  };

  const handleLike = async (id: string) => {
    if (likedIds.has(id)) return;
    const deviceId = getOrCreateDeviceId();
    if (!deviceId) return;
    // 楽観的に即反映し、サーバーからの実際のカウントで後から補正する
    setLikedIds(prev => new Set(prev).add(id));
    setCommunityRecipes(prev => prev.map(r => r.id === id ? { ...r, likes_count: r.likes_count + 1 } : r));
    try {
      const res = await fetch(`/api/community-recipes/${id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.likes_count === "number") {
          setCommunityRecipes(prev => prev.map(r => r.id === id ? { ...r, likes_count: data.likes_count } : r));
        }
      }
    } catch {
      // 通信失敗時も楽観的な表示のままにする(見た目上は「いいね済み」で困らないため)
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.greeting}>
        <div className={styles.greetingMascotWrap}>
          <img className={styles.greetingMascot} src="/mascot/bear_wave.png" alt="" width={72} height={72} />
        </div>
        <div className={styles.greetingTextCol}>
          <p className={styles.greetingEyebrow}>SIKUREPI KITCHEN</p>
          <p className={styles.greetingTitle}>{greeting}</p>
          <p className={styles.greetingSubtitle}>{t.home.greetingSubtitle}</p>
        </div>
        <button type="button" className={styles.settingsBtn} onClick={() => setIsSettingsOpen(true)} title={t.home.settingsButtonTitle}>
          <Settings size={18} />
        </button>
      </header>

      <ChefProfileBadge />

      <div className={styles.quickActions}>
        <Link href="/receipt" className={styles.quickActionBtn}>
          <span className={`${styles.quickIcon} ${styles.quickIconWarm}`}><UiIcon slug="receipt" collection="core" size={28} alt="" /></span>
          <span><strong>{t.home.quickScanReceipt}</strong><small>SCAN</small></span>
        </Link>
        <Link href="/inventory" className={styles.quickActionBtn}>
          <span className={`${styles.quickIcon} ${styles.quickIconMint}`}><UiIcon slug="fridge" size={28} alt="" /></span>
          <span><strong>{t.home.quickAddIngredient}</strong><small>STOCK</small></span>
        </Link>
      </div>

      <div className={`${styles.card} ${styles.cardPick}`}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}><UiIcon slug="cooking_pot" size={25} alt="" />{t.home.todaysPickTitle}</span>
          <span className={styles.todayBadge}>TODAY</span>
        </div>
        {!isHydrated ? (
          <div className={styles.pickHydrationPlaceholder} aria-hidden="true" />
        ) : visibleDailyPick ? (
          <div className={styles.pickBody}>
            <div className={styles.pickThumb}>
              <RecipeThumbnail genre={visibleDailyPick.genre} fallbackIngredientName={pickText(visibleDailyPick.title, language)} size={64} />
            </div>
            <div className={styles.pickTextCol}>
              <p className={styles.pickTagline}>{pickText(visibleDailyPick.tagline, language)}</p>
              <p className={styles.pickTitle}>{pickText(visibleDailyPick.title, language)}</p>
              <p className={styles.pickMeta}><UiIcon slug="timer_clock" collection="core" size={16} alt="" />{visibleDailyPick.time}</p>
            </div>
            <button type="button" className={styles.pickViewBtn} onClick={handleOpenDailyPick}>
              {t.home.todaysPickViewButton}
            </button>
          </div>
        ) : dailyPickLoading ? (
          <KitchenLoader compact variant="cooking" text={t.home.todaysPickLoading} />
        ) : (
          <div className={styles.emptyKitchen}>
            <img src="/mascot/bear_sleeping.png" alt="" width={72} height={72} />
            <p>{t.home.todaysPickEmpty}</p>
          </div>
        )}
      </div>

      <div className={`${styles.card} ${styles.cardRecipes}`}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}><UiIcon slug="teishoku" size={24} alt="" />{t.home.recentRecipesTitle}</span>
          <Link href="/history" className={styles.cardSeeAll}>{t.home.recentRecipesSeeAll}<ChevronRight size={14} /></Link>
        </div>
        {recentRecipes.length === 0 ? (
          <div className={styles.emptyRow}><img src="/mascot/bear_reading.png" alt="" width={52} height={52} /><p>{t.home.recentRecipesEmpty}</p></div>
        ) : (
          <div className={styles.recentScroll}>
            {recentRecipes.map(recipe => (
              <Link key={recipe.id} href="/history" className={styles.recentCard}>
                <div className={styles.recentThumbWrap}>
                  <RecipeThumbnail genre={recipe.genre} fallbackIngredientName={recipe.title} size={108} />
                </div>
                <span className={styles.recentCardTitle}>{recipe.title}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className={styles.supportGrid}>
        <div className={`${styles.card} ${styles.cardShopping}`}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}><UiIcon slug="shopping_cart" collection="core" size={24} alt="" />{t.home.shoppingTitle}</span>
            <Link href="/shopping" className={styles.cardSeeAll}>{t.home.shoppingSeeAll}<ChevronRight size={14} /></Link>
          </div>
          {shoppingItems.length === 0 ? (
            <div className={styles.emptyRow}><UiIcon slug="shopping_cart" collection="core" size={34} alt="" /><p>{t.home.shoppingEmpty}</p></div>
          ) : (
            <ul className={styles.shoppingList}>
              {shoppingItems.slice(0, 3).map(item => (
                <li key={item.id} className={styles.shoppingRow}>
                  <span className={styles.shoppingRowName}>{item.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`${styles.card} ${styles.cardCommunity}`}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}><UiIcon slug="side_dish" size={24} alt="" />{t.home.communityTitle}</span>
          </div>
          {communityRecipes.length === 0 ? (
            <div className={styles.emptyRow}><UiIcon slug="main_dish" size={34} alt="" /><p>{t.home.communityEmpty}</p></div>
          ) : (
            <div className={styles.communityList}>
              {communityRecipes.map(row => (
                <div key={row.id} className={styles.communityRow}>
                  <div className={styles.communityRowInfo}>
                    <p className={styles.communityRowTitle}>{row.recipe.title}</p>
                  </div>
                  <button
                    type="button"
                    className={`${styles.likeBtn} ${likedIds.has(row.id) ? styles.likeBtnActive : ""}`}
                    onClick={() => handleLike(row.id)}
                    title={t.home.communityLikeTitle}
                  >
                    <Heart size={13} fill={likedIds.has(row.id) ? "currentColor" : "none"} />
                    {row.likes_count}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ProfileSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
