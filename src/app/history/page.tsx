"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2, ChevronDown, ChevronUp, Search, X, PlayCircle, Check, Plus, Minus, Crown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import NutritionChart from "@/components/NutritionChart";
import CookingSession from "@/components/CookingSession";
import CookedModal from "@/components/CookedModal";
import IngredientIcon from "@/components/IngredientIcon";
import UiIcon from "@/components/UiIcon";
import RecipeThumbnail, { GENRE_ICON_SLUGS } from "@/components/RecipeThumbnail";
import PageHeader from "@/components/PageHeader";
import KitchenLoader from "@/components/KitchenLoader";
import PremiumPaywall from "@/components/PremiumPaywall";
import RecipeDetailScreen, { type RecipeDetailData } from "@/components/RecipeDetailScreen";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { usePremium } from "@/lib/premium/PremiumContext";
import {
  getLocalSavedRecipes,
  deleteLocalSavedRecipe,
  deleteLocalCookingRecordsForRecipe,
  deleteLocalCookedRecord,
  getLocalIngredients,
  addLocalShoppingItem,
  isIngredientMissing,
  computeIngredientFulfillment,
  getLocalUserProfile,
  getLocalUserStats,
  CookedRecord,
  CookedRecipeSnapshot,
  SavedRecipe,
  Ingredient,
  UserProfile
} from "@/lib/storage";
import { FREE_HISTORY_ITEMS } from "@/lib/storage";
import { recipeServings, scaleIngredientAmount } from "@/lib/servingScale";
import styles from "./History.module.css";

// ジャンル別サムネイル(RecipeThumbnail)と同じ一覧を使い回し、追加時の二重管理を防ぐ
const GENRE_OPTIONS = Object.keys(GENRE_ICON_SLUGS);

