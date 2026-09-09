"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings, Heart, ChevronRight, Receipt as ReceiptIcon, Refrigerator, Flame } from "lucide-react";
import ProfileSettingsModal from "@/components/ProfileSettingsModal";
import RecipeThumbnail from "@/components/RecipeThumbnail";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import {
  getLocalShoppingItems,
  getLocalUserStats,
  getLocalSavedRecipes,
  getOrCreateDeviceId,
  ShoppingItem,
  UserStats,
  SavedRecipe,
} from "@/lib/storage";
import styles from "./Home.module.css";

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

export default function HomePage() {
  const { t, language } = useLanguage();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [recentRecipes, setRecentRecipes] = useState<SavedRecipe[]>([]);

  const [dailyPick, setDailyPick] = useState<DailyPickRecipe | null>(null);
  const [dailyPickLoading, setDailyPickLoading] = useState(true);
  const [dailyPickExpanded, setDailyPickExpanded] = useState(false);

  const [communityRecipes, setCommunityRecipes] = useState<CommunityRecipeRow[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadLocal = () => {
      setStats(getLocalUserStats());
      setShoppingItems(getLocalShoppingItems().filter(i => !i.is_completed));
      setRecentRecipes([...getLocalSavedRecipes()].sort((a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime()).slice(0, 6));
    };
    loadLocal();
    window.addEventListener("storage-updated", loadLocal);
    return () => window.removeEventListener("storage-updated", loadLocal);
  }, []);

  useEffect(() => {
    fetch("/api/daily-pick")
      .then(res => res.ok ? res.json() : null)
      .then(data => setDailyPick(data?.recipe || null))
      .catch(() => setDailyPick(null))
      .finally(() => setDailyPickLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/community-recipes")
      .then(res => res.ok ? res.json() : null)
      .then(data => setCommunityRecipes(Array.isArray(data?.recipes) ? data.recipes : []))
      .catch(() => setCommunityRecipes([]));
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 5 || hour >= 18 ? t.home.greetingEvening : hour < 11 ? t.home.greetingMorning : t.home.greetingAfternoon;

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
      <div className={styles.greeting}>
        <img className={styles.greetingMascot} src="/mascot/bear_wave.png" alt="" width={56} height={56} />
        <div className={styles.greetingTextCol}>
          <p className={styles.greetingTitle}>{greeting} 👋</p>
          <p className={styles.greetingSubtitle}>{t.home.greetingSubtitle}</p>
        </div>
        <button type="button" className={styles.settingsBtn} onClick={() => setIsSettingsOpen(true)} title={t.home.settingsButtonTitle}>
          <Settings size={18} />
        </button>
      </div>

      <div className={styles.quickActions}>
        <Link href="/receipt" className={styles.quickActionBtn}>
          <ReceiptIcon size={18} />
          {t.home.quickScanReceipt}
        </Link>
        <Link href="/inventory" className={styles.quickActionBtn}>
          <Refrigerator size={18} />
          {t.home.quickAddIngredient}
        </Link>
      </div>

      <div className={`${styles.card} ${styles.cardPick}`}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>🧑‍🍳 {t.home.todaysPickTitle}</span>
        </div>
        {dailyPickLoading ? (
          <p className={styles.emptyLine}>{t.home.todaysPickLoading}</p>
        ) : !dailyPick ? (
          <p className={styles.emptyLine}>{t.home.todaysPickEmpty}</p>
        ) : (
          <>
            <div className={styles.pickBody}>
              <div className={styles.pickThumb}>
                <RecipeThumbnail genre={dailyPick.genre} fallbackIngredientName={pickText(dailyPick.title, language)} size={64} />
              </div>
              <div className={styles.pickTextCol}>
                <p className={styles.pickTagline}>{pickText(dailyPick.tagline, language)}</p>
                <p className={styles.pickTitle}>{pickText(dailyPick.title, language)}</p>
                <p className={styles.pickMeta}>⏱ {dailyPick.time}</p>
              </div>
              <button type="button" className={styles.pickViewBtn} onClick={() => setDailyPickExpanded(v => !v)}>
                {dailyPickExpanded ? t.home.todaysPickCloseButton : t.home.todaysPickViewButton}
              </button>
            </div>
            {dailyPickExpanded && (
              <div className={styles.pickDetail}>
                <div>
                  <p className={styles.pickDetailSectionTitle}>{t.recipe.ingredientsSectionTitle}</p>
                  <ul className={styles.pickIngredientsList}>
                    {dailyPick.ingredients.map((ing, i) => (
                      <li key={i} className={styles.pickIngredientChip}>
                        {pickText(ing.name, language)} {pickText(ing.amount, language)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className={styles.pickDetailSectionTitle}>{t.recipe.stepsSectionTitle}</p>
                  <ol className={styles.pickStepsList}>
                    {dailyPick.steps.map((step, i) => (
                      <li key={i}>{pickText(step, language)}</li>
                    ))}
                  </ol>
                </div>
                <p className={styles.pickTips}>{t.recipe.tipsPrefix}{pickText(dailyPick.tips, language)}</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className={`${styles.card} ${styles.cardShopping}`}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>🛒 {t.home.shoppingTitle}</span>
          <Link href="/shopping" className={styles.cardSeeAll}>{t.home.shoppingSeeAll}<ChevronRight size={14} /></Link>
        </div>
        {shoppingItems.length === 0 ? (
          <p className={styles.emptyLine}>{t.home.shoppingEmpty}</p>
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

      <div className={`${styles.card} ${styles.cardStreak}`}>
        <div className={styles.streakBody}>
          <span className={styles.streakCount}>{stats?.streak_days ?? 0}</span>
          <span className={styles.streakUnitLabel}>{t.home.streakUnit(stats?.streak_days ?? 0)}</span>
          <span className={styles.streakText}>
            <Flame size={14} style={{ verticalAlign: -2, marginRight: 4 }} color="var(--accent)" />
            {(stats?.streak_days ?? 0) > 0 ? t.home.streakEncouragement : t.home.streakZero}
          </span>
          <img className={styles.streakMascot} src="/mascot/bear_running.png" alt="" width={44} height={44} />
        </div>
      </div>

      <div className={styles.card} style={{ background: "var(--card-bg-solid)" }}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>📖 {t.home.recentRecipesTitle}</span>
          <Link href="/history" className={styles.cardSeeAll}>{t.home.recentRecipesSeeAll}<ChevronRight size={14} /></Link>
        </div>
        {recentRecipes.length === 0 ? (
          <p className={styles.emptyLine}>{t.home.recentRecipesEmpty}</p>
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

      <div className={`${styles.card} ${styles.cardCommunity}`}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>💗 {t.home.communityTitle}</span>
        </div>
        {communityRecipes.length === 0 ? (
          <p className={styles.emptyLine}>{t.home.communityEmpty}</p>
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

      <ProfileSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onSaved={() => setStats(getLocalUserStats())} />
    </div>
  );
}
