"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Trash2, Search, X, PlayCircle, Crown } from "lucide-react";
import { motion, AnimatePresence, animate as animateValue, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import CookingSession from "@/components/CookingSession";
import CookedModal from "@/components/CookedModal";
import IngredientIcon from "@/components/IngredientIcon";
import UiIcon from "@/components/UiIcon";
import RecipeThumbnail, { GENRE_ICON_SLUGS } from "@/components/RecipeThumbnail";
import PageHeader from "@/components/PageHeader";
import KitchenLoader from "@/components/KitchenLoader";
import PremiumPaywall from "@/components/PremiumPaywall";
import RecipeDetailScreen, { type RecipeDetailData } from "@/components/RecipeDetailScreen";
import RecipeConsiderationBadges from "@/components/RecipeConsiderationBadges";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { usePremium } from "@/lib/premium/PremiumContext";
import {
  getLocalSavedRecipes,
  deleteLocalSavedRecipe,
  deleteLocalCookingRecordsForRecipe,
  deleteLocalRecentRecipe,
  getLocalRecentRecipes,
  getLocalIngredients,
  computeIngredientFulfillment,
  getLocalUserProfile,
  getLocalUserStats,
  CookedRecord,
  RecentRecipe,
  SavedRecipe,
  Ingredient,
  UserProfile
} from "@/lib/storage";
import { FREE_HISTORY_ITEMS } from "@/lib/storage";
import { recipeServings, scaleIngredientAmount } from "@/lib/servingScale";
import styles from "./History.module.css";

// ジャンル別サムネイル(RecipeThumbnail)と同じ一覧を使い回し、追加時の二重管理を防ぐ
const GENRE_OPTIONS = Object.keys(GENRE_ICON_SLUGS);
const DELETE_REVEAL_X = -76;
const DELETE_REVEAL_SPRING = { type: "spring", stiffness: 500, damping: 42 } as const;

function SwipeDeleteRow({
  children,
  isOpen,
  onOpenChange,
  onDelete,
  deleteLabel,
}: {
  children: ReactNode;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  deleteLabel: string;
}) {
  const x = useMotionValue(0);
  const railOpacity = useTransform(x, [DELETE_REVEAL_X, -24, 0], [1, 0.65, 0]);

  useEffect(() => {
    if (!isOpen) animateValue(x, 0, DELETE_REVEAL_SPRING);
  }, [isOpen, x]);

  const finishSwipe = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const open = info.offset.x < -34 || info.velocity.x < -320;
    animateValue(x, open ? DELETE_REVEAL_X : 0, DELETE_REVEAL_SPRING);
    onOpenChange(open);
  };

  return (
    <div className={styles.swipeDeleteWrapper}>
      <motion.div className={styles.swipeDeleteRail} style={{ opacity: railOpacity }}>
        <button type="button" className={styles.swipeDeleteButton} onClick={onDelete} aria-label={deleteLabel}>
          <Trash2 size={19} />
        </button>
      </motion.div>
      <motion.div
        className={styles.swipeDeleteSurface}
        style={{ x }}
        drag="x"
        dragConstraints={{ left: DELETE_REVEAL_X, right: 0 }}
        dragElastic={0.04}
        dragDirectionLock
        onDragEnd={finishSwipe}
        onClickCapture={(event) => {
          if (!isOpen) return;
          event.preventDefault();
          event.stopPropagation();
          onOpenChange(false);
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

export default function HistoryPage() {
  const { t, language } = useLanguage();
  const { isPremium } = usePremium();
  const TIME_OPTIONS = t.history.timeOptions;
  const [allRecipes, setAllRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [cookedModalRecipe, setCookedModalRecipe] = useState<SavedRecipe | null>(null);
  const [cookingSessionRecipe, setCookingSessionRecipe] = useState<SavedRecipe | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>(getLocalUserProfile());
  const [rescueRecords, setRescueRecords] = useState<CookedRecord[]>([]);
  const [showPaywall, setShowPaywall] = useState(false);
  const [recentRecipes, setRecentRecipes] = useState<RecentRecipe[]>([]);
  const [previewRecipe, setPreviewRecipe] = useState<RecipeDetailData | null>(null);
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);

  // 「直近のレシピ」「保存したレシピ」を縦に並べず、横スライドで切り替える
  const [activeSection, setActiveSection] = useState<'recent' | 'saved'>('recent');
  const sectionScrollRef = useRef<HTMLDivElement>(null);

  const scrollToSection = (section: 'recent' | 'saved') => {
    const el = sectionScrollRef.current;
    setActiveSection(section);
    if (!el) return;
    el.scrollTo({ left: section === 'recent' ? 0 : el.clientWidth, behavior: 'smooth' });
  };

  const handleSectionScroll = () => {
    const el = sectionScrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const next = el.scrollLeft >= el.clientWidth / 2 ? 'saved' : 'recent';
    setActiveSection((prev) => (prev === next ? prev : next));
    setOpenSwipeId(null);
  };

  // Search/filter state
  const [searchText, setSearchText] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [filterTimeMax, setFilterTimeMax] = useState('');
  // 「作れる可能性があるレシピ」を洗い出すための並び替え(材料充足度が高い順)
  const [sortByFulfillment, setSortByFulfillment] = useState(false);

  function loadRecipes() {
    const savedRecipes = getLocalSavedRecipes();
    const stats = getLocalUserStats();
    setAllRecipes(savedRecipes);
    setRecentRecipes(getLocalRecentRecipes());
    setIngredients(getLocalIngredients());
    setUserProfile(getLocalUserProfile());
    setRescueRecords(
      stats.cooked_records
        .filter((record) => (record.rescuedIngredients?.length || 0) > 0)
        .slice(0, 8)
    );
    setLoading(false);
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(loadRecipes, 0);
    const handleUpdate = () => loadRecipes();
    window.addEventListener("storage-updated", handleUpdate);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener("storage-updated", handleUpdate);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Client-side filtering
  const accessibleRecipes = isPremium ? allRecipes : allRecipes.slice(0, FREE_HISTORY_ITEMS);
  const visibleRescueRecords = isPremium ? rescueRecords : rescueRecords.slice(0, FREE_HISTORY_ITEMS);
  const filteredRecipes = accessibleRecipes.filter(recipe => {
    if (searchText) {
      const q = searchText.toLowerCase();
      const inTitle = recipe.title.toLowerCase().includes(q);
      const inIngredients = Array.isArray(recipe.ingredients) &&
        recipe.ingredients.some(i => i.name.toLowerCase().includes(q));
      if (!inTitle && !inIngredients) return false;
    }
    if (filterGenre && recipe.genre !== filterGenre) return false;
    if (filterTimeMax) {
      const match = (recipe.time || '').match(/(\d+)/);
      if (match && parseInt(match[1], 10) > parseInt(filterTimeMax, 10)) return false;
    }
    return true;
  });

  // 「現在の在庫から作れる可能性があるレシピ」を洗い出すための材料充足度。
  // 「材料が1個でも一致したから作れる」という単純な判定ではなく、レシピの
  // 必要材料それぞれを在庫と照合し、その充足割合を算出する(常備調味料の扱いは
  // 在庫画面・レシピ生成と同じユーザー設定に揃える)。
  const fulfillmentByRecipeId = new Map(
    filteredRecipes.map(recipe => [
      recipe.id,
      computeIngredientFulfillment(
        Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
        ingredients,
        userProfile.assumeSeasoningsAvailable
      ),
    ])
  );

  const sortedRecipes = sortByFulfillment
    ? [...filteredRecipes].sort((a, b) => {
        const pa = fulfillmentByRecipeId.get(a.id)?.percent ?? 0;
        const pb = fulfillmentByRecipeId.get(b.id)?.percent ?? 0;
        return pb - pa;
      })
    : filteredRecipes;

  const hasFilters = searchText || filterGenre || filterTimeMax;

  const clearFilters = () => {
    setSearchText('');
    setFilterGenre('');
    setFilterTimeMax('');
  };

  const confirmDelete = (id: number) => {
    setTargetId(id);
    setModalOpen(true);
  };

  const handleDelete = () => {
    if (targetId === null) return;
    const target = allRecipes.find((recipe) => recipe.id === targetId);
    deleteLocalSavedRecipe(targetId);
    if (target) deleteLocalCookingRecordsForRecipe(target.id, target.title);
    setModalOpen(false);
    setTargetId(null);
    loadRecipes();
    showToast(t.history.deletedToast);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === "ja" ? "ja-JP" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className={styles.container}>
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(31, 41, 55, 0.95)',
          color: 'white',
          padding: '8px 18px',
          borderRadius: 9999,
          fontSize: 13,
          fontWeight: 700,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
          zIndex: 9999,
          pointerEvents: 'none',
        }}>
          {toastMessage}
        </div>
      )}

      <PageHeader
        title={t.history.title}
        subtitle={t.history.subtitle}
        mascot="bear_reading"
      />

      {!loading && rescueRecords.length > 0 && (
        <section className={styles.rescueShelf}>
          <div className={styles.rescueShelfHeader}>
            <div>
              <h2>{t.history.rescueShelfTitle}</h2>
              <p>{t.history.rescueShelfSubtitle}</p>
            </div>
          </div>
          <div className={styles.rescueRecordScroll}>
            {visibleRescueRecords.map((record, recordIndex) => {
              const rescued = record.rescuedIngredients || [];
              return (
                <article key={`${record.date}-${recordIndex}`} className={styles.rescueRecord}>
                  <div className={styles.rescueRecordIcons}>
                    {rescued.slice(0, 3).map((item) => (
                      <span key={item.name}><IngredientIcon name={item.name} size={48} /></span>
                    ))}
                  </div>
                  <strong>{rescued.map((item) => item.name).join("・")}</strong>
                  <span className={styles.rescueRecordRecipe}>{t.history.rescueRecordRecipe(record.recipeTitle)}</span>
                  <span className={styles.rescueRecordMeta}>
                    {t.history.rescueRecordCount(rescued.length)} · {formatDate(record.date)}
                  </span>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={styles.modalContent}
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
            >
              <div className={styles.modalIcon}>
                <Trash2 size={32} />
              </div>
              <h2 className={styles.modalTitle}>{t.history.deleteConfirmTitle}</h2>
              <p className={styles.modalText}>
                {t.history.deleteConfirmLine1}<br />{t.history.deleteConfirmLine2}
              </p>
              <div className={styles.modalActions}>
                <button className={styles.cancelBtn} onClick={() => setModalOpen(false)}>
                  {t.history.cancel}
                </button>
                <button className={styles.confirmDeleteBtn} onClick={handleDelete}>
                  {t.history.confirmDelete}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading && (
        <KitchenLoader compact variant="reading" text={t.history.subtitle} />
      )}

      {!loading && (
        <>
          <div className={styles.sectionTabs}>
            <button
              type="button"
              className={`${styles.sectionTab} ${activeSection === 'recent' ? styles.sectionTabActive : ''}`}
              onClick={() => scrollToSection('recent')}
            >
              {t.history.recentRecipesTitle}
              {recentRecipes.length > 0 && <span className={styles.sectionTabCount}>{recentRecipes.length}</span>}
            </button>
            <button
              type="button"
              className={`${styles.sectionTab} ${activeSection === 'saved' ? styles.sectionTabActive : ''}`}
              onClick={() => scrollToSection('saved')}
            >
              {t.history.savedRecipesTitle}
              {allRecipes.length > 0 && <span className={styles.sectionTabCount}>{allRecipes.length}</span>}
            </button>
          </div>

          <div className={styles.sectionScroll} ref={sectionScrollRef} onScroll={handleSectionScroll}>
          <div className={styles.sectionPane}>
          <section className={styles.recentCookedSection}>
          <p className={styles.paneSubtitle}>{t.history.recentRecipesSubtitle}</p>
          {recentRecipes.length > 0 ? (
            <div className={styles.recentCookedGrid}>
              {recentRecipes.map((recipe) => (
                <SwipeDeleteRow
                  key={recipe.id}
                  isOpen={openSwipeId === `recent:${recipe.id}`}
                  onOpenChange={(open) => setOpenSwipeId(open ? `recent:${recipe.id}` : null)}
                  deleteLabel={t.history.deleteRecentRecipeLabel(recipe.title)}
                  onDelete={() => {
                    deleteLocalRecentRecipe(recipe.id);
                    setOpenSwipeId(null);
                    loadRecipes();
                  }}
                >
                <article className={styles.recentCookedCard}>
                <button
                  type="button"
                  className={styles.recentCookedOpen}
                  onClick={() => setPreviewRecipe({
                    ...recipe,
                    sourceRecipeId: recipe.sourceRecipeId || recipe.id,
                  })}
                >
                  <RecipeThumbnail genre={recipe.genre || undefined} fallbackIngredientName={recipe.title} size={76} />
                  <span><strong>{recipe.title}</strong><small>{formatDate(recipe.recent_at)}</small></span>
                </button>
              </article>
              </SwipeDeleteRow>
              ))}
            </div>
          ) : (
            <p className={styles.recentRecipesEmpty}>{t.history.recentRecipesEmpty}</p>
          )}
        </section>
        </div>

        <div className={styles.sectionPane}>
          <p className={styles.paneSubtitle}>{t.history.savedRecipesSubtitle}</p>

          {/* Search & Filter */}
          {allRecipes.length > 0 && <div className={styles.searchSection}>
        <div className={styles.searchBar}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder={t.history.searchPlaceholder}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className={styles.searchInput}
          />
          {searchText && (
            <button className={styles.clearBtn} onClick={() => setSearchText('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className={styles.filterRow}>
          <select
            value={filterGenre}
            onChange={e => setFilterGenre(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">{t.history.genreAll}</option>
            {GENRE_OPTIONS.map(g => (
              <option key={g} value={g}>{t.tagLabel[g] || g}</option>
            ))}
          </select>

          <select
            value={filterTimeMax}
            onChange={e => setFilterTimeMax(e.target.value)}
            className={styles.filterSelect}
          >
            {TIME_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.value ? opt.label : t.history.timeAll}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={sortByFulfillment ? styles.sortByFulfillmentBtnActive : styles.sortByFulfillmentBtn}
            onClick={() => setSortByFulfillment(v => !v)}
            title={t.history.sortByFulfillmentHint}
          >
            <UiIcon slug="filter_sort" collection="core" size={16} alt="" /> {t.history.sortByFulfillment}
          </button>

          {hasFilters && (
            <button className={styles.clearFiltersBtn} onClick={clearFilters}>
              <X size={13} /> {t.history.resetFilters}
            </button>
          )}
        </div>

        {hasFilters && (
          <p className={styles.filterResult}>
            {t.history.filterResultCount(filteredRecipes.length, accessibleRecipes.length)}
          </p>
        )}
      </div>}

          {!isPremium && allRecipes.length > FREE_HISTORY_ITEMS && (
            <button type="button" className={styles.historyLimitCard} onClick={() => setShowPaywall(true)}>
              <Crown size={20} />
              <span><strong>{t.history.plusLimitTitle}</strong>{t.history.plusLimitBody(allRecipes.length - FREE_HISTORY_ITEMS)}</span>
            </button>
          )}
          {sortedRecipes.map((recipe) => {
            const fulfillment = fulfillmentByRecipeId.get(recipe.id);
            const baseServings = recipeServings(recipe.servings);
            const displayServings = baseServings;
            const displayedRecipe = {
              ...recipe,
              servings: displayServings,
              ingredients: recipe.ingredients.map((item) => ({
                ...item,
                amount: scaleIngredientAmount(item.amount, baseServings, displayServings),
              })),
            };
            return (
              <SwipeDeleteRow
                key={recipe.id}
                isOpen={openSwipeId === `saved:${recipe.id}`}
                onOpenChange={(open) => setOpenSwipeId(open ? `saved:${recipe.id}` : null)}
                deleteLabel={t.history.deleteButtonTitle}
                onDelete={() => {
                  setOpenSwipeId(null);
                  confirmDelete(recipe.id);
                }}
              >
              <div className={styles.recipeCard}>
                <div
                  className={styles.cardTopRow}
                  role="button"
                  tabIndex={0}
                  aria-label={t.history.openRecipeLabel(recipe.title)}
                  onClick={() => setPreviewRecipe({ ...recipe, source: 'history', sourceRecipeId: String(recipe.id) })}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setPreviewRecipe({ ...recipe, source: 'history', sourceRecipeId: String(recipe.id) });
                    }
                  }}
                >
                  <button
                    type="button"
                    className={styles.recipePreviewButton}
                    aria-label={t.history.openRecipeLabel(recipe.title)}
                    onClick={(event) => {
                      event.stopPropagation();
                      setPreviewRecipe({ ...recipe, source: 'history', sourceRecipeId: String(recipe.id) });
                    }}
                  >
                    <RecipeThumbnail
                      genre={recipe.genre}
                      fallbackIngredientName={recipe.title}
                      size={50}
                      className={styles.recipeIcon}
                    />
                  </button>

                  <div className={styles.titleInfo}>
                    <h2 className={styles.recipeTitle}>{recipe.title}</h2>
                    <div className={styles.recipeMetaRow}>
                      <span className={styles.recipeTime}><UiIcon slug="timer_clock" collection="core" size={16} alt="" />{recipe.time}</span>
                      <span className={styles.servingsBadge}>{t.recipe.servingsUnit(displayServings)}</span>
                      {recipe.genre && (
                        <span className={styles.genreBadge}>{t.tagLabel[recipe.genre] || recipe.genre}</span>
                      )}
                      {recipe.dish_badge && (
                        <span className={styles.genreBadge}>{recipe.dish_badge}</span>
                      )}
                      {fulfillment && fulfillment.totalCount > 0 && (
                        <span
                          className={styles.fulfillmentBadge}
                          data-level={fulfillment.percent >= 80 ? 'high' : fulfillment.percent >= 50 ? 'mid' : 'low'}
                          title={t.history.fulfillmentTitle(fulfillment.matchedCount, fulfillment.totalCount)}
                        >
                          <UiIcon slug="fridge" size={16} alt="" />{t.history.fulfillmentLabel(fulfillment.percent)}
                        </span>
                      )}
                    </div>
                    <RecipeConsiderationBadges considerations={recipe.considerations} compact />
                    <div className={styles.savedDate}>
                      <UiIcon slug="calendar_date" size={15} alt="" /> {formatDate(recipe.saved_at)}
                    </div>
                  </div>
                </div>

                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.cookBtn}
                    onClick={(e) => { e.stopPropagation(); setCookingSessionRecipe(displayedRecipe); }}
                  >
                    <PlayCircle size={15} />
                    {t.history.cookingButton}
                  </button>

                  <button
                    type="button"
                    className={styles.madeBtn}
                    onClick={(e) => { e.stopPropagation(); setCookedModalRecipe(displayedRecipe); }}
                  >
                    {t.history.cookedButton}
                  </button>

                </div>
              </div>
              </SwipeDeleteRow>
            );
          })}

          {filteredRecipes.length === 0 && accessibleRecipes.length > 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}><Search size={32} /></div>
              <p>{t.history.noFilterResults}</p>
              <button className={styles.clearFiltersBtn2} onClick={clearFilters}>{t.history.resetFiltersButton2}</button>
            </div>
          )}

          {allRecipes.length === 0 && (
            <div className={styles.emptyState}>
              <img src="/mascot/bear_reading.png" alt="" width={112} height={112} />
              <p>{t.history.emptyState}</p>
              <Link href="/recipe" className={styles.emptyStateCta}>{t.history.emptyStateCta}</Link>
            </div>
          )}
          </div>
          </div>
        </>
      )}

      {/* 調理完了モーダル */}
      <AnimatePresence>
        {cookedModalRecipe && (
          <CookedModal
            recipe={cookedModalRecipe}
            source="history"
            sourceRecipeId={cookedModalRecipe.id}
            onClose={() => setCookedModalRecipe(null)}
            onCompleted={() => {
              loadRecipes();
              showToast(t.recipe.cookedCompletedToast);
            }}
          />
        )}
      </AnimatePresence>

      <PremiumPaywall open={showPaywall} onClose={() => setShowPaywall(false)} />

      <RecipeDetailScreen
        recipe={previewRecipe}
        onClose={() => setPreviewRecipe(null)}
        onCompleted={() => {
          loadRecipes();
          showToast(t.recipe.cookedCompletedToast);
        }}
      />

      {/* クッキングセッション */}
      <AnimatePresence>
        {cookingSessionRecipe && (
          <CookingSession
            title={cookingSessionRecipe.title}
            steps={cookingSessionRecipe.steps || []}
            ingredients={cookingSessionRecipe.ingredients || []}
            completionRecipe={cookingSessionRecipe}
            source="history"
            sourceRecipeId={cookingSessionRecipe.id}
            onClose={() => setCookingSessionRecipe(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