export default function HistoryPage() {
  const { t, language } = useLanguage();
  const { isPremium } = usePremium();
  const TIME_OPTIONS = t.history.timeOptions;
  const [allRecipes, setAllRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [cookedModalRecipe, setCookedModalRecipe] = useState<SavedRecipe | null>(null);
  const [cookingSessionRecipe, setCookingSessionRecipe] = useState<SavedRecipe | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>(getLocalUserProfile());
  const [pinnedToShoppingSet, setPinnedToShoppingSet] = useState<Set<string>>(new Set());
  const [rescueRecords, setRescueRecords] = useState<CookedRecord[]>([]);
  const [showPaywall, setShowPaywall] = useState(false);
  const [servingOverrides, setServingOverrides] = useState<Record<number, number>>({});
  const [recentCookedRecords, setRecentCookedRecords] = useState<Array<{
    record: CookedRecord;
    recordIndex: number;
    recipe: CookedRecipeSnapshot | SavedRecipe | null;
  }>>([]);
  const [previewRecipe, setPreviewRecipe] = useState<RecipeDetailData | null>(null);

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
    setIngredients(getLocalIngredients());
    setUserProfile(getLocalUserProfile());
    setRescueRecords(
      stats.cooked_records
        .filter((record) => (record.rescuedIngredients?.length || 0) > 0)
        .slice(0, 8)
    );
    setRecentCookedRecords(
      (stats.cooked_records || []).slice(0, 3).map((record, recordIndex) => ({
        record,
        recordIndex,
        recipe: record.recipe || savedRecipes.find((saved) =>
          saved.title.normalize('NFKC').trim().toLocaleLowerCase()
            === record.recipeTitle.normalize('NFKC').trim().toLocaleLowerCase()
        ) || null,
      }))
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

  const handlePinToShopping = (recipeId: number, ingredientName: string) => {
    const key = `${recipeId}-${ingredientName}`;
    if (pinnedToShoppingSet.has(key)) return;
    addLocalShoppingItem(ingredientName);
    setPinnedToShoppingSet(prev => new Set(prev).add(key));
    showToast(t.recipe.pinnedToShoppingToast(ingredientName));
  };

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
    if (expandedId === targetId) setExpandedId(null);
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

      {!loading && recentCookedRecords.length > 0 && (
        <section className={styles.recentCookedSection}>
          <div className={styles.historySectionHeading}>
            <div>
              <h2>{language === 'ja' ? '直近に作った料理' : 'Recently cooked'}</h2>
              <p>{language === 'ja' ? '調理完了した最新3件です' : 'Your latest three completed dishes'}</p>
            </div>
          </div>
          <div className={styles.recentCookedGrid}>
            {recentCookedRecords.map(({ record, recordIndex, recipe }) => (
              <article key={`${record.date}-${recordIndex}`} className={styles.recentCookedCard}>
                <button
                  type="button"
                  className={styles.recentCookedOpen}
                  disabled={!recipe}
                  onClick={() => recipe && setPreviewRecipe({
                    ...recipe,
                    source: 'history',
                    sourceRecipeId: record.sourceRecipeId || `cooked-${record.date}`,
                  })}
                >
                  <RecipeThumbnail genre={recipe?.genre || undefined} fallbackIngredientName={record.recipeTitle} size={76} />
                  <span><strong>{record.recipeTitle}</strong><small>{formatDate(record.date)}</small></span>
                </button>
                <button
                  type="button"
                  className={styles.recentCookedDelete}
                  aria-label={language === 'ja' ? `${record.recipeTitle}の自炊記録を削除` : `Delete cooking record for ${record.recipeTitle}`}
                  onClick={() => {
                    deleteLocalCookedRecord(recordIndex);
                    loadRecipes();
                  }}
                ><Trash2 size={15} /></button>
              </article>
            ))}
          </div>
        </section>
      )}

      {!loading && (
        <div className={styles.historySectionHeading}>
          <div>
            <h2>{language === 'ja' ? '保存したレシピ' : 'Saved recipes'}</h2>
            <p>{language === 'ja' ? '保存ボタンで残したレシピです' : 'Recipes kept with the save button'}</p>
          </div>
        </div>
      )}

      {/* Search & Filter */}
      {!loading && allRecipes.length > 0 && <div className={styles.searchSection}>
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
          {!isPremium && allRecipes.length > FREE_HISTORY_ITEMS && (
            <button type="button" className={styles.historyLimitCard} onClick={() => setShowPaywall(true)}>
              <Crown size={20} />
              <span><strong>{t.history.plusLimitTitle}</strong>{t.history.plusLimitBody(allRecipes.length - FREE_HISTORY_ITEMS)}</span>
            </button>
          )}
          {sortedRecipes.map((recipe) => {
            const isExpanded = expandedId === recipe.id;
            const fulfillment = fulfillmentByRecipeId.get(recipe.id);
            const baseServings = recipeServings(recipe.servings);
            const displayServings = servingOverrides[recipe.id] || baseServings;
            const displayedRecipe = {
              ...recipe,
              servings: displayServings,
              ingredients: recipe.ingredients.map((item) => ({
                ...item,
                amount: scaleIngredientAmount(item.amount, baseServings, displayServings),
              })),
            };
            return (
              <div key={recipe.id} className={styles.recipeCard}>
                <div
                  className={styles.cardTopRow}
                  onClick={() => setExpandedId(isExpanded ? null : recipe.id)}
                >
                  <button
                    type="button"
                    className={styles.recipePreviewButton}
                    aria-label={language === 'ja' ? `${recipe.title}をトレーで開く` : `Open ${recipe.title}`}
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
                    <div className={styles.savedDate}>
                      <UiIcon slug="calendar_date" size={15} alt="" /> {formatDate(recipe.saved_at)}
                    </div>
                  </div>

                  <button className={styles.expandBtn}>
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
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

                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => { e.stopPropagation(); confirmDelete(recipe.id); }}
                    title={t.history.deleteButtonTitle}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {isExpanded && (
                  <div className={styles.detailBody}>
                    {recipe.nutrition && (
                      <div className={styles.nutritionSection}>
                        <h3 className={styles.nutritionTitle}>{t.history.nutritionTitle}</h3>
                        <NutritionChart nutrition={recipe.nutrition} />
                      </div>
                    )}

                    <div className={styles.section}>
                      <div className={styles.detailHeadingRow}>
                        <h3>{t.history.ingredientsTitle}</h3>
                        <div className={styles.servingsControl} aria-label={t.recipe.servingsLabel}>
                          <button type="button" disabled={displayServings <= 1} onClick={() => setServingOverrides((current) => ({ ...current, [recipe.id]: Math.max(1, displayServings - 1) }))}><Minus size={16} strokeWidth={3} /></button>
                          <strong>{t.recipe.servingsUnit(displayServings)}</strong>
                          <button type="button" disabled={displayServings >= 15} onClick={() => setServingOverrides((current) => ({ ...current, [recipe.id]: Math.min(15, displayServings + 1) }))}><Plus size={16} strokeWidth={3} /></button>
                        </div>
                      </div>
                      {displayServings !== baseServings && <p className={styles.servingScaleNotice}>{language === 'ja' ? '分量は目安です。分けにくい食材と調味料は作りやすい量・味見で調整してください。' : 'Amounts are estimates; round indivisible ingredients and season to taste.'}</p>}
                      <ul className={styles.ingredientList}>
                        {displayedRecipe.ingredients.map((item, i) => {
                          const missing = isIngredientMissing(item.name, ingredients, userProfile.assumeSeasoningsAvailable);
                          const pinKey = `${recipe.id}-${item.name}`;
                          const isPinned = pinnedToShoppingSet.has(pinKey);
                          return (
                            <li key={i} className={missing ? styles.ingredientMissing : undefined}>
                              <span className={styles.ingredientName}>
                                <IngredientIcon name={item.name} size={30} />
                                <span style={{ color: missing ? '#d92b3f' : 'var(--foreground)', fontWeight: missing ? 800 : 600 }}>
                                  {item.name}
                                </span>
                              </span>
                              <span className={styles.ingredientRight}>
                                <span className={styles.ingredientAmount}>{item.amount}</span>
                                {missing && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handlePinToShopping(recipe.id, item.name); }}
                                    className={isPinned ? styles.addedBtn : styles.addToCartBtn}
                                    disabled={isPinned}
                                  >
                                    {isPinned ? <Check size={15} /> : <Plus size={15} />}
                                    {isPinned ? t.recipe.addedToShopping : t.recipe.addToShopping}
                                  </button>
                                )}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    <div className={styles.section}>
                      <h3>{t.history.stepsTitle}</h3>
                      <ol className={styles.stepList}>
                        {(Array.isArray(recipe.steps) ? recipe.steps : []).map((step, i) => (
                          <li key={i}>
                            <span className={styles.stepNumber}>{i + 1}</span>
                            <span className={styles.stepText}>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {recipe.tips && isPremium && (
                      <div className={styles.tipsBox}>
                        <strong>{t.recipe.tipsPrefix}</strong> {recipe.tips}
                      </div>
                    )}
                    {recipe.tips && !isPremium && (
                      <button type="button" className={styles.historyLimitCard} onClick={() => setShowPaywall(true)}>
                        <Crown size={18} />
                        <span><strong>{t.recipe.tipsPlusTitle}</strong>{t.recipe.tipsPlusBody}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
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

